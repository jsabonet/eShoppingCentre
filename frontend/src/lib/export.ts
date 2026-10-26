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

  const pdf = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const printableWidth = pageWidth - margin * 2;

  pdf.setProperties({
    title,
    subject: options.subtitle || title,
    author: 'e-Shopping Centre',
    creator: 'e-Shopping Centre',
  });

  pdf.setFillColor(23, 50, 77);
  pdf.rect(0, 0, pageWidth, 36, 'F');
  pdf.setFillColor(231, 145, 55);
  pdf.rect(0, 36, pageWidth, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('E-SHOPPING CENTRE  /  RELATÓRIO', margin, 10);
  pdf.setFontSize(16);
  const titleLines = pdf.splitTextToSize(title, printableWidth);
  pdf.text(titleLines.slice(0, 2), margin, 20);
  if (options.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(pdf.splitTextToSize(options.subtitle, printableWidth)[0], margin, 32);
  }
  pdf.setTextColor(35, 48, 61);

  let cursorY = 44;
  const contextRows: string[][] = [];
  if (options.period) contextRows.push(['Período analisado', options.period]);
  options.filters?.forEach((filter) => contextRows.push([filter.label, String(filter.value ?? '—')]));
  contextRows.push(['Gerado em', new Date().toLocaleString('pt-MZ')]);

  if (contextRows.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('ÂMBITO DO RELATÓRIO', margin, cursorY);
    autoTable(pdf, {
      body: contextRows,
      startY: cursorY + 3,
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: printableWidth * 0.28, fontStyle: 'bold' } },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: [55, 65, 75], lineColor: [225, 230, 235], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      theme: 'grid',
    });
    cursorY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12;
    cursorY += 8;
  }

  if (options.summary?.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('RESUMO', margin, cursorY);
    autoTable(pdf, {
      head: [options.summary.map((item) => item.label)],
      body: [options.summary.map((item) => String(item.value ?? '—'))],
      startY: cursorY + 3,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, halign: 'center', textColor: [35, 48, 61], lineColor: [225, 230, 235], lineWidth: 0.2 },
      headStyles: { fillColor: [239, 243, 247], textColor: [35, 48, 61], fontStyle: 'bold' },
      theme: 'grid',
    });
    cursorY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12;
    cursorY += 8;
  }

  if (options.notes?.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('CRITÉRIOS E NOTAS', margin, cursorY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const noteLines = options.notes.flatMap((note) => pdf.splitTextToSize(`- ${note}`, printableWidth));
    pdf.text(noteLines, margin, cursorY + 4);
    cursorY += 6 + noteLines.length * 3.5;
  }

  if (cursorY > pageHeight - 28) {
    pdf.addPage();
    cursorY = margin;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('DETALHE DOS REGISTOS', margin, cursorY);
  autoTable(pdf, {
    head: [options.columns?.length === headers.length ? options.columns : headers.map((header) => header.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()))],
    body: rows.map((row) => row.map((value) => String(value ?? '—'))),
    startY: cursorY + 3,
    margin: { left: margin, right: margin, bottom: 18 },
    styles: { font: 'helvetica', fontSize: headers.length > 8 ? 6.5 : 7.5, cellPadding: 2.5, overflow: 'linebreak', textColor: [45, 55, 65], lineColor: [225, 230, 235], lineWidth: 0.15 },
    headStyles: { fillColor: [23, 50, 77], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    horizontalPageBreak: headers.length > 8,
    horizontalPageBreakRepeat: 0,
    showHead: 'everyPage',
    theme: 'grid',
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 230, 235);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(110, 120, 130);
    pdf.text('Documento gerado pela plataforma e-Shopping Centre', margin, pageHeight - 7);
    pdf.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
  pdf.save(filename);
}
