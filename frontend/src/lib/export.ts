import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export type ReportFormat = 'csv' | 'excel' | 'pdf';

type ReportValue = string | number | boolean | null | undefined;

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
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(2).font = { bold: true };
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
  pdf.setFontSize(14);
  pdf.text(title, 14, 15);
  autoTable(pdf, {
    head: [headers],
    body: rows.map((row) => row.map((value) => String(value ?? ''))),
    startY: 22,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [32, 92, 86] },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
  });
  pdf.save(filename);
}
