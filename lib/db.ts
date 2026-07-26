import { getSupabase } from './supabase';
import type { Arrangement, FormState, ReportRow, TeacherAccount, SchoolPeriod, AssignmentRule, TimetableRow } from './types';

export async function getMyArrangements(email: string): Promise<Arrangement[]> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('created_by', email)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Arrangement[];
}

export async function getSharedArrangements(excludeEmail: string): Promise<Arrangement[]> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('is_shared', true)
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

// ── Teacher accounts ──────────────────────────────────────────────────────────

export async function getTeacherAccounts(): Promise<TeacherAccount[]> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeacherAccount[];
}

export async function createTeacherAccount(username: string, password: string, teacherName: string): Promise<TeacherAccount> {
  const { data, error } = await getSupabase()
    .from('teacher_accounts')
    .insert({ username, password, teacher_name: teacherName })
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

export async function getSharedArrangementForDate(date: string): Promise<Arrangement | null> {
  const { data, error } = await getSupabase()
    .from('arrangements')
    .select('*')
    .eq('date', date)
    .eq('is_shared', true);
  if (error || !data || data.length === 0) return null;
  const arr = data as Arrangement[];
  const concluded = arr.find(a => a.is_concluded);
  if (concluded) return concluded;
  return arr.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

// ── School periods ─────────────────────────────────────────────────────────────

export async function getPeriods(): Promise<SchoolPeriod[]> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolPeriod[];
}

export async function createPeriod(name: string, startTime: string, endTime: string, sortOrder: number): Promise<SchoolPeriod> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .insert({ name, start_time: startTime, end_time: endTime, sort_order: sortOrder })
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

export async function bulkCreatePeriods(items: { name: string; start_time: string; end_time: string; sort_order: number }[]): Promise<SchoolPeriod[]> {
  const { data, error } = await getSupabase()
    .from('school_periods')
    .insert(items)
    .select()
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchoolPeriod[];
}

// ── Timetable rows ─────────────────────────────────────────────────────────────

export async function getTimetableRows(): Promise<TimetableRow[]> {
  const { data, error } = await getSupabase()
    .from('timetable_rows')
    .select('teacher_name,day,period,class,subject');
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

export async function replaceTimetable(rows: TimetableRow[]): Promise<void> {
  const sb = getSupabase();
  const { error: delError } = await sb.from('timetable_rows').delete().gt('id', 0);
  if (delError) throw delError;
  if (!rows.length) return;
  const mapped = rows.map(r => ({
    teacher_name: r.Teacher_Name,
    day: r.Day,
    period: r.Period,
    class: r.Class,
    subject: r.Subject,
  }));
  const { error: insError } = await sb.from('timetable_rows').insert(mapped);
  if (insError) throw insError;
}

// ── Assignment rules ───────────────────────────────────────────────────────────

export async function getAssignmentRules(): Promise<AssignmentRule[]> {
  const { data, error } = await getSupabase()
    .from('assignment_rules')
    .select('*')
    .order('priority_rank', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssignmentRule[];
}

export async function replaceAssignmentRules(rules: Omit<AssignmentRule, 'id'>[]): Promise<void> {
  const sb = getSupabase();
  const { error: delError } = await sb.from('assignment_rules').delete().gt('id', 0);
  if (delError) throw delError;
  if (!rules.length) return;
  const { error: insError } = await sb.from('assignment_rules').insert(rules);
  if (insError) throw insError;
}

// Set is_concluded on a batch of arrangement IDs
export async function setConcluded(ids: string[], value: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('arrangements')
    .update({ is_concluded: value })
    .in('id', ids);
  if (error) throw error;
}

// Draft persistence (one row per user in user_drafts table)
export async function saveDraft(email: string, formState: FormState, reportRows: ReportRow[] | null): Promise<void> {
  const { error } = await getSupabase()
    .from('user_drafts')
    .upsert(
      { user_email: email, form_state: formState, report_rows: reportRows, updated_at: new Date().toISOString() },
      { onConflict: 'user_email' },
    );
  if (error) throw error;
}

export async function loadDraft(email: string): Promise<{ form_state: FormState; report_rows: ReportRow[] | null } | null> {
  const { data, error } = await getSupabase()
    .from('user_drafts')
    .select('form_state, report_rows')
    .eq('user_email', email)
    .single();
  if (error) return null;
  return data as { form_state: FormState; report_rows: ReportRow[] | null } | null;
}
