import { getSupabase } from './supabase';
import type { Arrangement, FormState, ReportRow, TeacherAccount, SchoolPeriod, AssignmentRule, TimetableRow, School, SchoolAdmin } from './types';

// ── Arrangements ──────────────────────────────────────────────────────────────

export async function getMyArrangements(email: string, schoolId: number): Promise<Arrangement[]> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('created_by', email)
    .eq('school_id', schoolId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Arrangement[];
}

export async function getSharedArrangements(excludeEmail: string, schoolId: number): Promise<Arrangement[]> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('is_shared', true)
    .eq('school_id', schoolId)
    .neq('created_by', excludeEmail)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Arrangement[];
}

export async function saveArrangement(payload: {
  title: string | null;
  date: string;
  day: string;
  created_by: string;
  school_id: number;
  form_state: FormState;
  report_rows: ReportRow[];
  is_shared: boolean;
}): Promise<Arrangement> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Arrangement;
}

export async function updateArrangement(
  id: string,
  updates: { title?: string | null; is_shared?: boolean; is_concluded?: boolean; form_state?: FormState; report_rows?: ReportRow[] },
): Promise<Arrangement> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Arrangement;
}

export async function deleteArrangement(id: string): Promise<void> {
  const { error } = await getSupabase().from('arrangements').delete().eq('id', id);
  if (error) throw error;
}

export async function getSharedArrangementForDate(date: string, schoolId: number): Promise<Arrangement | null> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('date', date)
    .eq('school_id', schoolId)
    .eq('is_shared', true);
  if (error || !data || data.length === 0) return null;
  const arr = data as Arrangement[];
  const concluded = arr.find(a => a.is_concluded);
  if (concluded) return concluded;
  return arr.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export async function setConcluded(ids: string[], value: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('arrangements')
    .update({ is_concluded: value })
    .in('id', ids);
  if (error) throw error;
}

// ── Teacher accounts ──────────────────────────────────────────────────────────

export async function getTeacherAccounts(schoolId: number): Promise<TeacherAccount[]> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeacherAccount[];
}

export async function createTeacherAccount(username: string, password: string, teacherName: string, schoolId: number): Promise<TeacherAccount> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .insert({ username, password, teacher_name: teacherName, school_id: schoolId })
    .select()
    .single();
  if (error) throw error;
  return data as TeacherAccount;
}

export async function updateTeacherAccount(id: string, teacherName: string): Promise<TeacherAccount> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .update({ teacher_name: teacherName })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TeacherAccount;
}

export async function deleteTeacherAccount(id: string): Promise<void> {
  const { error } = await getSupabase().from('teacher_accounts').delete().eq('id', id);
  if (error) throw error;
}

export async function loginTeacher(username: string, password: string): Promise<TeacherAccount | null> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();
  if (error) return null;
  return data as TeacherAccount;
}

// ── School periods ─────────────────────────────────────────────────────────────

export async function getPeriods(schoolId: number): Promise<SchoolPeriod[]> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolPeriod[];
}

export async function createPeriod(name: string, startTime: string, endTime: string, sortOrder: number, schoolId: number): Promise<SchoolPeriod> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .insert({ name, start_time: startTime, end_time: endTime, sort_order: sortOrder, school_id: schoolId })
    .select()
    .single();
  if (error) throw error;
  return data as SchoolPeriod;
}

export async function updatePeriod(id: string, updates: { name?: string; start_time?: string; end_time?: string }): Promise<SchoolPeriod> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SchoolPeriod;
}

export async function deletePeriod(id: string): Promise<void> {
  const { error } = await getSupabase().from('school_periods').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkCreatePeriods(items: { name: string; start_time: string; end_time: string; sort_order: number }[], schoolId: number): Promise<SchoolPeriod[]> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .insert(items.map(i => ({ ...i, school_id: schoolId })))
    .select()
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolPeriod[];
}

// ── Timetable rows ─────────────────────────────────────────────────────────────

export async function getTimetableRows(schoolId: number): Promise<TimetableRow[]> {
  const { data, error } = await getSupabase()
    .from('timetable_rows')
    .select('teacher_name,day,period,class,subject')
    .eq('school_id', schoolId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    Teacher_Name: r.teacher_name,
    Day: r.day,
    Period: r.period,
    Class: r.class,
    Subject: r.subject,
  }));
}

