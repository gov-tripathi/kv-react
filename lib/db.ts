import { getSupabase } from './supabase';
import type { Arrangement, FormState, ReportRow } from './types';

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
