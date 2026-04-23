import { TimetableRow, AbsentPeriod, ReportRow } from './types';

export const DAYS_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
// JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export const DAY_MAP: Record<number, string> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};

const AVATAR_COLORS = [
  '#4F46E5','#0891B2','#059669','#D97706','#DC2626',
  '#7C3AED','#DB2777','#0284C7','#65A30D','#9333EA','#EA580C','#0F766E',
];

export function avColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function avInitials(name: string): string {
  let s = name.toUpperCase();
  for (const p of ['MR. ', 'MS. ', 'MRS. ', 'DR. ']) s = s.replace(p, '');
  const parts = s.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function shortName(name: string): string {
  for (const p of ['MR. ', 'MS. ', 'MRS. ', 'DR. ']) {
    if (name.toUpperCase().startsWith(p)) return name.slice(p.length).trim();
  }
  return name.trim();
}

export function getAllTeachers(df: TimetableRow[]): string[] {
  return [...new Set(df.map(r => r.Teacher_Name))].sort();
}

export function getSchedule(df: TimetableRow[], teacher: string, day: string): TimetableRow[] {
  return df
    .filter(r => r.Teacher_Name === teacher && r.Day === day)
    .sort((a, b) => a.Period - b.Period);
}

export function busySet(df: TimetableRow[], day: string, period: number): Set<string> {
  return new Set(df.filter(r => r.Day === day && r.Period === period).map(r => r.Teacher_Name));
}

export function teacherPeriodInfo(
  df: TimetableRow[], teacher: string, day: string, period: number,
): [string, string] {
  const row = df.find(r => r.Teacher_Name === teacher && r.Day === day && r.Period === period);
  return row ? [row.Class, row.Subject] : ['', ''];
}

export function masterLoad(df: TimetableRow[], teacher: string, day: string): number {
  return df.filter(r => r.Teacher_Name === teacher && r.Day === day).length;
}

export function buildAbsentPeriods(
  df: TimetableRow[], teachers: string[], day: string,
): AbsentPeriod[] {
  const periods: AbsentPeriod[] = [];
  for (const t of teachers) {
    for (const row of getSchedule(df, t, day)) {
      periods.push({ teacher: t, period: row.Period, cls: row.Class, subj: row.Subject });
    }
  }
  return periods.sort((a, b) => a.period - b.period || a.teacher.localeCompare(b.teacher));
}

export function computeSubWorkload(
  absentPeriods: AbsentPeriod[],
  subs: Record<string, string>,
): Record<string, number> {
  const wl: Record<string, number> = {};
  for (const e of absentPeriods) {
    const s = subs[`${e.teacher}__${e.period}`] ?? '';
    if (s) wl[s] = (wl[s] ?? 0) + 1;
  }
  return wl;
}

export function autoFillAll(
  df: TimetableRow[],
  absentPeriods: AbsentPeriod[],
  absentTeachers: string[],
  day: string,
  currentSubs: Record<string, string>,
): Record<string, string> {
  const newSubs = { ...currentSubs };
  const subWl: Record<string, number> = {};

  for (const [k, v] of Object.entries(newSubs)) {
    if (v) subWl[v] = (subWl[v] ?? 0) + 1;
  }

  const allTeachers = getAllTeachers(df);

  for (const e of absentPeriods) {
    const key = `${e.teacher}__${e.period}`;
    if (newSubs[key]) continue;

    const periodBusy = busySet(df, day, e.period);
    const alreadyThis = new Set(
      absentPeriods
        .filter(e2 => e2.period === e.period && e2.teacher !== e.teacher)
        .map(e2 => newSubs[`${e2.teacher}__${e2.period}`] ?? '')
        .filter(Boolean),
    );
    const unavail = new Set([...periodBusy, ...alreadyThis, ...absentTeachers]);
    const free = allTeachers.filter(t => !unavail.has(t));
    if (!free.length) continue;

    const best = free.reduce((a, b) =>
      masterLoad(df, a, day) + (subWl[a] ?? 0) <= masterLoad(df, b, day) + (subWl[b] ?? 0) ? a : b,
    );
    newSubs[key] = best;
    subWl[best] = (subWl[best] ?? 0) + 1;
  }
  return newSubs;
}

export function buildReportRows(
  df: TimetableRow[],
  absentPeriods: AbsentPeriod[],
  subs: Record<string, string>,
  clubs: Record<string, boolean>,
  day: string,
  dateStr: string,
): ReportRow[] {
  return absentPeriods.map(e => {
    const key = `${e.teacher}__${e.period}`;
    const sub = subs[key] ?? '';
    const club = clubs[key] ?? false;
    const [tc, ts] = club ? teacherPeriodInfo(df, sub, day, e.period) : ['', ''];
    return {
      Date: dateStr,
      Day: day,
      Period: e.period,
      Absent_Teacher: e.teacher,
      Class: e.cls,
      Subject: e.subj,
      Substitute: sub,
      Type: club ? 'CLUBBED' : 'SUBSTITUTE',
      Sub_Own_Class: tc,
      Sub_Own_Subject: ts,
    };
  });
}

export function whatsappText(rows: ReportRow[], day: string, dateStr: string): string {
  const lines: string[] = [
    `📋 *KV BURHANPUR ARRANGEMENT*`,
    `📅 ${day}, ${dateStr}`,
    '',
  ];
  const absentList = [...new Set(rows.map(r => r.Absent_Teacher))];
  lines.push(`🔴 Absent: ${absentList.map(shortName).join(', ')}`);
  lines.push('');

  const periods = [...new Set(rows.map(r => r.Period))].sort((a, b) => a - b);
  for (const p of periods) {
    lines.push(`*Period ${p}*`);
    for (const r of rows.filter(row => row.Period === p)) {
      if (r.Type === 'CLUBBED') {
        const clubInfo = r.Sub_Own_Class + (r.Sub_Own_Subject ? ` · ${r.Sub_Own_Subject}` : '');
        const clubNote = clubInfo ? ` _(clubbing with ${clubInfo})_` : '';
        lines.push(`  🔀  ${r.Class} (${r.Subject}) — ${shortName(r.Absent_Teacher)} → *${shortName(r.Substitute)}*${clubNote}`);
      } else {
        lines.push(`  ✅  ${r.Class} (${r.Subject}) — ${shortName(r.Absent_Teacher)} → *${shortName(r.Substitute)}*`);
      }
    }
    lines.push('');
  }
  lines.push('_Generated by KV Burhanpur Arrangement App_');
  return lines.join('\n');
}
