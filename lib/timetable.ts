import { TimetableRow, AbsentPeriod, ReportRow, AbsenceConfig } from './types';

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

export function getNotReqTeachers(df: TimetableRow[]): Set<string> {
  return new Set(df.filter(r => r.Subject === 'Not Req').map(r => r.Teacher_Name));
}

export function getNotReqTeachersForPeriod(df: TimetableRow[], day: string, period: number): Set<string> {
  return new Set(df.filter(r => r.Day === day && r.Period === period && r.Subject === 'Not Req').map(r => r.Teacher_Name));
}

export function getAllClasses(df: TimetableRow[]): string[] {
  const order = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return [...new Set(
    df
      .filter(r => r.Subject !== 'Not Req')
      .map(r => r.Class)
      .filter(cls => order.includes(cls.split(' ')[0])), // only valid Roman-numeral classes
  )].sort((a, b) => {
    const [aNum, aSec = ''] = a.split(' ');
    const [bNum, bSec = ''] = b.split(' ');
    const ai = order.indexOf(aNum), bi = order.indexOf(bNum);
    if (ai !== bi) return ai - bi;
    return aSec.localeCompare(bSec);
  });
}

export function getCancelledPeriods(
  df: TimetableRow[], cancelledClasses: string[], day: string,
): AbsentPeriod[] {
  if (!cancelledClasses.length) return [];
  return df
    .filter(r => r.Day === day && cancelledClasses.includes(r.Class))
    .map(r => ({ teacher: r.Teacher_Name, period: r.Period, cls: r.Class, subj: r.Subject }))
    .sort((a, b) => a.period - b.period || a.cls.localeCompare(b.cls));
}

