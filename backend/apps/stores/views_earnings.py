import csv
from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path
from xml.sax.saxutils import escape

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Table, TableStyle
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from django.utils import timezone
from apps.orders.models import Order, OrderItem, ReturnRequest
from .financials import paid_order_revenue
from .models import StoreReportExport


REPORTABLE_ORDER_STATUSES = (
    'confirmed', 'processing', 'shipped', 'ready_for_pickup', 'delivered', 'refunded',
)


class StoreStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'store'):
            return Response({
                'store_name': '',
                'tagline': '',
                'status': '',
                'status_display': '',
                'today_sales': 0, 'today_revenue': 0, 'total_revenue': 0,
                'total_products': 0, 'total_orders': 0, 'pending_orders': 0,
                'store_rating': 0, 'recent_orders': [], 'top_products': [],
            })
        store = request.user.store
        today = timezone.now().date()
        today_start = timezone.make_aware(
            timezone.datetime.combine(today, timezone.datetime.min.time())
        )

        orders = store.orders.all()
        today_orders = orders.filter(created_at__gte=today_start)
        completed_orders = orders.filter(
            payment_status='completed',
            status__in=REPORTABLE_ORDER_STATUSES,
        )
        today_paid_orders = today_orders.filter(
            payment_status='completed',
            status__in=REPORTABLE_ORDER_STATUSES,
        )

        total_revenue = float(paid_order_revenue(completed_orders))
        today_revenue = float(paid_order_revenue(today_paid_orders))

        # Recent orders (last 5)
        recent = orders.select_related('buyer').order_by('-created_at')[:5]
        recent_data = []
        for o in recent:
            recent_data.append({
                'id': str(o.id),
                'order_number': o.order_number,
                'customer': o.buyer.get_full_name() or o.buyer.email,
                'items_count': o.items.count(),
                'total': float(o.total),
                'status': o.status,
                'status_display': o.get_status_display(),
                'payment_method': o.payment_method,
                'created_at': o.created_at.isoformat(),
            })

        # Top products
        from apps.products.models import Product
        top = Product.objects.filter(store=store, status='active').annotate(
            paid_sales=Sum(
                'order_items__quantity',
                filter=Q(
                    order_items__order__payment_status='completed',
                    order_items__order__status__in=REPORTABLE_ORDER_STATUSES,
                ),
            ),
            paid_revenue=Sum(
                'order_items__total_price',
                filter=Q(
                    order_items__order__payment_status='completed',
                    order_items__order__status__in=REPORTABLE_ORDER_STATUSES,
                ),
            ),
        ).order_by('-paid_sales', '-paid_revenue')[:5].prefetch_related('images')
        top_data = []
        for product in top:
            primary_image = next(
                (image for image in product.images.all() if image.is_primary),
                None,
            )
            top_data.append({
                'id': str(product.id),
                'name': product.name,
                'slug': product.slug,
                'sales': product.paid_sales or 0,
                'revenue': float(product.paid_revenue or 0),
                'image': primary_image.image.url if primary_image else None,
            })

        # Type-specific stats
        downloaded_today = 0
        active_students = 0
        if store.product_type == 'digital':
            from apps.products.models_digital import DigitalDownload
            downloaded_today = DigitalDownload.objects.filter(
                product__store=store,
                created_at__gte=today_start,
            ).count()
        elif store.product_type == 'course':
            from apps.courses.models import Enrollment
            active_students = Enrollment.objects.filter(
                course__product__store=store,
                completed=False,
            ).count()

        # Saúde do frete (lojas físicas)
        shipping_configured = True
        if store.product_type == 'physical':
            from apps.shipping.models import ShippingZone, ShippingMethod, ShippingRate
            shipping_configured = (
                ShippingZone.objects.filter(store=store, is_active=True).exists()
                and ShippingMethod.objects.filter(store=store, is_active=True).exists()
                and ShippingRate.objects.filter(
                    zone__store=store, is_active=True, method__is_active=True
                ).exists()
            )

        return Response({
            # Store identity
            'store_name': store.name,
            'tagline': store.tagline or '',
            'status': store.status,
            'status_display': store.get_status_display(),
            # Stats cards — common
            'product_type': store.product_type,
            'shipping_configured': shipping_configured,
            'today_sales': today_paid_orders.count(),
            'today_revenue': today_revenue,
            'total_revenue': total_revenue,
            'total_products': store.products.filter(status='active').count(),
            'total_orders': orders.count(),
            'pending_orders': orders.filter(status='pending').count(),
            'store_rating': float(store.rating),
            # Type-specific stats
            'downloaded_today': downloaded_today,
            'active_students': active_students,
            # Social
            'followers_count': store.followers.count(),
            # Lists
            'recent_orders': recent_data,
            'top_products': top_data,
            'recent_reviews': self._get_recent_reviews(store),
        })

    def _get_recent_reviews(self, store):
        from apps.reviews.models import StoreReview
        reviews = StoreReview.objects.filter(
            store=store, is_hidden=False,
        ).order_by('-created_at')[:5]
        return [{
            'id': str(r.id),
            'user_name': r.user.first_name or r.user.email.split('@')[0],
            'overall_rating': r.overall_rating,
            'comment': r.comment[:200] if r.comment else '',
            'created_at': r.created_at.isoformat(),
        } for r in reviews]


class StoreEarningsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'store') or not hasattr(request.user, 'wallet'):
            return Response({'transactions': []})
        from apps.wallet.serializers import WalletTransactionSerializer
        wallet = request.user.wallet
        transactions = wallet.transactions.filter(type='sale').order_by('-created_at')[:50]
        serializer = WalletTransactionSerializer(transactions, many=True)
        return Response({'transactions': serializer.data})


def _csv_safe(value):
    value = '' if value is None else str(value)
    if value.lstrip(' \t\r\n\x00').startswith(('=', '+', '-', '@')):
        return f"'{value}"
    return value


def _format_money(value):
    return f'{value:.2f}'


def _serialize_report_summary_rows(summary_data):
    return [
        ['Encomendas pagas incluídas', summary_data['order_count']],
        ['Itens', summary_data['item_count']],
        ['Vendas brutas', _format_money(summary_data['gross_sales'])],
        ['Reembolsos registados', _format_money(summary_data['refunds'])],
        ['Vendas líquidas após reembolsos', _format_money(summary_data['net_sales'])],
        ['Receita bruta do vendedor antes de reembolsos', _format_money(summary_data['seller_gross'])],
        ['Parcela do vendedor revertida por reembolsos', _format_money(summary_data['seller_refunds'])],
        ['Receita líquida estimada do vendedor', _format_money(summary_data['seller_net'])],
    ]


def _build_excel_report(rows, summary_data, title, period_label, generated_by, generated_at, audit_id):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Relatorio'
    sheet.append(['Relatório financeiro do vendedor'])
    sheet.append(['Loja', title])
    sheet.append(['Período', period_label])
    sheet.append(['Gerado por', generated_by])
    sheet.append(['Gerado em', generated_at])
    sheet.append(['Referência de auditoria', audit_id])
    sheet.append([])
    for row in _serialize_report_summary_rows(summary_data):
        sheet.append([row[0], row[1]])
    sheet.append([])
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


