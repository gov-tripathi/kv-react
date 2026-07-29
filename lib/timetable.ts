import { TimetableRow, AbsentPeriod, ReportRow, AbsenceConfig, DutyEntry, CancelledClassConfig, AssignmentRule } from './types';

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

// True when this row needs arrangement if the teacher is absent.
export function needsArrangement(row: TimetableRow): boolean {
  if (row.Use_For_Arrangement === false) return false;
  // Covers: (a) old DB rows where subject is "Not Req" regardless of flag value,
  // (b) data corrupted by a prior buggy upload that set flag=true for these rows.
  if (row.Subject.startsWith('Not Req')) return false;
  return true;
}

// True when this row is an explicit free period (no class assigned).
export function isFreeRow(row: TimetableRow): boolean {
  return !row.Class;
}

export function getAllTeachers(df: TimetableRow[]): string[] {
  return [...new Set(df.map(r => r.Teacher_Name))].sort();
}

// A teacher is "not req" in a period when they have a class assigned but it doesn't need arrangement.
export function getNotReqTeachers(df: TimetableRow[]): Set<string> {
  return new Set(df.filter(r => !isFreeRow(r) && !needsArrangement(r)).map(r => r.Teacher_Name));
}

export function getNotReqTeachersForPeriod(df: TimetableRow[], day: string, period: number): Set<string> {
  return new Set(
    df.filter(r => r.Day === day && r.Period === period && !isFreeRow(r) && !needsArrangement(r))
      .map(r => r.Teacher_Name),
  );
}

