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

async function loadBrandLogo() {
  const response = await fetch('/icon.png');
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
    orientation: headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const logoData = await loadBrandLogo();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 13;
  const topMargin = 57;
  const bottomMargin = 19;
  const printableWidth = pageWidth - margin * 2;
  const navy: [number, number, number] = [23, 50, 77];
  const orange: [number, number, number] = [231, 145, 55];
  const ink: [number, number, number] = [35, 48, 61];
  const muted: [number, number, number] = [100, 116, 139];
  const border: [number, number, number] = [222, 229, 236];
  const pale: [number, number, number] = [247, 249, 251];

  pdf.setProperties({
    title,
    subject: options.subtitle || title,
    author: 'e-Shopping Centre',
    creator: 'e-Shopping Centre',
  });

  let cursorY = 62;
  const contextRows: string[][] = [];
  if (options.period) contextRows.push(['Período analisado', options.period]);
  options.filters?.forEach((filter) => contextRows.push([filter.label, String(filter.value ?? '—')]));
  contextRows.push(['Gerado em', new Date().toLocaleString('pt-MZ')]);

  if (contextRows.length) {
    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('ÂMBITO DO RELATÓRIO', margin, cursorY);
    autoTable(pdf, {
      body: contextRows,
      startY: cursorY + 3,
      margin: { left: margin, right: margin, top: topMargin, bottom: bottomMargin },
      columnStyles: { 0: { cellWidth: printableWidth * 0.27, fontStyle: 'bold', textColor: navy } },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: ink,
        lineColor: border,
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: pale },
      theme: 'plain',
    });
    cursorY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12;
    cursorY += 7;
  }

  if (options.summary?.length) {
    if (cursorY > pageHeight - 48) {
      pdf.addPage();
      cursorY = topMargin;
    }
    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('RESUMO', margin, cursorY);
    const summaryRows: string[][] = [];
    for (let index = 0; index < options.summary.length; index += 1) {
      const item = options.summary[index];
      summaryRows.push([item.label, String(item.value ?? '—')]);
    }
    autoTable(pdf, {
      body: summaryRows,
      startY: cursorY + 3,
      margin: { left: margin, right: margin, top: topMargin, bottom: bottomMargin },
      columnStyles: {
        0: { cellWidth: printableWidth * 0.62, fontStyle: 'bold', textColor: navy },
        1: { halign: 'right', fontStyle: 'bold', textColor: ink },
      },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        lineColor: border,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: pale },
      theme: 'plain',
    });
    cursorY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12;
    cursorY += 7;
  }

  if (options.notes?.length) {
    if (cursorY > pageHeight - 42) {
      pdf.addPage();
      cursorY = topMargin;
    }
    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('CRITÉRIOS E NOTAS', margin, cursorY);
    autoTable(pdf, {
      body: options.notes.map((note) => [note]),
      startY: cursorY + 3,
      margin: { left: margin, right: margin, top: topMargin, bottom: bottomMargin },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 3,
        textColor: muted,
        lineColor: border,
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: pale },
      theme: 'plain',
    });
    cursorY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12;
    cursorY += 7;
  }

  if (cursorY > pageHeight - 35) {
    pdf.addPage();
    cursorY = topMargin;
  }
  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('DETALHE DOS REGISTOS', margin, cursorY);
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
      startY: cursorY + 3,
      margin: { left: margin, right: margin, top: topMargin, bottom: bottomMargin },
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
      horizontalPageBreak: headers.length > 8,
      horizontalPageBreakRepeat: 0,
      showHead: 'everyPage',
      theme: 'striped',
    });
  } else {
    const emptyMessage = 'Não existem registos para os filtros selecionados.';
    pdf.setFillColor(...pale);
    pdf.setDrawColor(...border);
    pdf.roundedRect(margin, cursorY + 3, printableWidth, 14, 2, 2, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(emptyMessage, pageWidth / 2, cursorY + 11.5, { align: 'center' });
  }

  const pageCount = pdf.getNumberOfPages();
  const generatedAt = new Date().toLocaleString('pt-MZ');
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 54, 'F');
    pdf.setFillColor(...orange);
    pdf.rect(0, 54, pageWidth, 1.4, 'F');
    pdf.addImage(logoData, 'PNG', margin, 5, 11, 11);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text('E-SHOPPING CENTRE', margin + 14, 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.text('MARKETPLACE EM MOÇAMBIQUE', margin + 14, 13);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text('RELATÓRIO', pageWidth - margin, 8, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const periodText = options.period ? `Período: ${options.period}` : 'Período: Todo o histórico disponível';
    const periodLines = pdf.splitTextToSize(periodText, 75).slice(0, 2);
    pdf.text(periodLines, pageWidth - margin, 14, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(title.length > 65 ? 12 : 15);
    const titleWidth = printableWidth - 48;
    const titleLines = pdf.splitTextToSize(title, titleWidth).slice(0, 1);
    pdf.text(titleLines, margin, 28);
    if (options.subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      const subtitleLines = pdf.splitTextToSize(options.subtitle, titleWidth).slice(0, 1);
      pdf.text(subtitleLines, margin, 34);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text(`Gerado em ${generatedAt}`, margin, 46);
    pdf.text(`Registos: ${data.length}`, pageWidth - margin, 46, { align: 'right' });
    pdf.setDrawColor(...border);
    pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...muted);
    pdf.text('Documento gerado pela plataforma e-Shopping Centre', margin, pageHeight - 7);
    pdf.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
  pdf.save(filename);
}