export function busySetExcludingCancelled(
  df: TimetableRow[], day: string, period: number,
  cancelledClasses: string[], useCancelledTeachers: boolean,
): Set<string> {
  const rows = df.filter(r => r.Day === day && r.Period === period);
  if (!useCancelledTeachers || !cancelledClasses.length) {
    return new Set(rows.map(r => r.Teacher_Name));
  }
  const result = new Set<string>();
  for (const t of new Set(rows.map(r => r.Teacher_Name))) {
    const hasNonCancelled = rows.some(r => r.Teacher_Name === t && !cancelledClasses.includes(r.Class));
    if (hasNonCancelled) result.add(t);
  }
  return result;
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

export function isTeacherAbsentInPeriod(
  teacher: string, period: number,
  absentTeachers: string[], absenceConfigs: Record<string, AbsenceConfig>,
): boolean {
  if (!absentTeachers.includes(teacher)) return false;
  const cfg = absenceConfigs[teacher];
  if (!cfg?.halfDay) return true;
  return cfg.halfDayType === 'before' ? period <= cfg.halfDayPeriod : period > cfg.halfDayPeriod;
}

export function buildAbsentPeriods(
  df: TimetableRow[], teachers: string[], day: string,
  absenceConfigs: Record<string, AbsenceConfig> = {},
  cancelledClasses: string[] = [],
): AbsentPeriod[] {
  const periods: AbsentPeriod[] = [];
  for (const t of teachers) {
    for (const row of getSchedule(df, t, day)) {
      if (row.Subject === 'Not Req') continue;
      if (cancelledClasses.includes(row.Class)) continue;
      if (!isTeacherAbsentInPeriod(t, row.Period, teachers, absenceConfigs)) continue;
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

// ─── Priority-based auto-fill helpers ────────────────────────────────────────

// Priority sequence (lower index = higher priority).
// Each entry lists one or more substrings to match against the teacher's short
// name (uppercased). Multiple patterns handle spelling variants.
const PRIORITY_SEQ: ReadonlyArray<readonly string[]> = [
  ['MOHIT'],                    // G1 – index 0
  ['RACHN'],                    // G1 – matches RACHNA / RACHANA
  ['MADHUBALA'],                // G1
  ['SAKSHI'],                   // G1
  ['RUPESH'],                   // G1
  ['PRATIKSHA'],                // G1
  ['ARPIT'],                    // G2 – index 6
  ['DEEKSHA'],                  // G2
  ['SHUBHAM'],                  // G2
  ['SHIVA KANT', 'SHIVAKANT'], // G2
  ['DIVYANSHU'],                // G3 – index 10
  ['JITENDRA'],                 // G3
  ['STENDER'],                  // G3
  ['AMIT'],                     // G3 – index 13
];

const G3_START_IDX = 10;
const MOHIT_IDX    = 0;
const AMIT_IDX     = PRIORITY_SEQ.length - 1;

export function priorityIdx(teacher: string): number {
  const sn = shortName(teacher).toUpperCase();
  const idx = PRIORITY_SEQ.findIndex(pats => pats.some(p => sn.includes(p)));
  return idx === -1 ? PRIORITY_SEQ.length : idx; // unknown → lowest priority
}

export function autoFillAll(
  df: TimetableRow[],
  absentPeriods: AbsentPeriod[],
  absentTeachers: string[],
  day: string,
  currentSubs: Record<string, string>,
  cancelledClasses: string[] = [],
  useCancelledTeachers: boolean = false,
  absenceConfigs: Record<string, AbsenceConfig> = {},
): Record<string, string> {
  const newSubs = { ...currentSubs };
  const subWl: Record<string, number> = {};

  for (const v of Object.values(newSubs)) {
    if (v) subWl[v] = (subWl[v] ?? 0) + 1;
  }

  const allTeachers = getAllTeachers(df);

  // Original free periods (before any substitutions) per teacher on this day
  const origFree: Record<string, number> = {};
  for (const t of allTeachers) {
    origFree[t] = Math.max(0, ALL_PERIODS.length - masterLoad(df, t, day));
  }

  // Locate Mohit and Amit by priority index
  const mohitTeacher = allTeachers.find(t => priorityIdx(t) === MOHIT_IDX) ?? null;
  const amitTeacher  = allTeachers.find(t => priorityIdx(t) === AMIT_IDX)  ?? null;
  const mohitOrigFree = mohitTeacher ? origFree[mohitTeacher] : 0;
  const amitOrigFree  = amitTeacher  ? origFree[amitTeacher]  : 0;

  // Minimum free periods each teacher must retain after all assignments.
  // For Mohit this is dynamic (re-evaluated every call, so subWl is always current).
  function retainFloor(t: string): number {
    const idx = priorityIdx(t);
    if (idx >= PRIORITY_SEQ.length) return 0; // unrecognised → no constraint

    // ── Mohit exception ──
    if (t === mohitTeacher) {
      const mohitSubs = subWl[t] ?? 0;
      // Retain 2 only when Mohit originally had 4 free, has already been used
      // for 2 arrangements, AND Amit also has 4 original free periods.
      if (mohitOrigFree === 4 && mohitSubs >= 2 && amitOrigFree === 4) return 2;
      return 1; // default: Mohit retains 1
    }

    const inG3     = idx >= G3_START_IDX;
    const groupBase = inG3 ? 2 : 1;
    const isAmitT  = t === amitTeacher;
    let floor      = isAmitT ? 3 : groupBase; // Amit retains 3, others retain groupBase

    // Rule 4: teacher originally had exactly 3 free → retain 1 more than group baseline
    if (origFree[t] === 3) floor = Math.max(floor, groupBase + 1);

    return floor;
  }

  function canTakeMore(t: string): boolean {
    // After one more sub, remaining free must still meet retain floor
    return origFree[t] - ((subWl[t] ?? 0) + 1) >= retainFloor(t);
  }

  // ── Amit force rule ──
  // When Amit originally has 4 free periods he must receive at least 1 assignment.
  if (amitTeacher && amitOrigFree === 4 && (subWl[amitTeacher] ?? 0) === 0) {
    for (const e of absentPeriods) {
      const key = `${e.teacher}__${e.period}`;
      if (newSubs[key]) continue;
      const busy   = busySetExcludingCancelled(df, day, e.period, cancelledClasses, useCancelledTeachers);
      const absent = absentTeachers.filter(t => isTeacherAbsentInPeriod(t, e.period, absentTeachers, absenceConfigs));
      const notReq = getNotReqTeachersForPeriod(df, day, e.period);
      if (!busy.has(amitTeacher) && !absent.includes(amitTeacher) && !notReq.has(amitTeacher)) {
        newSubs[key] = amitTeacher;
        subWl[amitTeacher] = (subWl[amitTeacher] ?? 0) + 1;
        break;
      }
    }
  }

  // ── Main assignment loop ──
  for (const e of absentPeriods) {
    const key = `${e.teacher}__${e.period}`;
    if (newSubs[key]) continue;

    const periodBusy = busySetExcludingCancelled(df, day, e.period, cancelledClasses, useCancelledTeachers);
    const alreadyThis = new Set(
      absentPeriods
        .filter(e2 => e2.period === e.period && e2.teacher !== e.teacher)
        .map(e2 => newSubs[`${e2.teacher}__${e2.period}`] ?? '')
        .filter(Boolean),
    );
    const absentInPeriod = absentTeachers.filter(t => isTeacherAbsentInPeriod(t, e.period, absentTeachers, absenceConfigs));
    const notReqInPeriod = getNotReqTeachersForPeriod(df, day, e.period);
    const unavail        = new Set([...periodBusy, ...alreadyThis, ...absentInPeriod]);
    const candidates     = allTeachers.filter(t => !unavail.has(t) && !notReqInPeriod.has(t));

    if (!candidates.length) continue;

    // ── Single-available fallback: assign regardless of retain rules ──
    if (candidates.length === 1) {
      const t = candidates[0];
      newSubs[key] = t;
      subWl[t] = (subWl[t] ?? 0) + 1;
      continue;
    }

    // Apply retain rules
    const eligible = candidates.filter(t => canTakeMore(t));

    let best: string;
    if (!eligible.length) {
      // ── Emergency mode: retain rules suspended, pick strictly by priority ──
      best = candidates.reduce((a, b) => priorityIdx(a) <= priorityIdx(b) ? a : b);
    } else {
      // Pick highest-priority eligible teacher; break ties by total workload
      best = eligible.reduce((a, b) => {
        const pa = priorityIdx(a), pb = priorityIdx(b);
        if (pa !== pb) return pa < pb ? a : b;
        const wa = masterLoad(df, a, day) + (subWl[a] ?? 0);
        const wb = masterLoad(df, b, day) + (subWl[b] ?? 0);
        return wa <= wb ? a : b;
      });
    }

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

export function buildReportRowsWithCancelled(
  df: TimetableRow[],
  absentPeriods: AbsentPeriod[],
  cancelledPeriods: AbsentPeriod[],
  subs: Record<string, string>,
  clubs: Record<string, boolean>,
  day: string,
  dateStr: string,
): ReportRow[] {
  const subRows = buildReportRows(df, absentPeriods, subs, clubs, day, dateStr);
  const cancelRows: ReportRow[] = cancelledPeriods.map(e => ({
    Date: dateStr, Day: day, Period: e.period,
    Absent_Teacher: e.teacher, Class: e.cls, Subject: e.subj,
    Substitute: 'Class Cancelled', Type: 'CANCELLED',
    Sub_Own_Class: '', Sub_Own_Subject: '',
  }));
  return [...subRows, ...cancelRows].sort((a, b) => a.Period - b.Period || a.Class.localeCompare(b.Class));
}

export function whatsappText(rows: ReportRow[], day: string, dateStr: string): string {
  const lines: string[] = [
    `📋 *KV BURHANPUR ARRANGEMENT*`,
    `📅 ${day}, ${dateStr}`,
    '',
  ];
  const subRows = rows.filter(r => r.Type !== 'CANCELLED');
  const cancelRows = rows.filter(r => r.Type === 'CANCELLED');
  const absentList = [...new Set(subRows.map(r => r.Absent_Teacher))];
  if (absentList.length) lines.push(`🔴 Absent: ${absentList.map(shortName).join(', ')}`);
  const cancelledClassList = [...new Set(cancelRows.map(r => r.Class))];
  lines.push('');

  const periods = [...new Set(subRows.map(r => r.Period))].sort((a, b) => a - b);
  for (const p of periods) {
    lines.push(`*Period ${p}*`);
    for (const r of subRows.filter(row => row.Period === p)) {
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
  if (cancelledClassList.length) {
    for (const cls of cancelledClassList) {
      lines.push(`🚫 _${cls} has been cancelled_`);
    }
    lines.push('');
  }
  lines.push('_Generated by KV Burhanpur Arrangement App_');
  return lines.join('\n');
}