def _build_pdf_report(rows, summary_data, title, period_label, generated_by, generated_at, audit_id, criteria):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A3),
        title='Relatório financeiro do vendedor',
        author='e-Shopping Centre',
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=40 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='StoreReportSection', parent=styles['Heading2'], fontName='Helvetica-Bold',
        fontSize=11, leading=14, textColor=colors.HexColor('#17324d'),
        spaceBefore=5 * mm, spaceAfter=2.5 * mm,
    ))
    styles.add(ParagraphStyle(
        name='StoreReportCell', parent=styles['BodyText'], fontName='Helvetica',
        fontSize=7.5, leading=9, textColor=colors.HexColor('#334155'),
    ))
    styles.add(ParagraphStyle(
        name='StoreReportMeta', parent=styles['BodyText'], fontName='Helvetica',
        fontSize=8, leading=10, textColor=colors.HexColor('#334155'),
    ))
    styles.add(ParagraphStyle(
        name='StoreReportMetaLabel', parent=styles['BodyText'], fontName='Helvetica-Bold',
        fontSize=7.5, leading=9, textColor=colors.HexColor('#475569'),
    ))
    styles.add(ParagraphStyle(
        name='StoreReportTableHeader', parent=styles['BodyText'],
        fontName='Helvetica-Bold', fontSize=7, leading=8.5, textColor=colors.white,
    ))
    logo_path = Path(__file__).resolve().parents[1] / 'users' / 'static' / 'email-logo.png'

    def draw_page(canvas, document):
        page_width, page_height = landscape(A3)
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#f8fafc'))
        canvas.rect(0, 0, page_width, page_height, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.rect(0, page_height - 36 * mm, page_width, 36 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#17324d'))
        canvas.rect(0, page_height - 36 * mm, 3 * mm, 36 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#e79137'))
        canvas.rect(12 * mm, page_height - 37 * mm, 18 * mm, 1.2 * mm, fill=1, stroke=0)
        canvas.drawImage(
            str(logo_path),
            12 * mm,
            page_height - 20 * mm,
            width=12 * mm,
            height=12 * mm,
            preserveAspectRatio=True,
            anchor='c',
            mask='auto',
        )
        canvas.setFillColor(colors.HexColor('#17324d'))
        canvas.setFont('Helvetica-Bold', 10)
        canvas.drawString(27 * mm, page_height - 12 * mm, 'E-SHOPPING CENTRE')
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.setFont('Helvetica', 7.5)
        canvas.drawString(27 * mm, page_height - 17 * mm, 'MARKETPLACE EM MOÇAMBIQUE')
        canvas.setFillColor(colors.HexColor('#17324d'))
        canvas.setFont('Helvetica-Bold', 10)
        canvas.drawString(12 * mm, page_height - 27 * mm, 'RELATÓRIO DE VENDAS')
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.setFont('Helvetica', 8)
        canvas.drawString(12 * mm, page_height - 32 * mm, 'Vendas, reembolsos e receita líquida do vendedor')
        canvas.setFillColor(colors.HexColor('#475569'))
        canvas.setFont('Helvetica-Bold', 7)
        canvas.drawRightString(page_width - 12 * mm, page_height - 11 * mm, 'PERÍODO')
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(page_width - 12 * mm, page_height - 16 * mm, str(period_label))
        canvas.setFont('Helvetica-Bold', 7)
        canvas.drawRightString(page_width - 12 * mm, page_height - 23 * mm, 'GERADO EM')
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(page_width - 12 * mm, page_height - 28 * mm, str(generated_at))
        canvas.setFont('Helvetica', 7)
        canvas.drawRightString(page_width - 12 * mm, page_height - 33 * mm, f'Referência: {audit_id}')
        canvas.setStrokeColor(colors.HexColor('#dfe5eb'))
        canvas.line(12 * mm, 15 * mm, page_width - 12 * mm, 15 * mm)
        canvas.setFillColor(colors.HexColor('#66717d'))
        canvas.setFont('Helvetica', 7)
        canvas.drawString(12 * mm, 9 * mm, f'Loja: {title}')
        canvas.drawRightString(
            page_width - 12 * mm,
            9 * mm,
            f'Ref. {audit_id}  |  Página {document.page}',
        )
        canvas.restoreState()

    story = []
    printable_width = landscape(A3)[0] - 24 * mm
    label_width = 30 * mm
    value_width = (printable_width - label_width * 2) / 2
    details = [
        [
            Paragraph('Loja', styles['StoreReportMetaLabel']),
            Paragraph(escape(str(title)), styles['StoreReportMeta']),
            Paragraph('Período', styles['StoreReportMetaLabel']),
            Paragraph(escape(str(period_label)), styles['StoreReportMeta']),
        ],
        [
            Paragraph('Gerado por', styles['StoreReportMetaLabel']),
            Paragraph(escape(str(generated_by)), styles['StoreReportMeta']),
            Paragraph('Gerado em', styles['StoreReportMetaLabel']),
            Paragraph(escape(str(generated_at)), styles['StoreReportMeta']),
        ],
    ]
    details_table = Table(
        details,
        colWidths=[label_width, value_width, label_width, value_width],
        hAlign='LEFT',
    )
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f1f5f9')),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(details_table)
    story.append(Paragraph('Resumo financeiro', styles['StoreReportSection']))
    summary_items = _serialize_report_summary_rows(summary_data)
    summary_cards = [
        ('Encomendas pagas', str(summary_data['order_count'])),
        ('Itens vendidos', str(summary_data['item_count'])),
        ('Vendas brutas', f"{summary_items[2][1]} MZN"),
        ('Reembolsos', f"{summary_items[3][1]} MZN"),
        ('Vendas líquidas', f"{summary_items[4][1]} MZN"),
        ('Receita bruta do vendedor', f"{summary_items[5][1]} MZN"),
        ('Reembolsos do vendedor', f"{summary_items[6][1]} MZN"),
        ('Receita líquida do vendedor', f"{summary_items[7][1]} MZN"),
    ]
    summary_label_style = ParagraphStyle(
        'StoreReportSummaryLabel', parent=styles['StoreReportMetaLabel'],
        fontSize=7, textColor=colors.HexColor('#64748b'),
    )
    summary_value_style = ParagraphStyle(
        'StoreReportSummaryValue', parent=styles['StoreReportMeta'],
        fontName='Helvetica-Bold', fontSize=11, leading=14,
        textColor=colors.HexColor('#17324d'),
    )
    summary_data = [
        [Paragraph(escape(label), summary_label_style) for label, _ in summary_cards[:4]],
        [Paragraph(escape(value), summary_value_style) for _, value in summary_cards[:4]],
        [Paragraph(escape(label), summary_label_style) for label, _ in summary_cards[4:]],
        [Paragraph(escape(value), summary_value_style) for _, value in summary_cards[4:]],
    ]
    card_width = printable_width / 4
    summary_table = Table(
        summary_data,
        colWidths=[card_width] * 4,
        rowHeights=[12 * mm, 18 * mm, 12 * mm, 18 * mm],
        hAlign='LEFT',
    )
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#dbe3ec')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 0), (-1, 0), 0, colors.white),
        ('LINEBELOW', (0, 2), (-1, 2), 0, colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(summary_table)
    story.append(Paragraph('Critérios de apuramento', styles['StoreReportSection']))
    criteria_labels = {
        'date_basis': 'Data usada para o período',
        'payment_status': 'Estado do pagamento',
        'excluded_order_statuses': 'Estados de encomenda excluídos',
        'refund_basis': 'Critério de reembolsos',
        'line_amount_basis': 'Critério do valor por produto',
        'period_inclusive': 'Limites do período',
    }
    criteria_rows = [
        [
            Paragraph(escape(criteria_labels.get(key, key.replace('_', ' ').capitalize())), styles['StoreReportMetaLabel']),
            Paragraph(escape(str(value)), styles['StoreReportMeta']),
        ]
        for key, value in criteria.items()
    ]
    criteria_table = Table(
        criteria_rows,
        colWidths=[55 * mm, printable_width - 55 * mm],
        hAlign='LEFT',
    )
    criteria_table.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.35, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(criteria_table)
    story.append(Paragraph('Detalhe das encomendas', styles['StoreReportSection']))
    if len(rows) > 1:
        cell_style = ParagraphStyle(
            'ReportCell', parent=styles['StoreReportCell'], fontSize=7, leading=8.5,
        )
        pdf_rows = [
            [
                Paragraph(
                    escape('' if value is None else str(value)),
                    styles['StoreReportTableHeader'] if row_index == 0 else cell_style,
                )
                for value in row
            ]
            for row_index, row in enumerate(rows)
        ]
        column_weights = [1.15, 1.6, 1.5, 1.0, 1.0, 1.6, 1.0, 0.65, 0.95, 1.1, 1.0, 0.9, 1.0, 1.1, 1.45]
        weight_total = sum(column_weights)
        table = LongTable(
            pdf_rows,
            colWidths=[
                printable_width * weight / weight_total
                for weight in column_weights[:len(rows[0])]
            ],
            repeatRows=1,
            hAlign='LEFT',
        )
        table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#17324d')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17324d')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
    else:
        story.append(Paragraph('Não existem registos para o período selecionado.', styles['StoreReportCell']))
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    buffer.seek(0)
    return buffer


class StoreEarningsReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    max_period_days = 366
    max_detail_rows = 50000

    def get(self, request):
        store = getattr(request.user, 'store', None)
        if store is None:
            return Response(
                {'detail': 'Apenas vendedores com uma loja podem exportar relatórios.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        unsupported = set(request.query_params) - {'date_from', 'date_to', 'format'}
        if unsupported:
            raise ValidationError({
                'query_params': (
                    'Filtros não suportados: '
                    + ', '.join(sorted(unsupported))
                ),
            })

        export_format = (request.query_params.get('format') or 'csv').lower()
        if export_format not in {'csv', 'excel', 'pdf'}:
            raise ValidationError({
                'format': 'Formato inválido. Use csv, excel ou pdf.',
            })

        date_from = self._parse_date(request.query_params.get('date_from'), 'date_from')
        date_to = self._parse_date(request.query_params.get('date_to'), 'date_to')
        if date_from is None or date_to is None:
            raise ValidationError({
                'date': 'Indique date_from e date_to no formato AAAA-MM-DD.',
            })
        if date_from > date_to:
            raise ValidationError({
                'date_to': 'A data final deve ser igual ou posterior à data inicial.',
            })
        if (date_to - date_from).days + 1 > self.max_period_days:
            raise ValidationError({
                'date_to': f'O período máximo do relatório é {self.max_period_days} dias.',
            })

        start = timezone.make_aware(datetime.combine(date_from, time.min))
        end = timezone.make_aware(datetime.combine(date_to + timedelta(days=1), time.min))
        orders_query = Order.objects.filter(
            store=store,
            payment_status='completed',
            status__in=REPORTABLE_ORDER_STATUSES,
            created_at__gte=start,
            created_at__lt=end,
        )
        item_count = OrderItem.objects.filter(order__in=orders_query).count()
        empty_order_count = orders_query.annotate(
            report_item_count=Count('items'),
        ).filter(report_item_count=0).count()
        if item_count + empty_order_count > self.max_detail_rows:
            raise ValidationError({
                'date': (
                    'O relatório excede 50.000 linhas. Reduza o período e tente novamente.'
                ),
            })

        orders = list(
            orders_query
            .select_related('buyer', 'store')
            .prefetch_related('items')
            .order_by('created_at', 'order_number')
        )
        order_ids = [order.id for order in orders]

        from apps.wallet.models import WalletTransaction
        refund_rows = WalletTransaction.objects.filter(
            type='refund',
            status='completed',
            reference_type='order',
            reference_id__in=order_ids,
            amount__gt=0,
        ).values('reference_id', 'amount')
        refunds_by_order = {}
        for refund in refund_rows:
            refunds_by_order.setdefault(refund['reference_id'], []).append(
                Decimal(refund['amount'])
            )

        gross_sales = Decimal('0.00')
        refunds = Decimal('0.00')
        seller_gross = Decimal('0.00')
        seller_refunds = Decimal('0.00')
        order_values = {}
        for order in orders:
            items = list(order.items.all())
            order_refunds = refunds_by_order.get(order.id, [])
            order_refund_total = sum(order_refunds, Decimal('0.00'))
            order_seller_gross = max(
                order.total - (order.platform_fee or 0)
                - (order.affiliate_commission or 0),
                Decimal('0.00'),
            )
            order_seller_refunds = sum(
                (
                    (order_seller_gross * refund / order.total).quantize(
                        Decimal('0.01')
                    )
                    for refund in order_refunds
                ),
                Decimal('0.00'),
            ) if order.total else Decimal('0.00')
            order_values[order.id] = (
                items,
                order_refund_total,
                order_seller_gross,
                order_seller_refunds,
            )
            gross_sales += order.total
            refunds += order_refund_total
            seller_gross += order_seller_gross
            seller_refunds += order_seller_refunds

        net_sales = gross_sales - refunds
        seller_net = seller_gross - seller_refunds
        criteria = {
            'date_basis': 'order.created_at',
            'payment_status': 'completed',
            'excluded_order_statuses': ['pending', 'cancelled', 'failed'],
            'refund_basis': 'completed buyer-wallet refund credits for selected orders, through export time',
            'line_amount_basis': 'historical order item total_price before order-level discount allocation',
            'period_inclusive': True,
        }
        audit = StoreReportExport.objects.create(
            store=store,
            store_name=store.name,
            generated_by=request.user,
            generated_by_email=request.user.email,
            date_from=date_from,
            date_to=date_to,
            report_type='sales',
            export_format=export_format,
            criteria=criteria,
            order_count=len(orders),
            item_count=item_count,
            row_count=item_count + empty_order_count,
            gross_sales=gross_sales,
            refunds=refunds,
            net_sales=net_sales,
            seller_gross=seller_gross,
            seller_refunds=seller_refunds,
            seller_net=seller_net,
            ip_address=request.META.get('REMOTE_ADDR') or None,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )

        summary = {
            'order_count': len(orders),
            'item_count': item_count,
            'gross_sales': gross_sales,
            'refunds': refunds,
            'net_sales': net_sales,
            'seller_gross': seller_gross,
            'seller_refunds': seller_refunds,
            'seller_net': seller_net,
        }
        period_label = f'{date_from.isoformat()} até {date_to.isoformat()}'
        header = [
            'Encomenda', 'Data da encomenda', 'Cliente', 'Estado', 'Pagamento',
            'Produto', 'ID do produto', 'Quantidade', 'Preço unitário MZN',
            'Valor histórico da linha MZN', 'Desconto da encomenda MZN',
            'Frete da encomenda MZN', 'Total da encomenda MZN',
            'Reembolsos da encomenda MZN', 'Receita líquida estimada do vendedor MZN',
        ]
        rows = [header]

        for order in orders:
            items, order_refunds, order_seller_gross, order_seller_refunds = order_values[order.id]
            order_row_values = [
                _csv_safe(order.order_number),
                timezone.localtime(order.created_at).isoformat(),
                _csv_safe(order.buyer.get_full_name() or order.buyer.email),
                _csv_safe(order.get_status_display()),
                _csv_safe(order.payment_method),
            ]
            if not items:
                rows.append(order_row_values + [
                    '', '', '', '', '', _format_money(order.discount or 0),
                    _format_money(order.shipping_cost or 0), _format_money(order.total),
                    _format_money(order_refunds), _format_money(order_seller_gross - order_seller_refunds),
                ])
                continue
            for index, item in enumerate(items):
                order_totals = (
                    [
                        _format_money(order.discount or 0),
                        _format_money(order.shipping_cost or 0),
                        _format_money(order.total),
                        _format_money(order_refunds),
                        _format_money(order_seller_gross - order_seller_refunds),
                    ]
                    if index == 0
                    else ['', '', '', '', '']
                )
                rows.append(order_row_values + [
                    _csv_safe(item.product_name),
                    str(item.product_id or ''),
                    item.quantity,
                    _format_money(item.unit_price),
                    _format_money(item.total_price),
                    *order_totals,
                ])

        if export_format == 'csv':
            output = StringIO(newline='')
            writer = csv.writer(output, lineterminator='\r\n')
            writer.writerow(['Relatório de vendas do vendedor'])
            writer.writerow(['Loja', _csv_safe(store.name)])
            writer.writerow(['Período por data da encomenda', date_from.isoformat(), date_to.isoformat()])
            writer.writerow(['Critérios', _csv_safe(' '.join(f'{key}={value}' for key, value in criteria.items()))])
            writer.writerow(['Gerado por', _csv_safe(request.user.email)])
            writer.writerow(['Gerado em', timezone.localtime(audit.created_at).isoformat()])
            writer.writerow(['Referência de auditoria', str(audit.id)])
            writer.writerow([])
            writer.writerow(['Resumo', 'Valor MZN'])
            for label, value in _serialize_report_summary_rows(summary):
                writer.writerow([label, value])
            writer.writerow([])
            writer.writerow(header)
            for row in rows[1:]:
                writer.writerow(row)
            response = HttpResponse('\ufeff' + output.getvalue(), content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="relatorio-vendas-{date_from}-{date_to}.csv"'
            response['X-Report-Audit-Id'] = str(audit.id)
            response['Cache-Control'] = 'private, no-store'
            response['X-Content-Type-Options'] = 'nosniff'
            return response

        generated_at = timezone.localtime(audit.created_at).strftime('%Y-%m-%d %H:%M:%S')
        if export_format == 'excel':
            buffer = _build_excel_report(rows, summary, store.name, period_label, request.user.email, generated_at, str(audit.id))
            response = HttpResponse(buffer.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="relatorio-vendas-{date_from}-{date_to}.xlsx"'
            response['X-Report-Audit-Id'] = str(audit.id)
            response['Cache-Control'] = 'private, no-store'
            response['X-Content-Type-Options'] = 'nosniff'
            return response

        pdf_buffer = _build_pdf_report(rows, summary, store.name, period_label, request.user.email, generated_at, str(audit.id), criteria)
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="relatorio-vendas-{date_from}-{date_to}.pdf"'
        response['X-Report-Audit-Id'] = str(audit.id)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    @staticmethod
    def _parse_date(value, field):
        if not value:
            return None
        parsed = parse_date(value)
        if parsed is None:
            raise ValidationError({
                field: 'Use uma data válida no formato AAAA-MM-DD.',
            })
        return parsed
