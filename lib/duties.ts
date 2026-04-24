import { AbsentPeriod } from './types';
import { shortName } from './timetable';

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

// ─── Register Duty ───────────────────────────────────────────────────────────
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
