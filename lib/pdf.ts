import { ReportRow, DutyEntry } from './types';
import { shortName } from './timetable';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export async function generatePDF(rows: ReportRow[], day: string, dateStr: string, lunchDuties: DutyEntry[] = [], attendanceDuties: DutyEntry[] = [], note?: string): Promise<void> {
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
  const headerH = 26;   // total header block height in mm
  let y = 12;

  // Both logos same height (20mm), vertically centred in headerH
  const logoH = 20;
  const logoY = y + (headerH - logoH) / 2;

  // KV logo: roughly square — keep 20×20
  if (kvImg) doc.addImage(kvImg, 'PNG', margin, logoY, 20, 20);

  // PM SHRI logo: landscape ~2.5:1 ratio — 20mm tall → 18mm wide keeps it proportional
  if (pmImg) doc.addImage(pmImg, 'PNG', pageW - margin - 22, logoY + 2, 22, 16);

  // Text block: 3 lines, centre them vertically in headerH
  // line1 at y+8, line2 at y+14, line3 at y+20
  const cx = pageW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text('PM SHRI KENDRIYA VIDYALAYA BURHANPUR', cx, y + 8, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('DAILY TEACHER ARRANGEMENT', cx, y + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${day}  ·  ${dateStr}  ·  Academic Year 2026-27`, cx, y + 20, { align: 'center' });

  y += headerH;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Separate cancelled rows from substitution rows
  const subRows = rows.filter(r => r.Type !== 'CANCELLED');
  const cancelledRows = rows.filter(r => r.Type === 'CANCELLED');

  // Group cancelled periods by class → one line per class
  const cancelledByClass = new Map<string, number[]>();
  for (const r of cancelledRows) {
    if (!cancelledByClass.has(r.Class)) cancelledByClass.set(r.Class, []);
    cancelledByClass.get(r.Class)!.push(r.Period);
  }

  // Sort sub rows by absent teacher, then period
  const sorted = [...subRows].sort((a, b) =>
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
      ordinal(r.Period),
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
      2: { halign: 'center', cellWidth: 10, fontStyle: 'bolditalic' },
      3: { halign: 'center', cellWidth: 20, fontStyle: 'bolditalic' },
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

  // Cancelled classes section — one line per class
  let afterTableY = (doc as any).lastAutoTable.finalY;
  if (cancelledByClass.size > 0) {
    const cancelY = afterTableY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(194, 65, 12); // orange-700
    doc.text('CANCELLED CLASSES:', margin, cancelY);

    const cancelLines = [...cancelledByClass.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, periods]) => {
        const sortedPeriods = [...periods].sort((a, b) => a - b);
        return `${cls}  (Per. ${sortedPeriods.map(ordinal).join(', ')})`;
      });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(154, 52, 18); // orange-800
    doc.text(cancelLines.join('     '), margin + 38, cancelY);
    afterTableY = cancelY + 4;
  }

  // Lunch Duty & Attendance Duty sections — rendered as tables
  const dutyGroups = [
    { label: 'LUNCH DUTY', entries: lunchDuties, headColor: [180, 83, 9] as [number, number, number] },
    { label: 'ATTENDANCE DUTY', entries: attendanceDuties, headColor: [109, 40, 217] as [number, number, number] },
  ];
  afterTableY += 6;
  for (const group of dutyGroups) {
    if (!group.entries.length) continue;

    autoTable(doc, {
      startY: afterTableY,
      head: [[group.label, 'TEACHER IN CHARGE', 'SIGN']],
      body: group.entries.map(d => [d.cls, shortName(d.teacher), '']),
      theme: 'grid',
      tableWidth: pageW - 2 * margin,
      headStyles: { fillColor: group.headColor, fontSize: 7.5, halign: 'center', fontStyle: 'bold', cellPadding: 1.5 },
      bodyStyles: { fontSize: 7.5, valign: 'middle', cellPadding: 1.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 100 },
        2: { cellWidth: 50 },
      },
      margin: { left: margin, right: margin },
    });
    afterTableY = (doc as any).lastAutoTable.finalY + 4;
  }

  // Note section — only when note is not disabled (undefined = excluded by user)
  if (note !== undefined) {
    afterTableY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('NOTES:', margin, afterTableY);

    if (note.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const wrappedNote = doc.splitTextToSize(note.trim(), pageW - margin * 2 - 22);
      doc.text(wrappedNote, margin + 22, afterTableY);
      afterTableY += wrappedNote.length * 4.5;
    } else {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.25);
      const lineW = pageW - margin * 2 - 22;
      for (let l = 0; l < 3; l++) {
        doc.line(margin + 22, afterTableY + l * 6, margin + 22 + lineW, afterTableY + l * 6);
      }
      afterTableY += 18;
    }
  }

  const finalY = afterTableY + 4;

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
  doc.text('Time-Table In-Charge (Primary)', margin + 5, footerY + 6);
  doc.text('PRINCIPAL', pageW - margin - 60, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('PM Shri KV Burhanpur', margin + 5, footerY + 11);
  doc.text('PM Shri KV Burhanpur', pageW - margin - 60, footerY + 11);

  doc.save(`arrangement_${dateStr}.pdf`);
}