export async function replaceTimetable(rows: TimetableRow[], schoolId: number): Promise<void> {
  const sb = getSupabase();
  const { error: delError } = await sb.from('timetable_rows').delete().eq('school_id', schoolId);
  if (delError) throw delError;
  if (!rows.length) return;
  const mapped = rows.map(r => ({
    teacher_name: r.Teacher_Name,
    day: r.Day,
    period: r.Period,
    class: r.Class,
    subject: r.Subject,
    school_id: schoolId,
  }));
  const { error: insError } = await sb.from('timetable_rows').insert(mapped);
  if (insError) throw insError;
}

// ── Assignment rules ───────────────────────────────────────────────────────────

export async function getAssignmentRules(schoolId: number): Promise<AssignmentRule[]> {
  const { data, error } = await getSupabase()
    .from('assignment_rules')
    .select('*')
    .eq('school_id', schoolId)
    .order('priority_rank', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssignmentRule[];
}

export async function replaceAssignmentRules(rules: Omit<AssignmentRule, 'id'>[], schoolId: number): Promise<void> {
  const sb = getSupabase();
  const { error: delError } = await sb.from('assignment_rules').delete().eq('school_id', schoolId);
  if (delError) throw delError;
  if (!rules.length) return;
  const { error: insError } = await sb.from('assignment_rules').insert(rules.map(r => ({ ...r, school_id: schoolId })));
  if (insError) throw insError;
}

// ── Draft persistence ──────────────────────────────────────────────────────────

export async function saveDraft(email: string, formState: FormState, reportRows: ReportRow[] | null, schoolId: number): Promise<void> {
  const { error } = await getSupabase()
    .from('user_drafts')
    .upsert(
      { user_email: email, school_id: schoolId, form_state: formState, report_rows: reportRows, updated_at: new Date().toISOString() },
      { onConflict: 'user_email,school_id' },
    );
  if (error) throw error;
}

export async function loadDraft(email: string, schoolId: number): Promise<{ form_state: FormState; report_rows: ReportRow[] | null } | null> {
  const { data, error } = await getSupabase()
    .from('user_drafts')
    .select('form_state, report_rows')
    .eq('user_email', email)
    .eq('school_id', schoolId)
    .single();
  if (error) return null;
  return data as { form_state: FormState; report_rows: ReportRow[] | null } | null;
}

// ── Schools ────────────────────────────────────────────────────────────────────

export async function getSchools(): Promise<School[]> {
  const { data, error } = await getSupabase()
    .from('schools')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as School[];
}

export async function createSchool(name: string, code: string): Promise<School> {
  const { data, error } = await getSupabase()
    .from('schools')
    .insert({ name, code })
    .select()
    .single();
  if (error) throw error;
  return data as School;
}

export async function deleteSchool(id: number): Promise<void> {
  const { error } = await getSupabase().from('schools').delete().eq('id', id);
  if (error) throw error;
}

// ── School admins ──────────────────────────────────────────────────────────────

export async function getSchoolAdmins(schoolId: number): Promise<SchoolAdmin[]> {
  const { data, error } = await getSupabase()
    .from('school_admins')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolAdmin[];
}

export async function createSchoolAdmin(schoolId: number, email: string, password: string): Promise<SchoolAdmin> {
  const { data, error } = await getSupabase()
    .from('school_admins')
    .insert({ school_id: schoolId, email, password })
    .select()
    .single();
  if (error) throw error;
  return data as SchoolAdmin;
}

export async function deleteSchoolAdmin(id: string): Promise<void> {
  const { error } = await getSupabase().from('school_admins').delete().eq('id', id);
  if (error) throw error;
}

export async function loginSchoolAdmin(email: string, password: string): Promise<{ admin: SchoolAdmin; school: School } | null> {
  const { data: adminData, error: adminError } = await getSupabase()
    .from('school_admins')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (adminError || !adminData) return null;
  const admin = adminData as SchoolAdmin;
  const { data: schoolData, error: schoolError } = await getSupabase()
    .from('schools')
    .select('*')
    .eq('id', admin.school_id)
    .single();
  if (schoolError || !schoolData) return null;
  return { admin, school: schoolData as School };
}
