import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export type ReportFormat = 'csv' | 'excel' | 'pdf';

type ReportValue = string | number | boolean | null | undefined;

export interface ReportContextItem {
  label: string;
  value: ReportValue;
}

export interface ReportOptions {
  subtitle?: string;
  period?: string;
  reference?: string;
  filters?: ReportContextItem[];
  summary?: ReportContextItem[];
  notes?: string[];
  columns?: string[];
}

function csvSafe(value: ReportValue) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  const safeText = typeof value !== 'number' && /^[\s\u0000]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
  const csv = rows
    .map((row) => row.map(csvSafe).join(','))
    .join('\r\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsvFromObjects(filename: string, headers: string[], data: Array<Record<string, string | number | boolean | null | undefined>>) {
  const rows = [headers, ...data.map((item) => headers.map((header) => item[header] ?? ''))];
  downloadCsv(filename, rows);
}

async function loadBrandLogo() {
  const response = await fetch('/email-logo.png');
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o logótipo para o PDF (${response.status}).`);
  }
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível preparar o logótipo para o PDF.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o logótipo.'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadReportFromObjects(
  format: ReportFormat,
  filename: string,
  title: string,
  headers: string[],
  data: Array<Record<string, ReportValue>>,
  options: ReportOptions = {},
) {
  const rows = data.map((item) => headers.map((header) => item[header] ?? ''));

  if (format === 'csv') {
    downloadCsv(filename, [headers, ...rows]);
    return;
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio');
    worksheet.addRow([title]);
    if (options.subtitle) worksheet.addRow([options.subtitle]);
    worksheet.addRow(['Gerado em', new Date().toLocaleString('pt-MZ')]);
    if (options.period) worksheet.addRow(['Período', options.period]);
    options.filters?.forEach((filter) => worksheet.addRow([filter.label, filter.value ?? '—']));
    if (options.summary?.length) {
      worksheet.addRow([]);
      worksheet.addRow(['Resumo']);
      options.summary.forEach((item) => worksheet.addRow([item.label, item.value ?? '—']));
    }
    if (options.notes?.length) {
      worksheet.addRow([]);
      worksheet.addRow(['Critérios e notas']);
      options.notes.forEach((note) => worksheet.addRow([note]));
    }
    worksheet.addRow([]);
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));
    const headerRow = worksheet.lastRow!.number - rows.length;
    worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF17324D' } };
    worksheet.getRow(headerRow).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
    worksheet.columns = headers.map((header) => ({ width: Math.min(Math.max(header.length + 2, 12), 40) }));
    const output = await workbook.xlsx.writeBuffer();
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });
  const logoData = await loadBrandLogo();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 13;
  const headerHeight = 36;
  const topMargin = 40;
  const bottomMargin = 20;
  const printableWidth = pageWidth - margin * 2;
  const navy: [number, number, number] = [23, 50, 77];
  const orange: [number, number, number] = [231, 145, 55];
  const ink: [number, number, number] = [35, 48, 61];
  const muted: [number, number, number] = [100, 116, 139];
  const border: [number, number, number] = [222, 229, 236];
  const pale: [number, number, number] = [247, 249, 251];
  const pageBackground: [number, number, number] = [248, 250, 252];

  const drawPageBackground = () => {
    pdf.setFillColor(...pageBackground);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };
  drawPageBackground();
  pdf.internal.events.subscribe('addPage', drawPageBackground);

  pdf.setProperties({
    title,
    subject: options.subtitle || title,
    author: 'e-Shopping Centre',
    creator: 'e-Shopping Centre',
  });

  const tableMargin = { left: margin, right: margin, top: topMargin, bottom: bottomMargin };
  const getFinalY = (fallback: number) =>
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
  const sectionHeading = (label: string, startY: number) => {
    let headingY = startY + 5;
    if (headingY > pageHeight - bottomMargin - 12) {
      pdf.addPage();
      headingY = topMargin;
    }
    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(label, margin, headingY);
    return headingY + 2.5;
  };
  let cursorY = topMargin;
  const generatedAt = new Date().toLocaleString('pt-MZ');
  const metadataRows = [
    ['Relatório', title, 'Período', options.period || 'Todo o histórico disponível'],
    ['Gerado por', 'e-Shopping Centre', 'Gerado em', generatedAt],
  ];
  autoTable(pdf, {
    body: metadataRows,
    startY: cursorY,
    margin: tableMargin,
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold', textColor: [71, 85, 105] },
      1: { cellWidth: (printableWidth - 60) / 2 },
      2: { cellWidth: 30, fontStyle: 'bold', textColor: [71, 85, 105] },
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      textColor: ink,
      lineColor: border,
      lineWidth: 0.15,
      overflow: 'linebreak',
      valign: 'middle',
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 0 || cellData.column.index === 2) {
        cellData.cell.styles.fillColor = [241, 245, 249];
      }
    },
    theme: 'grid',
  });
  cursorY = getFinalY(cursorY + 20);

  if (options.summary?.length) {
    const headingY = sectionHeading('Resumo', cursorY);
    const summaryGroups: ReportContextItem[][] = [];
    for (let index = 0; index < options.summary.length; index += 4) {
      summaryGroups.push(options.summary.slice(index, index + 4));
    }
    for (const [groupIndex, group] of summaryGroups.entries()) {
      const cells = [...group, ...Array.from(
        { length: 4 - group.length },
        () => ({ label: '', value: '' }),
      )];
      autoTable(pdf, {
        body: [
          cells.map((item) => item.label),
          cells.map((item) => String(item.value ?? '—')),
        ],
        startY: groupIndex === 0 ? headingY : getFinalY(headingY) + 3,
        margin: tableMargin,
        styles: {
          font: 'helvetica',
          fontSize: 7,
          cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
          textColor: muted,
          lineColor: border,
          lineWidth: 0.2,
          overflow: 'linebreak',
          valign: 'middle',
        },
        didParseCell: (cellData) => {
          if (cellData.row.index === 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fontSize = 11;
            cellData.cell.styles.textColor = navy;
          }
        },
        theme: 'grid',
      });
    }
    cursorY = getFinalY(headingY) + 2;
  }

  const criteriaRows = [
    ...(options.filters || []).map((filter) => [
      filter.label,
      String(filter.value ?? '—'),
    ]),
    ...(options.notes || []).map((note) => ['Nota', note]),
  ];
  if (criteriaRows.length) {
    const headingY = sectionHeading('Critérios de apuramento', cursorY);
    autoTable(pdf, {
      body: criteriaRows,
      startY: headingY,
      margin: tableMargin,
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', textColor: [71, 85, 105] } },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
        textColor: ink,
        lineColor: border,
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'top',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid',
    });
    cursorY = getFinalY(headingY) + 2;
  }

  const detailHeadingY = sectionHeading('Detalhe dos registos', cursorY);
  const detailHeaders = options.columns?.length === headers.length
    ? options.columns
    : headers.map((header) => header.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const numericHeader = /(valor|price|amount|total|revenue|quantity|quantidade|preço|saldo|comissão)/i;
  const columnStyles = Object.fromEntries(
    headers.flatMap((header, index) => numericHeader.test(header)
      ? [[index, { halign: 'right' as const }]]
      : []),
  );
  if (rows.length) {
    autoTable(pdf, {
      head: [detailHeaders],
      body: rows.map((row) => row.map((value) => String(value ?? '—'))),
      startY: detailHeadingY,
      margin: tableMargin,
      styles: {
        font: 'helvetica',
        fontSize: headers.length > 8 ? 6.5 : 7.5,
        cellPadding: headers.length > 8 ? 2.2 : 3,
        overflow: 'linebreak',
        textColor: ink,
        lineColor: border,
        lineWidth: 0.15,
        valign: 'middle',
      },
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold', cellPadding: 3.2 },
      didParseCell: (cellData) => {
        if (cellData.section === 'head') {
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fillColor = navy;
        }
      },
      alternateRowStyles: { fillColor: pale },
      columnStyles,
      horizontalPageBreak: headers.length > 10,
      horizontalPageBreakRepeat: [0],
      showHead: 'everyPage',
      theme: 'striped',
    });
  } else {
    const emptyMessage = 'Não existem registos para os filtros selecionados.';
    pdf.setFillColor(...pale);
    pdf.setDrawColor(...border);
    pdf.roundedRect(margin, detailHeadingY, printableWidth, 14, 2, 2, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(emptyMessage, pageWidth / 2, detailHeadingY + 8.5, { align: 'center' });
  }

  const pageCount = pdf.getNumberOfPages();
  const reference = options.reference || filename.replace(/\.[^.]+$/, '');
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, 3, headerHeight, 'F');
    pdf.setFillColor(...orange);
    pdf.rect(margin, 37, 18, 1.2, 'F');
    pdf.addImage(logoData, 'PNG', margin, 8, 12, 12);
    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('E-SHOPPING CENTRE', 27, 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...muted);
    pdf.setFontSize(7.5);
    pdf.text('MARKETPLACE EM MOÇAMBIQUE', 27, 17);

    const metadataX = pageWidth - margin;
    const metadataWidth = 78;
    const titleWidth = printableWidth - metadataWidth - 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...navy);
    pdf.setFontSize(10);
    pdf.text(pdf.splitTextToSize(title.toLocaleUpperCase('pt-MZ'), titleWidth).slice(0, 1), margin, 27);
    if (options.subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...muted);
      pdf.setFontSize(8);
      pdf.text(pdf.splitTextToSize(options.subtitle, titleWidth).slice(0, 1), margin, 32);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(7);
    pdf.text('PERÍODO', metadataX, 11, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    const periodText = options.period || 'Todo o histórico disponível';
    const periodLines = pdf.splitTextToSize(periodText, metadataWidth).slice(0, 2);
    pdf.setTextColor(...ink);
    pdf.setFontSize(8);
    pdf.text(periodLines, metadataX, 16, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(7);
    pdf.text('GERADO EM', metadataX, 23, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...ink);
    pdf.setFontSize(8);
    pdf.text(generatedAt, metadataX, 28, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const referenceText = `Referência: ${reference}`;
    const referenceLines = pdf.splitTextToSize(referenceText, metadataWidth).slice(0, 1);
    pdf.text(referenceLines, metadataX, 33, { align: 'right' });

    pdf.setDrawColor(...border);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(102, 113, 125);
    const footerTitle = `Relatório: ${title}`;
    pdf.setFontSize(7);
    const footerTitleMaxWidth = printableWidth * 0.48;
    const footerTitleFontSize = Math.min(7, 7 * footerTitleMaxWidth / pdf.getTextWidth(footerTitle));
    pdf.setFontSize(footerTitleFontSize);
    pdf.text(footerTitle, margin, pageHeight - 9);
    const footerReference = `Ref. ${reference}  |  Página ${page}`;
    const footerMaxWidth = printableWidth * 0.48;
    const footerFontSize = Math.min(7, 7 * footerMaxWidth / pdf.getTextWidth(footerReference));
    pdf.setFontSize(footerFontSize);
    pdf.text(footerReference, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }
  pdf.save(filename);
}
