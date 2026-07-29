export interface TimetableRow {
  Teacher_Name: string;
  Day: string;
  Period: number;
  Class: string;
  Subject: string;
}

export interface AbsentPeriod {
  teacher: string;
  period: number;
  cls: string;
  subj: string;
}

export interface ReportRow {
  Date: string;
  Day: string;
  Period: number;
  Absent_Teacher: string;
  Class: string;
  Subject: string;
  Substitute: string;
  Type: 'SUBSTITUTE' | 'CLUBBED' | 'CANCELLED';
  Sub_Own_Class: string;
  Sub_Own_Subject: string;
}

export interface AbsenceConfig {
  halfDay: boolean;
  absentPeriods: number[];
}

export interface CancelledClassConfig {
  halfDay: boolean;
  cancelledPeriods: number[];
}

export interface DutyEntry {
  teacher: string;
  cls: string;
}

export interface TeacherData {
  name: string;
  periodStatus: Record<number, 'teaching' | 'sub' | 'clubbed' | 'free' | 'notReq' | 'absent'>;
  periodClass: Record<number, string>;
  masterCount: number;
  subCount: number;
  freeCount: number;
}

export interface FormState {
  dateVal: string;
  absentTeachers: string[];
  absenceConfigs: Record<string, AbsenceConfig>;
  cancelledClasses: string[];
  cancelledClassConfigs: Record<string, CancelledClassConfig>;
  useCancelledTeachers: boolean;
  schoolHalfDay: boolean;
  schoolHalfDayPeriod: number;
  lunchDuties: DutyEntry[];
  attendanceDuties: DutyEntry[];
  subs: Record<string, string>;
  clubs: Record<string, boolean>;
}

export interface Arrangement {
  id: string;
  title: string | null;
  date: string;
  day: string;
  created_by: string;
  form_state: FormState;
  report_rows: ReportRow[];
  is_shared: boolean;
  is_concluded: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherAccount {
  id: string;
  username: string;
  password: string;
  teacher_name: string;
  school_id: number;
  created_at: string;
}

export interface SchoolPeriod {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  created_at: string;
}

export interface AssignmentRule {
  id?: number;
  teacher_pattern: string;       // substring matched against shortName (case-insensitive)
  priority_rank: number;         // lower = assigned first
  retain_floor: number;          // min free periods the teacher must keep
  force_assign_min_free: number | null; // if origFree >= this value, force ≥1 assignment
}

export interface School {
  id: number;
  name: string;
  code: string;
  created_at: string;
}

export interface SchoolAdmin {
  id: string;
  school_id: number;
  email: string;
  password: string;
  created_at: string;
}
