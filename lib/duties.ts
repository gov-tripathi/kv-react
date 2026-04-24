import { TimetableRow, AbsentPeriod } from './types';
import { shortName, masterLoad, ALL_PERIODS } from './timetable';

// ─── Class teacher assignments ────────────────────────────────────────────────
// Key: substring of shortName(teacher).toUpperCase()
// Value: the class they are class teacher of
// Fill in the correct class for each teacher — update once per academic year.
export const CLASS_TEACHER_MAP: Record<string, string> = {
  'SAKSHI':     '',
  'RUPESH':     '',
  'PRATIKSHA':  '',
  'ARPIT':      '',
  'DEEKSHA':    '',
  'SHUBHAM':    '',
  'SHIVAKANT':  '',
  'SHIVA KANT': '',
  'DIVYANSHU':  '',
  'JITENDRA':   '',
  'STENDER':    '',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const NON_CLASS_TEACHER_PATTERNS = ['RACHN', 'MADHUBALA', 'MOHIT', 'AMIT'];

// Lunch duty priority order (Rachna → Madhubala → Mohit; Amit is excluded)
const LUNCH_PRIORITY_PATTERNS = ['RACHN', 'MADHUBALA', 'MOHIT'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function isClassTeacher(teacher: string): boolean {
  const sn = shortName(teacher).toUpperCase();
  return !NON_CLASS_TEACHER_PATTERNS.some(p => sn.includes(p));
}

export function getTeacherClass(teacher: string): string | null {
  const sn = shortName(teacher).toUpperCase();
  for (const [pattern, cls] of Object.entries(CLASS_TEACHER_MAP)) {
    if (cls && sn.includes(pattern.toUpperCase())) return cls;
  }
  return null;
}

// ─── Rule 1: Lunch Duty ───────────────────────────────────────────────────────
// Triggered when any class teacher is absent.
// Assign to whichever eligible teacher (Rachna/Madhubala/Mohit) has the most
// free periods; Rachna wins ties first, then Madhubala, then Mohit.
export function computeLunchDuty(
  df: TimetableRow[],
  absentTeachers: string[],
  allTeachers: string[],
  day: string,
): string | null {
  if (!absentTeachers.some(isClassTeacher)) return null;

  // Build eligible list in priority order, skipping absent teachers
  const eligible: string[] = [];
  for (const pattern of LUNCH_PRIORITY_PATTERNS) {
    const t = allTeachers.find(
      t => shortName(t).toUpperCase().includes(pattern) && !absentTeachers.includes(t),
    );
    if (t) eligible.push(t);
  }
  if (!eligible.length) return null;

  const freeCounts = eligible.map(t => ALL_PERIODS.length - masterLoad(df, t, day));
  const maxFree = Math.max(...freeCounts);
  // First in priority order with max free periods wins
  return eligible[freeCounts.indexOf(maxFree)];
}

// ─── Rule 2: Register Duty ───────────────────────────────────────────────────
// Triggered when any class teacher is absent.
// Whoever covers Period 1 of that class teacher's own class gets register duty.
export interface RegisterDuty {
  absentTeacher: string;
  cls: string;
  assignedTo: string | null;
}

export function computeRegisterDuties(
  absentTeachers: string[],
  subs: Record<string, string>,
  absentPeriods: AbsentPeriod[],
): RegisterDuty[] {
  const duties: RegisterDuty[] = [];
  for (const t of absentTeachers) {
    if (!isClassTeacher(t)) continue;
    const cls = getTeacherClass(t);
    if (!cls) continue;

    // Find Period 1 entry for this absent teacher where class matches their own class
    const p1 = absentPeriods.find(e => e.teacher === t && e.period === 1 && e.cls === cls);
    const assignedTo = p1 ? (subs[`${t}__1`] || null) : null;
    duties.push({ absentTeacher: t, cls, assignedTo });
  }
  return duties;
}
