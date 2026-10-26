import csv
from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from xml.sax.saxutils import escape

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
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
        pagesize=landscape(A4),
        title='Relatório financeiro do vendedor',
        author='e-Shopping Centre',
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=29 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='StoreReportTitle', parent=styles['Heading1'], fontName='Helvetica-Bold',
        fontSize=16, leading=19, textColor=colors.HexColor('#17324d'), spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        name='StoreReportSection', parent=styles['Heading2'], fontName='Helvetica-Bold',
        fontSize=9, leading=11, textColor=colors.HexColor('#17324d'), spaceBefore=3 * mm, spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        name='StoreReportCell', parent=styles['BodyText'], fontName='Helvetica',
        fontSize=6.5, leading=8, textColor=colors.HexColor('#2d3741'),
    ))

    def draw_page(canvas, document):
        page_width, page_height = landscape(A4)
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#17324d'))
        canvas.rect(0, page_height - 22 * mm, page_width, 22 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#e79137'))
        canvas.rect(0, page_height - 23 * mm, page_width, 1.2 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 8)
        canvas.drawString(10 * mm, page_height - 9 * mm, 'E-SHOPPING CENTRE')
        canvas.setFont('Helvetica', 7)
        canvas.drawRightString(page_width - 10 * mm, page_height - 9 * mm, 'RELATÓRIO FINANCEIRO DO VENDEDOR')
        canvas.setStrokeColor(colors.HexColor('#dfe5eb'))
        canvas.line(10 * mm, 13 * mm, page_width - 10 * mm, 13 * mm)
        canvas.setFillColor(colors.HexColor('#66717d'))
        canvas.setFont('Helvetica', 7)
        canvas.drawString(10 * mm, 8 * mm, f'Loja: {title}  |  Auditoria: {audit_id}')
        canvas.drawRightString(page_width - 10 * mm, 8 * mm, f'Página {document.page}')
        canvas.restoreState()

    story = []
    story.append(Paragraph('Vendas, reembolsos e receita líquida', styles['StoreReportTitle']))
    story.append(Paragraph(
        'Encomendas pagas no período selecionado, detalhadas por encomenda e produto.',
        styles['BodyText'],
    ))
    story.append(Spacer(1, 3 * mm))
    details = [
        ['Loja', escape(str(title)), 'Período', escape(str(period_label))],
        ['Gerado por', escape(str(generated_by)), 'Gerado em', escape(str(generated_at))],
    ]
    details_table = Table(details, colWidths=[27 * mm, 91 * mm, 27 * mm, 91 * mm])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f3f6')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f0f3f6')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#17324d')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#17324d')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTNAME', (3, 0), (3, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#dfe5eb')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(details_table)
    story.append(Paragraph('Resumo financeiro', styles['StoreReportSection']))
    summary_rows = _serialize_report_summary_rows(summary_data)
    summary_table = Table(summary_rows, colWidths=[150 * mm, 45 * mm], repeatRows=0)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7f9fb')),
        ('GRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#dfe5eb')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#17324d')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
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
        [escape(criteria_labels.get(key, key.replace('_', ' ').capitalize())), escape(str(value))]
        for key, value in criteria.items()
    ]
    criteria_table = Table(criteria_rows, colWidths=[53 * mm, 142 * mm])
    criteria_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e3e8ed')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(criteria_table)
    story.append(Paragraph('Detalhe das encomendas', styles['StoreReportSection']))
    data_rows = rows
    if data_rows:
        cell_style = ParagraphStyle(
            'ReportCell', parent=styles['StoreReportCell'], fontSize=5.5, leading=6.5,
        )
        printable_width = landscape(A4)[0] - 20 * mm
        column_width = printable_width / len(data_rows[0])
        pdf_rows = [
            [Paragraph(escape('' if value is None else str(value)), cell_style) for value in row]
            for row in data_rows
        ]
        table = LongTable(
            pdf_rows,
            colWidths=[column_width] * len(data_rows[0]),
            repeatRows=1,
        )
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17324d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7f9fb')]),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(table)
    else:
        story.append(Paragraph('Não existem registos para o período selecionado.', styles['BodyText']))
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
