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

export interface TeacherData {
  name: string;
  periodStatus: Record<number, 'teaching' | 'sub' | 'free'>;
  periodClass: Record<number, string>;
  masterCount: number;
  subCount: number;
  freeCount: number;
}