export function getAllClasses(df: TimetableRow[]): string[] {
  const order = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return [...new Set(
    df
      .filter(r => !isFreeRow(r) && needsArrangement(r))
      .map(r => r.Class)
      .filter(cls => order.includes(cls.split(' ')[0])),
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
  maxPeriod: number = 8,
  cancelledClassConfigs: Record<string, CancelledClassConfig> = {},
): AbsentPeriod[] {
  if (!cancelledClasses.length) return [];
  return df
    .filter(r => {
      if (r.Day !== day || !cancelledClasses.includes(r.Class) || r.Period > maxPeriod) return false;
      const cfg = cancelledClassConfigs[r.Class];
      if (cfg?.halfDay) return cfg.cancelledPeriods.includes(r.Period);
      return true;
    })
    .map(r => ({ teacher: r.Teacher_Name, period: r.Period, cls: r.Class, subj: r.Subject }))
    .sort((a, b) => a.period - b.period || a.cls.localeCompare(b.cls));
}

export function busySetExcludingCancelled(
  df: TimetableRow[], day: string, period: number,
  cancelledClasses: string[], useCancelledTeachers: boolean,
  cancelledClassConfigs: Record<string, CancelledClassConfig> = {},
): Set<string> {
  // Free period rows never make a teacher busy.
  const rows = df.filter(r => r.Day === day && r.Period === period && !isFreeRow(r));
  if (!useCancelledTeachers || !cancelledClasses.length) {
    return new Set(rows.map(r => r.Teacher_Name));
  }
  const result = new Set<string>();
  for (const t of new Set(rows.map(r => r.Teacher_Name))) {
    const hasNonCancelled = rows.some(r => {
      if (r.Teacher_Name !== t) return false;
      if (!cancelledClasses.includes(r.Class)) return true;
      const cfg = cancelledClassConfigs[r.Class];
      if (cfg?.halfDay) return !cfg.cancelledPeriods.includes(period);
      return false;
    });
    if (hasNonCancelled) result.add(t);
  }
  return result;
}

export function getSchedule(df: TimetableRow[], teacher: string, day: string): TimetableRow[] {
  return df
    .filter(r => r.Teacher_Name === teacher && r.Day === day)
    .sort((a, b) => a.Period - b.Period);
}

// Free period rows (empty Class) mean the teacher is available — exclude them from busy.
export function busySet(df: TimetableRow[], day: string, period: number): Set<string> {
  return new Set(df.filter(r => r.Day === day && r.Period === period && !isFreeRow(r)).map(r => r.Teacher_Name));
}

export function teacherPeriodInfo(
  df: TimetableRow[], teacher: string, day: string, period: number,
): [string, string] {
  const row = df.find(r => r.Teacher_Name === teacher && r.Day === day && r.Period === period);
  return row ? [row.Class, row.Subject] : ['', ''];
}

// Count actual teaching/upper-class periods; exclude explicit free period rows.
export function masterLoad(df: TimetableRow[], teacher: string, day: string): number {
  return df.filter(r => r.Teacher_Name === teacher && r.Day === day && !isFreeRow(r)).length;
}

// Busy periods today: teaching + upper-class (not req), excluding free rows and cancelled classes.
export function effectiveLoad(
  df: TimetableRow[], teacher: string, day: string,
  cancelledClasses: string[] = [],
  cancelledClassConfigs: Record<string, CancelledClassConfig> = {},
): number {
  return df.filter(r => {
    if (r.Teacher_Name !== teacher || r.Day !== day || isFreeRow(r)) return false;
    if (!cancelledClasses.includes(r.Class)) return true;
    const cfg = cancelledClassConfigs[r.Class];
    if (cfg?.halfDay) return !cfg.cancelledPeriods.includes(r.Period);
    return false;
  }).length;
}

export function isTeacherAbsentInPeriod(
  teacher: string, period: number,
  absentTeachers: string[], absenceConfigs: Record<string, AbsenceConfig>,
): boolean {
  if (!absentTeachers.includes(teacher)) return false;
  const cfg = absenceConfigs[teacher];
  if (!cfg?.halfDay) return true;
  return cfg.absentPeriods?.includes(period) ?? false;
}

export function buildAbsentPeriods(
  df: TimetableRow[], teachers: string[], day: string,
  absenceConfigs: Record<string, AbsenceConfig> = {},
  cancelledClasses: string[] = [],
  maxPeriod: number = 8,
  cancelledClassConfigs: Record<string, CancelledClassConfig> = {},
): AbsentPeriod[] {
  const periods: AbsentPeriod[] = [];
  for (const t of teachers) {
    for (const row of getSchedule(df, t, day)) {
      if (isFreeRow(row) || !needsArrangement(row)) continue;
      if (row.Period > maxPeriod) continue;
      if (cancelledClasses.includes(row.Class)) {
        const cfg = cancelledClassConfigs[row.Class];
        if (!cfg?.halfDay) continue;
        if (cfg.cancelledPeriods.includes(row.Period)) continue;
      }
      if (!isTeacherAbsentInPeriod(t, row.Period, teachers, absenceConfigs)) continue;
      periods.push({ teacher: t, period: row.Period, cls: row.Class, subj: row.Subject });
    }
  }
  return periods.sort((a, b) => a.period - b.period || a.teacher.localeCompare(b.teacher));
}

export function computeSubWorkload(
  absentPeriods: AbsentPeriod[],
  subs: Record<string, string>,
  clubs: Record<string, boolean> = {},
): Record<string, number> {
  const wl: Record<string, number> = {};
  for (const e of absentPeriods) {
    const key = `${e.teacher}__${e.period}`;
    if (clubs[key]) continue; // clubbing doesn't add to period count — same physical period
    const s = subs[key] ?? '';
    if (s) wl[s] = (wl[s] ?? 0) + 1;
  }
  return wl;
}

// ─── Priority-based auto-fill helpers ────────────────────────────────────────

// Returns the rule whose teacher_pattern is a substring of the teacher's short
// name (case-insensitive). Returns undefined for unrecognised teachers.
export function findRule(teacher: string, rules: AssignmentRule[]): AssignmentRule | undefined {
  const sn = shortName(teacher).toUpperCase();
  return rules.find(r => sn.includes(r.teacher_pattern.toUpperCase()));
}

// Lower return value = higher priority. Unknown teachers → rules.length (lowest).
export function priorityIdx(teacher: string, rules: AssignmentRule[]): number {
  const rule = findRule(teacher, rules);
  return rule ? rule.priority_rank : rules.length;
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
  cancelledClassConfigs: Record<string, CancelledClassConfig> = {},
  rules: AssignmentRule[] = [],
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

  // Min free periods a teacher must keep after all assignments.
  // Returns 0 for unrecognised teachers (no constraint).
  function retainFloor(t: string): number {
    return findRule(t, rules)?.retain_floor ?? 0;
  }

  function canTakeMore(t: string): boolean {
    return origFree[t] - ((subWl[t] ?? 0) + 1) >= retainFloor(t);
  }

  // ── Force-assign rules ──
  // Any rule with force_assign_min_free set: if that teacher originally has
  // at least that many free periods and has zero assignments so far, force one.
  for (const rule of rules) {
    if (rule.force_assign_min_free == null) continue;
    const teacher = allTeachers.find(t => findRule(t, rules)?.teacher_pattern === rule.teacher_pattern);
    if (!teacher) continue;
    if ((origFree[teacher] ?? 0) < rule.force_assign_min_free) continue;
    if ((subWl[teacher] ?? 0) > 0) continue;
    for (const e of absentPeriods) {
      const key = `${e.teacher}__${e.period}`;
      if (newSubs[key]) continue;
      const busy   = busySetExcludingCancelled(df, day, e.period, cancelledClasses, useCancelledTeachers, cancelledClassConfigs);
      const absent = absentTeachers.filter(t => isTeacherAbsentInPeriod(t, e.period, absentTeachers, absenceConfigs));
      const notReq = getNotReqTeachersForPeriod(df, day, e.period);
      if (!busy.has(teacher) && !absent.includes(teacher) && !notReq.has(teacher)) {
        newSubs[key] = teacher;
        subWl[teacher] = (subWl[teacher] ?? 0) + 1;
        break;
      }
    }
  }

  // ── Main assignment loop ──
  for (const e of absentPeriods) {
    const key = `${e.teacher}__${e.period}`;
    if (newSubs[key]) continue;

    const periodBusy = busySetExcludingCancelled(df, day, e.period, cancelledClasses, useCancelledTeachers, cancelledClassConfigs);
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
      best = candidates.reduce((a, b) => priorityIdx(a, rules) <= priorityIdx(b, rules) ? a : b);
    } else {
      // Pick highest-priority eligible teacher; break ties by total workload
      best = eligible.reduce((a, b) => {
        const pa = priorityIdx(a, rules), pb = priorityIdx(b, rules);
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

export function whatsappText(rows: ReportRow[], day: string, dateStr: string, lunchDuties: DutyEntry[] = [], attendanceDuties: DutyEntry[] = []): string {
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
  if (lunchDuties.length) {
    lines.push(`🍱 *Lunch Duty*`);
    for (const d of lunchDuties) lines.push(`  ${d.cls} — *${shortName(d.teacher)}*`);
    lines.push('');
  }
  if (attendanceDuties.length) {
    lines.push(`📝 *Attendance Duty*`);
    for (const d of attendanceDuties) lines.push(`  ${d.cls} — *${shortName(d.teacher)}*`);
    lines.push('');
  }
  lines.push('_Generated by KV Burhanpur Arrangement App_');
  return lines.join('\n');
}
