import { ReportRow } from './types';
import { shortName } from './timetable';

export async function generatePDF(rows: ReportRow[], day: string, dateStr: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Load logos
  async function loadImg(path: string): Promise<string | null> {
    try {
      const res = await fetch(path);
      const blob = await res.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  const kvImg = await loadImg('/2023042075.png');
  const pmImg = await loadImg('/2025021137.png');

  const margin = 15;
  const pageW = 210;
  let y = 15;

  // Header
  if (kvImg) doc.addImage(kvImg, 'PNG', margin, y, 18, 18);
  if (pmImg) doc.addImage(pmImg, 'PNG', pageW - margin - 22, y + 2, 22, 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text('PM SHRI KENDRIYA VIDYALAYA BURHANPUR', pageW / 2, y + 5, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('DAILY TEACHER ARRANGEMENT', pageW / 2, y + 11, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${day}  ·  ${dateStr}  ·  Academic Year 2026-27`, pageW / 2, y + 17, { align: 'center' });

  y += 21;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Sort rows by absent teacher, then period
  const sorted = [...rows].sort((a, b) =>
    a.Absent_Teacher.localeCompare(b.Absent_Teacher) || a.Period - b.Period,
  );

  const tableRows = sorted.map((r, i) => {
    const subDisplay =
      r.Substitute === '— Not Assigned —' ? 'UNASSIGNED ⚠' :
      r.Type === 'CLUBBED'
        ? `${shortName(r.Substitute)}\n(clubbing: ${r.Sub_Own_Class}${r.Sub_Own_Subject ? ' · ' + r.Sub_Own_Subject : ''})`
        : shortName(r.Substitute);
    return [
      String(i + 1),
      shortName(r.Absent_Teacher),
      String(r.Period),
      r.Class,
      r.Subject,
      subDisplay,
      r.Type === 'CLUBBED' ? 'CLUB' : 'SUB',
      '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['S.No', 'Absent Teacher', 'Per.', 'Class', 'Subject', 'Substitute Teacher', 'Mode', 'Sign']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], fontSize: 7.5, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { halign: 'center', cellWidth: 10 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 22 },
      5: { cellWidth: 42 },
      6: { halign: 'center', cellWidth: 14 },
      7: { cellWidth: 20 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body') {
        const row = sorted[data.row.index];
        if (row?.Type === 'CLUBBED' && data.column.index === 5) {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        }
        if (row?.Substitute === '— Not Assigned —' && data.column.index === 5) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Footer
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, finalY, pageW - margin, finalY);

  const footerY = finalY + 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('____________________________', margin + 5, footerY);
  doc.text('____________________________', pageW - margin - 60, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Time-Table In-Charge', margin + 5, footerY + 6);
  doc.text('PRINCIPAL', pageW - margin - 60, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('PM Shri KV Burhanpur', margin + 5, footerY + 11);
  doc.text('PM Shri KV Burhanpur', pageW - margin - 60, footerY + 11);

  doc.save(`arrangement_${dateStr}.pdf`);
}
