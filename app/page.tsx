'use client';

import { useState, useEffect, useRef, useMemo, useCallback, FormEvent } from 'react';
import Papa from 'papaparse';
// ── Lightweight design primitives (no external lib, avoids React Aria compat issues)
function Btn({ children, variant = 'primary', size = 'md', disabled = false, type = 'button', onPress, onClick, className = '', style }: {
  children: React.ReactNode; variant?: 'primary'|'secondary'|'ghost'|'outline'|'danger-soft';
  size?: 'sm'|'md'|'lg'; disabled?: boolean; type?: 'button'|'submit'; onPress?: () => void; onClick?: () => void; className?: string; style?: React.CSSProperties;
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400 shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-300',
    ghost: 'hover:bg-white/10 text-inherit focus:ring-white/20',
    outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700 focus:ring-blue-400',
    'danger-soft': 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:ring-red-400',
  };
  return (
    <button type={type} disabled={disabled} onClick={onPress ?? onClick} style={style}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function StatusChip({ children, color = 'default', size = 'md' }: {
  children: React.ReactNode; color?: 'default'|'danger'|'success'|'warning'|'accent'; size?: 'sm'|'md';
}) {
  const colors = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    accent: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const sizes = { sm: 'text-[11px] px-2 py-0.5', md: 'text-xs px-2.5 py-0.5' };
  return (
    <span className={`inline-flex items-center font-semibold border rounded-full ${sizes[size]} ${colors[color]}`}>
      {children}
    </span>
  );
}

function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm'|'md'|'lg'; className?: string }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-7 h-7 border-[3px]', lg: 'w-10 h-10 border-4' };
  return (
    <span className={`inline-block ${sizes[size]} border-blue-500 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

function KvProgressBar({ value, color = 'default' }: { value: number; color?: 'default'|'success'|'warning'|'danger' }) {
  const colors = { default: 'bg-blue-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' };
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${colors[color]}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
import {
  TimetableRow, AbsentPeriod, ReportRow, TeacherData, DutyEntry,
} from '@/lib/types';
import {
  ALL_PERIODS, DAY_MAP,
  avColor, avInitials, shortName, getAllTeachers, getAllClasses,
  getSchedule, busySetExcludingCancelled, teacherPeriodInfo, effectiveLoad,
  buildAbsentPeriods, getCancelledPeriods, computeSubWorkload, autoFillAll,
  buildReportRowsWithCancelled, whatsappText, isTeacherAbsentInPeriod,
  getNotReqTeachersForPeriod, priorityIdx, isNotReq,
} from '@/lib/timetable';
import type { AbsenceConfig } from '@/lib/types';
import { generatePDF } from '@/lib/pdf';
import { computeRegisterDuties } from '@/lib/duties';
import type { RegisterDuty } from '@/lib/duties';

const USERS: Record<string, string> = {
  'iamgovind560@gmail.com': 'govind@kv2025',
  'nt4472@gmail.com': 'nt4472@6065',
};

// ── Reusable toggle switch ────────────────────────────────────────────────────
function Toggle({ on, onToggle, accent = 'blue' }: { on: boolean; onToggle: () => void; accent?: 'blue' | 'green' | 'amber' }) {
  const colors = { blue: 'bg-blue-500', green: 'bg-emerald-500', amber: 'bg-amber-500' };
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${on ? colors[accent] : 'bg-slate-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── Styled select wrapper ─────────────────────────────────────────────────────
function SelectField({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <select {...props}
        className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer hover:border-slate-300">
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (USERS[email.trim()] === password) {
      setLoading(true);
      setTimeout(() => {
        try { localStorage.setItem('kv_auth', email.trim()); } catch {}
        onLogin();
      }, 400);
    } else {
      setError('Invalid email or password.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #1D4ED8 100%)' }}>
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-4 mb-4">
            <img src="/2023042075.png" alt="KV Logo"
              className="h-14 w-auto drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.5)) brightness(1.15)' }} />
            <img src="/2025021137.png" alt="PM SHRI Logo"
              className="h-11 w-auto drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.5)) brightness(1.15)' }} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">KV Burhanpur</h1>
          <p className="text-blue-300/80 text-sm mt-1 font-medium">Teacher Arrangement System</p>
          <p className="text-blue-400/50 text-xs mt-0.5">2026–27</p>
        </div>

        <div className="rounded-2xl border border-white/10 shadow-2xl p-6"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-blue-200/80 mb-1.5 tracking-wide">Email address</label>
              <input type="email" value={email} placeholder="you@example.com" autoComplete="email"
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-200/80 mb-1.5 tracking-wide">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} placeholder="••••••••" autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-3.5 py-2.5 pr-16 rounded-xl border border-white/15 bg-white/8 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-transparent transition-all" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-300/70 hover:text-blue-200 transition-colors">
                  {showPw ? 'hide' : 'show'}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/15 border border-red-400/30 rounded-lg">
                <span className="text-red-400 text-xs">●</span>
                <span className="text-red-300 text-xs font-medium">{error}</span>
              </div>
            )}
            <Btn type="submit" variant="primary" className="w-full mt-1 h-11" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" className="border-white/70 border-t-transparent" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const subKey = (teacher: string, period: number) => `${teacher}__${period}`;

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{children}</p>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    try { setAuthed(!!localStorage.getItem('kv_auth')); } catch { setAuthed(false); }
  }, []);
  const [df, setDf] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'arrangement' | 'status'>('arrangement');

  // Restore session from localStorage (persists across page refreshes)
  const ss = (() => {
    try { return JSON.parse(localStorage.getItem('kv_form_state') || 'null') ?? {}; }
    catch { return {}; }
  })();

  const [dateVal, setDateVal] = useState<string>(ss.dateVal ?? todayDate);
  const selectedDay = useMemo(() => {
    const d = new Date(dateVal + 'T00:00:00');
    return DAY_MAP[d.getDay()] ?? 'MON';
  }, [dateVal]);
  const [absentTeachers, setAbsentTeachers] = useState<string[]>(ss.absentTeachers ?? []);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [absenceConfigs, setAbsenceConfigs] = useState<Record<string, AbsenceConfig>>(ss.absenceConfigs ?? {});
  const [cancelledClasses, setCancelledClasses] = useState<string[]>(ss.cancelledClasses ?? []);
  const [useCancelledTeachers, setUseCancelledTeachers] = useState<boolean>(ss.useCancelledTeachers ?? false);
  const [schoolHalfDay, setSchoolHalfDay] = useState<boolean>(ss.schoolHalfDay ?? false);
  const [schoolHalfDayPeriod, setSchoolHalfDayPeriod] = useState<number>(ss.schoolHalfDayPeriod ?? 4);
  const [lunchDuties, setLunchDuties] = useState<DutyEntry[]>(ss.lunchDuties ?? []);
  const [attendanceDuties, setAttendanceDuties] = useState<DutyEntry[]>(ss.attendanceDuties ?? []);
  const [lunchTeacher, setLunchTeacher] = useState('');
  const [lunchClass, setLunchClass] = useState('');
  const [attendanceTeacher, setAttendanceTeacher] = useState('');
  const [attendanceClass, setAttendanceClass] = useState('');
  const [subs, setSubs] = useState<Record<string, string>>(ss.subs ?? {});
  const [clubs, setClubs] = useState<Record<string, boolean>>(ss.clubs ?? {});
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [log, setLog] = useState<ReportRow[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    fetch('/timetable_master.csv').then(r => r.text()).then(csv => {
      const result = Papa.parse<TimetableRow>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      setDf(result.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kv_arrangement_log');
      if (saved) setLog(JSON.parse(saved));
    } catch {}
  }, []);

  // Save form state on every change so it survives a page refresh
  useEffect(() => {
    try {
      localStorage.setItem('kv_form_state', JSON.stringify({
        dateVal, absentTeachers, absenceConfigs, cancelledClasses,
        useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
        lunchDuties, attendanceDuties, subs, clubs,
      }));
    } catch {}
  }, [dateVal, absentTeachers, absenceConfigs, cancelledClasses, useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod, lunchDuties, attendanceDuties, subs, clubs]);

  const allTeachers = useMemo(() => getAllTeachers(df), [df]);
  const allClasses = useMemo(() => getAllClasses(df), [df]);
  const schoolMaxPeriod = schoolHalfDay ? schoolHalfDayPeriod : 8;

  const absentPeriods = useMemo(
    () => buildAbsentPeriods(df, absentTeachers, selectedDay, absenceConfigs, cancelledClasses, schoolMaxPeriod),
    [df, absentTeachers, selectedDay, absenceConfigs, cancelledClasses, schoolMaxPeriod],
  );

  const cancelledPeriods = useMemo(
    () => getCancelledPeriods(df, cancelledClasses, selectedDay, schoolMaxPeriod),
    [df, cancelledClasses, selectedDay, schoolMaxPeriod],
  );

  // These refs prevent the reset effects from wiping restored localStorage state on mount
  const skipSubsReset = useRef(true);
  const skipDayReset = useRef(true);

  useEffect(() => {
    if (skipSubsReset.current) { skipSubsReset.current = false; return; }
    setSubs({}); setClubs({}); setReport(null);
  }, [selectedDay, absentTeachers]);
  useEffect(() => {
    if (skipDayReset.current) { skipDayReset.current = false; return; }
    setCancelledClasses([]); setUseCancelledTeachers(false);
    setAbsenceConfigs({}); setSchoolHalfDay(false); setSchoolHalfDayPeriod(4);
    setLunchDuties([]); setAttendanceDuties([]);
    setLunchTeacher(''); setLunchClass('');
    setAttendanceTeacher(''); setAttendanceClass('');
  }, [selectedDay]);

  const subWl = useMemo(() => computeSubWorkload(absentPeriods, subs, clubs), [absentPeriods, subs, clubs]);
  const covered = useMemo(
    () => absentPeriods.filter(e => !!subs[subKey(e.teacher, e.period)]).length,
    [absentPeriods, subs],
  );
  const registerDuties = useMemo(
    () => computeRegisterDuties(absentTeachers, subs, absentPeriods),
    [absentTeachers, subs, absentPeriods],
  );

  const handleAutoFill = useCallback(() => {
    const newSubs = autoFillAll(df, absentPeriods, absentTeachers, selectedDay, subs, cancelledClasses, useCancelledTeachers, absenceConfigs);
    setSubs(newSubs); setReport(null);
  }, [df, absentPeriods, absentTeachers, selectedDay, subs, cancelledClasses, useCancelledTeachers, absenceConfigs]);

  const handleReset = useCallback(() => {
    setSubs({}); setClubs({}); setReport(null);
  }, []);

  const handleSetSub = useCallback((teacher: string, period: number, val: string) => {
    setSubs(prev => ({ ...prev, [subKey(teacher, period)]: val })); setReport(null);
  }, []);

  const handleSetClub = useCallback((teacher: string, period: number, val: boolean) => {
    setClubs(prev => ({ ...prev, [subKey(teacher, period)]: val }));
    setSubs(prev => ({ ...prev, [subKey(teacher, period)]: '' })); setReport(null);
  }, []);

  const handleGenerateReport = useCallback(() => {
    const rows = buildReportRowsWithCancelled(df, absentPeriods, cancelledPeriods, subs, clubs, selectedDay, dateVal);
    setReport(rows);
    const newLog = [...log, ...rows];
    setLog(newLog);
    try { localStorage.setItem('kv_arrangement_log', JSON.stringify(newLog)); } catch {}
  }, [df, absentPeriods, cancelledPeriods, subs, clubs, selectedDay, dateVal, log]);

  const handleDownloadPDF = useCallback(async (note: string | null) => {
    if (!report) return;
    setPdfLoading(true);
    await generatePDF(report, selectedDay, dateVal, lunchDuties, attendanceDuties, note ?? undefined);
    setPdfLoading(false);
  }, [report, selectedDay, dateVal, lunchDuties, attendanceDuties]);

  const handleDownloadCSV = useCallback(() => {
    if (!report) return;
    const headers = Object.keys(report[0]).join(',');
    const body = report.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `arrangement_${dateVal}.csv`; a.click(); URL.revokeObjectURL(url);
  }, [report, dateVal]);

  const handleDownloadLog = useCallback(() => {
    if (!log.length) return;
    const headers = Object.keys(log[0]).join(',');
    const body = log.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = 'arrangements_log.csv'; a.click(); URL.revokeObjectURL(url);
  }, [log]);

  if (authed === null) return null;
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-slate-500 text-sm mt-4 font-medium">Loading timetable…</p>
      </div>
    </div>
  );

  const filteredTeachers = allTeachers.filter(
    t => !absentTeachers.includes(t) && t.toLowerCase().includes(teacherSearch.toLowerCase()),
  );

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      {/* Global datalist for teacher name autocomplete (used by duty + custom sub inputs) */}
      <datalist id="kv-teacher-names">
        {allTeachers.map(t => <option key={t} value={shortName(t)} />)}
      </datalist>
      <div className="max-w-3xl mx-auto px-3 py-4 pb-24">

        {/* ── Header ── */}
        <div className="relative rounded-3xl px-5 pt-5 pb-5 mb-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%)', boxShadow: '0 8px 32px rgba(37,99,235,.3)' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />
          </div>
          <button onClick={() => { try { localStorage.removeItem('kv_auth'); } catch {} setAuthed(false); }}
            className="absolute top-3 right-3 text-white/60 hover:text-white hover:bg-white/10 text-xs font-semibold border border-white/15 h-7 px-3 rounded-full transition-all">
            Sign out
          </button>
          <div className="flex flex-col items-center gap-2 relative z-10">
            <div className="flex items-center gap-4">
              <img src="/2023042075.png" alt="KV Logo" className="h-11 w-auto"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.4)) brightness(1.1)' }} />
              <div className="text-center">
                <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">KV Burhanpur</h1>
                <p className="text-blue-300/50 text-[10px] font-medium tracking-widest uppercase">PM SHRI Kendriya Vidyalaya</p>
              </div>
              <img src="/2025021137.png" alt="PM SHRI Logo" className="h-9 w-auto"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.4)) brightness(1.1)' }} />
            </div>
            <p className="text-blue-300/50 text-xs tracking-wide">Teacher Arrangement &amp; Substitution · 2026-27</p>
          </div>
        </div>

        {/* ── Morning Setup ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <SectionLabel>Morning Setup</SectionLabel>

          {/* Date */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-600">Date</label>
              <StatusChip color="accent" size="sm">{selectedDay}</StatusChip>
            </div>
            <input type="date" value={dateVal}
              onChange={e => { setDateVal(e.target.value); setAbsentTeachers([]); }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>

          {/* Absent Teachers */}
          <div className="mb-1">
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Mark Teachers Absent</label>
            <div className="relative">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search or tap to see all teachers…"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  onFocus={() => setShowTeacherDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTeacherDropdown(false), 150)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" />
              </div>
              {showTeacherDropdown && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {filteredTeachers.map(t => (
                    <button key={t} onMouseDown={e => e.preventDefault()}
                      onClick={() => { setAbsentTeachers(prev => [...prev, t]); setTeacherSearch(''); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: avColor(t) }}>
                        {avInitials(t)}
                      </span>
                      {shortName(t)}
                    </button>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <div className="px-3 py-3 text-sm text-slate-400 text-center">No teachers found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Absent teacher chips */}
          {absentTeachers.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {absentTeachers.map(t => (
                <span key={t} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full pl-2 pr-1 py-0.5 text-xs font-semibold">
                  <span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: avColor(t) }}>{avInitials(t)}</span>
                  {shortName(t)}
                  <button onClick={() => setAbsentTeachers(prev => prev.filter(x => x !== t))}
                    className="ml-0.5 w-4 h-4 rounded-full text-red-400 hover:text-white hover:bg-red-500 flex items-center justify-center transition-colors text-xs leading-none flex-shrink-0">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Per-teacher half-day config */}
          {absentTeachers.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {absentTeachers.map(t => {
                const cfg: AbsenceConfig = absenceConfigs[t] ?? { halfDay: false, absentPeriods: [] };
                const schedule = getSchedule(df, t, selectedDay);
                const allPeriods = Array.from({ length: schoolMaxPeriod }, (_, i) => i + 1);
                return (
                  <div key={t} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{shortName(t)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${cfg.halfDay ? 'text-amber-600' : 'text-slate-400'}`}>
                          {cfg.halfDay ? 'Half Day' : 'Full Day'}
                        </span>
                        <Toggle on={cfg.halfDay} accent="amber"
                          onToggle={() => {
                            setAbsenceConfigs(prev => ({ ...prev, [t]: { ...cfg, halfDay: !cfg.halfDay, absentPeriods: [] } }));
                            setReport(null);
                          }} />
                      </div>
                    </div>
                    {cfg.halfDay && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Tap periods teacher is <strong>absent</strong> for:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allPeriods.map(p => {
                            const row = schedule.find(r => r.Period === p);
                            const isTeaching = row && !isNotReq(row.Subject);
                            const label = isTeaching ? row.Class : 'Free';
                            const isAbsent = cfg.absentPeriods?.includes(p) ?? false;
                            return (
                              <button key={p}
                                onClick={() => {
                                  const current = cfg.absentPeriods ?? [];
                                  const next = isAbsent ? current.filter(pp => pp !== p) : [...current, p];
                                  setAbsenceConfigs(prev => ({ ...prev, [t]: { ...cfg, absentPeriods: next } }));
                                  setReport(null);
                                }}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all min-h-[32px] ${
                                  isAbsent
                                    ? 'bg-red-500 text-white border-red-500 shadow-sm'
                                    : isTeaching
                                      ? 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600'
                                      : 'bg-white text-slate-300 border-slate-150 hover:border-red-200 hover:text-red-400'
                                }`}>
                                P{p} · {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* School Half Day */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">School Half Day</p>
                {schoolHalfDay && (
                  <p className="text-xs text-blue-600 mt-0.5">Periods {schoolHalfDayPeriod + 1}–8 skipped</p>
                )}
              </div>
              <Toggle on={schoolHalfDay} onToggle={() => { setSchoolHalfDay(v => !v); setReport(null); }} />
            </div>
            {schoolHalfDay && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-sm text-slate-500">School runs up to period</span>
                <SelectField value={schoolHalfDayPeriod} onChange={e => { setSchoolHalfDayPeriod(Number(e.target.value)); setReport(null); }}
                  className="w-20">
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                </SelectField>
              </div>
            )}
          </div>

          {/* Cancel Classes */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-600 mb-2">Cancel Classes</label>
            <SelectField value="" onChange={e => {
              const cls = e.target.value;
              if (cls && !cancelledClasses.includes(cls)) { setCancelledClasses(prev => [...prev, cls]); setReport(null); }
            }}>
              <option value="">Select a class to cancel…</option>
              {allClasses.filter(c => !cancelledClasses.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            {cancelledClasses.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {cancelledClasses.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 pr-1 py-0.5 text-xs font-semibold">
                      {c}
                      <button onClick={() => { setCancelledClasses(prev => prev.filter(x => x !== c)); setReport(null); }}
                        className="ml-0.5 w-4 h-4 rounded-full text-orange-400 hover:text-white hover:bg-orange-500 flex items-center justify-center transition-colors text-xs leading-none flex-shrink-0">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <Toggle on={useCancelledTeachers} accent="green" onToggle={() => setUseCancelledTeachers(v => !v)} />
                  <span className="text-xs font-medium text-slate-600">Use freed teachers in arrangement</span>
                </div>
              </>
            )}
          </div>

          {/* Lunch Duty */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-600 mb-2">🍱 Lunch Duty</label>
            <div className="flex gap-2">
              <input type="text" list="kv-teacher-names" value={lunchTeacher}
                onChange={e => setLunchTeacher(e.target.value)}
                placeholder="Teacher name…"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" />
              <SelectField value={lunchClass} onChange={e => setLunchClass(e.target.value)} className="flex-1">
                <option value="">Class…</option>
                {allClasses.filter(c => !lunchDuties.some(d => d.cls === c)).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>
              <Btn size="sm" disabled={!lunchTeacher || !lunchClass} onClick={() => {
                if (lunchTeacher && lunchClass) {
                  setLunchDuties(prev => [...prev, { teacher: lunchTeacher, cls: lunchClass }]);
                  setLunchTeacher(''); setLunchClass('');
                }
              }}>Add</Btn>
            </div>
            {lunchDuties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {lunchDuties.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 pr-1 py-0.5 text-xs font-semibold">
                    {shortName(d.teacher)} · {d.cls}
                    <button onClick={() => setLunchDuties(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 w-4 h-4 rounded-full text-amber-500 hover:text-white hover:bg-amber-500 flex items-center justify-center transition-colors text-xs leading-none flex-shrink-0">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Duty */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-600 mb-2">📝 Attendance Duty</label>
            <div className="flex gap-2">
              <input type="text" list="kv-teacher-names" value={attendanceTeacher}
                onChange={e => setAttendanceTeacher(e.target.value)}
                placeholder="Teacher name…"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" />
              <SelectField value={attendanceClass} onChange={e => setAttendanceClass(e.target.value)} className="flex-1">
                <option value="">Class…</option>
                {allClasses.filter(c => !attendanceDuties.some(d => d.cls === c)).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>
              <Btn size="sm" disabled={!attendanceTeacher || !attendanceClass} onClick={() => {
                if (attendanceTeacher && attendanceClass) {
                  setAttendanceDuties(prev => [...prev, { teacher: attendanceTeacher, cls: attendanceClass }]);
                  setAttendanceTeacher(''); setAttendanceClass('');
                }
              }}>Add</Btn>
            </div>
            {attendanceDuties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attendanceDuties.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full px-2 pr-1 py-0.5 text-xs font-semibold">
                    {shortName(d.teacher)} · {d.cls}
                    <button onClick={() => setAttendanceDuties(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 w-4 h-4 rounded-full text-purple-500 hover:text-white hover:bg-purple-500 flex items-center justify-center transition-colors text-xs leading-none flex-shrink-0">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1 mb-4 flex gap-1">
          {(['arrangement', 'status'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {tab === 'arrangement' ? '📋  Arrangement' : '👥  Teacher Status'}
            </button>
          ))}
        </div>

        {/* ── Arrangement Tab ── */}
        {activeTab === 'arrangement' && (
          <ArrangementTab
            df={df} absentTeachers={absentTeachers} absentPeriods={absentPeriods}
            absenceConfigs={absenceConfigs}
            cancelledClasses={cancelledClasses} cancelledPeriods={cancelledPeriods}
            useCancelledTeachers={useCancelledTeachers}
            selectedDay={selectedDay} dateVal={dateVal}
            subs={subs} clubs={clubs} subWl={subWl} covered={covered}
            registerDuties={registerDuties}
            lunchDuties={lunchDuties} attendanceDuties={attendanceDuties}
            report={report} pdfLoading={pdfLoading}
            log={log} showLog={showLog} setShowLog={setShowLog}
            onAutoFill={handleAutoFill}
            onReset={handleReset}
            onSetSub={handleSetSub} onSetClub={handleSetClub}
            onGenerateReport={handleGenerateReport}
            onDownloadPDF={handleDownloadPDF}
            onDownloadCSV={handleDownloadCSV}
            onDownloadLog={handleDownloadLog}
          />
        )}

        {/* ── Teacher Status Tab ── */}
        {activeTab === 'status' && (
          <TeacherStatusTab
            df={df} allTeachers={allTeachers}
            absentTeachers={absentTeachers} absentPeriods={absentPeriods}
            absenceConfigs={absenceConfigs}
            selectedDay={selectedDay} subs={subs} clubs={clubs}
            cancelledClasses={cancelledClasses}
            schoolMaxPeriod={schoolMaxPeriod}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arrangement Tab
// ─────────────────────────────────────────────────────────────────────────────
interface ArrProps {
  df: TimetableRow[]; absentTeachers: string[]; absentPeriods: AbsentPeriod[];
  absenceConfigs: Record<string, AbsenceConfig>;
  cancelledClasses: string[]; cancelledPeriods: AbsentPeriod[];
  useCancelledTeachers: boolean;
  selectedDay: string; dateVal: string;
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>; covered: number;
  registerDuties: RegisterDuty[];
  lunchDuties: DutyEntry[]; attendanceDuties: DutyEntry[];
  report: ReportRow[] | null; pdfLoading: boolean;
  log: ReportRow[]; showLog: boolean; setShowLog: (v: boolean) => void;
  onAutoFill: () => void;
  onReset: () => void;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
  onGenerateReport: () => void;
  onDownloadPDF: (note: string | null) => void;
  onDownloadCSV: () => void;
  onDownloadLog: () => void;
}

function ArrangementTab({
  df, absentTeachers, absentPeriods,
  absenceConfigs, cancelledClasses, cancelledPeriods, useCancelledTeachers,
  selectedDay, dateVal, subs, clubs, subWl, covered, registerDuties,
  lunchDuties, attendanceDuties,
  report, pdfLoading, log, showLog, setShowLog,
  onAutoFill, onReset, onSetSub, onSetClub, onGenerateReport,
  onDownloadPDF, onDownloadCSV, onDownloadLog,
}: ArrProps) {
  const [copied, setCopied] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);

  function countWords(text: string) {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (countWords(val) <= 75) setReportNote(val);
  }

  function handleCopyWA() {
    if (!report) return;
    navigator.clipboard.writeText(whatsappText(report, selectedDay, dateVal, lunchDuties, attendanceDuties)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!absentTeachers.length && !cancelledClasses.length) return (
    <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="text-5xl mb-3">☀️</div>
      <div className="font-bold text-slate-700">Good morning!</div>
      <div className="text-sm text-slate-400 mt-1">Mark absent teachers or cancel classes above to begin.</div>
    </div>
  );

  if (!absentPeriods.length && !cancelledPeriods.length) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
      None of the selected teachers / classes have periods on <strong>{selectedDay}</strong>.
    </div>
  );

  const total = absentPeriods.length;
  const pct = total ? covered / total : 0;

  return (
    <>
      {/* Cancelled classes card */}
      {cancelledPeriods.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <SectionLabel>
            <span className="text-orange-500">Cancelled · {cancelledClasses.join(', ')}</span>
            {useCancelledTeachers && <span className="ml-2 normal-case font-semibold text-emerald-600"> · freed teachers available</span>}
          </SectionLabel>
          {[...new Set(cancelledPeriods.map(e => e.period))].sort((a, b) => a - b).map(p => (
            <div key={p} className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="text-xs font-bold text-orange-700 w-14 flex-shrink-0">Period {p}</span>
              {cancelledPeriods.filter(e => e.period === p).map(e => (
                <span key={e.teacher + e.period} className="text-xs bg-orange-100 text-orange-800 border border-orange-200 rounded-full px-2 py-0.5">
                  {e.cls} · {e.subj} <span className="text-orange-400">({shortName(e.teacher)})</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Progress card */}
      {absentPeriods.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
          {/* Stats row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-800">{covered}</span>
                <span className="text-lg font-semibold text-slate-300">/ {total}</span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Periods covered</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-red-500">{total - covered}</div>
                <div className="text-xs text-slate-400 font-medium">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-emerald-500">{absentTeachers.length}</div>
                <div className="text-xs text-slate-400 font-medium">Absent</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <KvProgressBar value={Math.round(pct * 100)}
            color={pct >= 1 ? 'success' : pct >= 0.5 ? 'warning' : 'danger'} />
          <p className="text-xs text-slate-400 mt-1 mb-4 text-right">{Math.round(pct * 100)}% complete</p>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={onAutoFill}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #1E40AF, #2563EB)', boxShadow: '0 4px 14px rgba(37,99,235,.35)' }}>
              <span className="text-base">⚡</span>
              Auto-Fill All Periods
            </button>
            <button onClick={onReset} disabled={covered === 0}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-red-50 text-red-600 border-red-200 hover:bg-red-100 active:scale-[0.98]">
              <span>↺</span> Reset
            </button>
          </div>
        </div>
      )}

      {/* Per-teacher cards */}
      {absentTeachers.map(teacher => {
        const tPeriods = absentPeriods.filter(e => e.teacher === teacher);
        if (!tPeriods.length) return null;
        const tCov = tPeriods.filter(e => !!subs[subKey(e.teacher, e.period)]).length;
        const allDone = tCov === tPeriods.length;

        return (
          <div key={teacher} className={`bg-white rounded-2xl mb-4 shadow-sm border overflow-hidden ${allDone ? 'border-emerald-200' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                style={{ background: avColor(teacher) }}>
                {avInitials(teacher)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm">{shortName(teacher)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{tPeriods.length} periods · {tCov}/{tPeriods.length} assigned</div>
              </div>
              {allDone && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Done</span>
              )}
            </div>
            {tPeriods.map(e => (
              <PeriodRow key={e.period}
                df={df} e={e} teacher={teacher} selectedDay={selectedDay}
                absentTeachers={absentTeachers} absentPeriods={absentPeriods}
                absenceConfigs={absenceConfigs}
                cancelledClasses={cancelledClasses} useCancelledTeachers={useCancelledTeachers}
                subs={subs} clubs={clubs} subWl={subWl}
                onSetSub={onSetSub} onSetClub={onSetClub}
              />
            ))}
          </div>
        );
      })}

      {/* Duties card */}
      {registerDuties.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
          <SectionLabel>Duties</SectionLabel>
          {registerDuties.map(d => (
            <div key={d.cls} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <span className="text-xl flex-shrink-0">📋</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">
                  Register Duty <span className="font-normal text-slate-400 text-xs">· {d.cls}</span>
                </div>
                <div className="text-xs text-slate-400">{shortName(d.absentTeacher)} absent</div>
              </div>
              <span className={`text-xs font-bold border rounded-lg px-2.5 py-1 flex-shrink-0 ${
                d.assignedTo ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-red-500 bg-red-50 border-red-200'
              }`}>
                {d.assignedTo ? shortName(d.assignedTo) : '— P1 unassigned —'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Generate report CTA */}
      <button onClick={onGenerateReport}
        className="w-full py-4 rounded-2xl font-extrabold text-white text-sm mb-4 transition-all hover:opacity-95 active:scale-[0.99] tracking-wide"
        style={{ background: 'linear-gradient(135deg, #1E40AF, #2563EB, #3B82F6)', boxShadow: '0 6px 20px rgba(37,99,235,.35)' }}>
        📋 Finalise &amp; Generate Report
      </button>

      {/* Report */}
      {report && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
          <SectionLabel>Arrangement Sheet · {selectedDay} {dateVal}</SectionLabel>
          {(() => {
            const subReport = report.filter(r => r.Type !== 'CANCELLED');
            const cancelReport = report.filter(r => r.Type === 'CANCELLED');
            const cancelledByClass = new Map<string, number[]>();
            for (const r of cancelReport) {
              if (!cancelledByClass.has(r.Class)) cancelledByClass.set(r.Class, []);
              cancelledByClass.get(r.Class)!.push(r.Period);
            }
            return (
              <>
                <div className="overflow-x-auto mb-4 rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #1E40AF, #2563EB)' }}>
                        {['Per.', 'Absent Teacher', 'Class', 'Substitute', 'Mode'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-bold text-white text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subReport.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-3 py-2.5 font-bold text-blue-700">{r.Period}</td>
                          <td className="px-3 py-2.5 text-slate-600">{shortName(r.Absent_Teacher)}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-700">{r.Class}</td>
                          <td className="px-3 py-2.5">
                            {r.Type === 'CLUBBED'
                              ? <span className="text-amber-700 font-semibold">🔀 {shortName(r.Substitute)}{r.Sub_Own_Class ? ` (${r.Sub_Own_Class})` : ''}</span>
                              : <span className="font-semibold text-slate-800">{shortName(r.Substitute)}</span>
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.Type === 'CLUBBED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {r.Type === 'CLUBBED' ? 'CLUB' : 'SUB'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {subReport.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400 text-xs">No substitutions today</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {cancelledByClass.size > 0 && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3">
                    <SectionLabel><span className="text-orange-600">🚫 Cancelled Classes — All Periods Free</span></SectionLabel>
                    {[...cancelledByClass.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cls, periods]) => (
                      <div key={cls} className="flex items-center gap-2.5 py-1.5 border-b border-orange-100 last:border-0">
                        <span className="text-xs font-bold text-orange-700 w-16 flex-shrink-0">{cls}</span>
                        <span className="text-xs text-orange-500">Per. {[...periods].sort((a, b) => a - b).join(', ')}</span>
                        <span className="ml-auto text-[10px] font-bold text-orange-400 bg-orange-100 rounded-full px-2 py-0.5">FREE</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}


          {/* Lunch & Attendance Duty sections */}
          {lunchDuties.length > 0 && (
            <div className="mt-2 mb-4 pt-3 border-t border-slate-100">
              <SectionLabel>🍱 Lunch Duty</SectionLabel>
              {lunchDuties.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm font-bold text-amber-700 w-16 flex-shrink-0">{d.cls}</span>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="text-sm font-semibold text-slate-700">{shortName(d.teacher)}</span>
                </div>
              ))}
            </div>
          )}
          {attendanceDuties.length > 0 && (
            <div className="mt-2 mb-4 pt-3 border-t border-slate-100">
              <SectionLabel>📝 Attendance Duty</SectionLabel>
              {attendanceDuties.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm font-bold text-purple-700 w-16 flex-shrink-0">{d.cls}</span>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="text-sm font-semibold text-slate-700">{shortName(d.teacher)}</span>
                </div>
              ))}
            </div>
          )}

          {/* WhatsApp text */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Time-Table In-Charge</p>
              <button onClick={handleCopyWA}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  copied ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                }`}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <textarea readOnly value={whatsappText(report, selectedDay, dateVal, lunchDuties, attendanceDuties)}
              className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50 resize-none h-40 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Note for PDF */}
          <div className="mb-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Note in PDF</label>
              <div className="flex items-center gap-2">
                {includeNotes && (
                  <span className={`text-[10px] font-semibold ${countWords(reportNote) >= 70 ? 'text-red-500' : 'text-slate-400'}`}>
                    {countWords(reportNote)}/75 words
                  </span>
                )}
                <button
                  onClick={() => setIncludeNotes(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${includeNotes ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${includeNotes ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            {includeNotes && (
              <textarea
                value={reportNote}
                onChange={handleNoteChange}
                placeholder="Type a note to include at the bottom of the PDF report…"
                className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-white resize-none h-20 text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              />
            )}
          </div>

          {/* Download buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onDownloadPDF(includeNotes ? reportNote : null)} disabled={pdfLoading}
              className="py-3 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
              {pdfLoading ? <LoadingSpinner size="sm" /> : '📄'} PDF
            </button>
            <button onClick={onDownloadCSV}
              className="py-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5">
              ⬇ CSV
            </button>
            <button onClick={() => {
              const wa = whatsappText(report, selectedDay, dateVal, lunchDuties, attendanceDuties);
              const blob = new Blob([wa], { type: 'text/plain' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a');
              a.href = url; a.download = `arrangement_${dateVal}.txt`; a.click(); URL.revokeObjectURL(url);
            }} className="py-3 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5">
              📱 Text
            </button>
          </div>
        </div>
      )}

      {/* Past log */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <button onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-2">
            <span>📂</span>
            Past Arrangements Log
            <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{log.length}</span>
          </span>
          <span className="text-slate-400 text-xs">{showLog ? '▲' : '▼'}</span>
        </button>
        {showLog && (
          <div className="border-t border-slate-100 p-4">
            {log.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No arrangements saved yet.</p>
            ) : (
              <>
                <button onClick={onDownloadLog}
                  className="mb-3 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                  ⬇ Download Full Log
                </button>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        {['Date', 'Day', 'Period', 'Absent', 'Sub', 'Type'].map(h => (
                          <th key={h} className="px-2.5 py-2 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {log.slice(-30).reverse().map((r, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-t border-slate-50`}>
                          <td className="px-2.5 py-2 font-medium text-slate-600">{r.Date}</td>
                          <td className="px-2.5 py-2 text-slate-500">{r.Day}</td>
                          <td className="px-2.5 py-2 font-bold text-blue-600">{r.Period}</td>
                          <td className="px-2.5 py-2 text-slate-600">{shortName(r.Absent_Teacher)}</td>
                          <td className="px-2.5 py-2 font-medium text-slate-700">{shortName(r.Substitute)}</td>
                          <td className="px-2.5 py-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              r.Type === 'CANCELLED' ? 'bg-orange-100 text-orange-700' :
                              r.Type === 'CLUBBED' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>{r.Type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Period Row
// ─────────────────────────────────────────────────────────────────────────────
interface PeriodRowProps {
  df: TimetableRow[]; e: AbsentPeriod; teacher: string; selectedDay: string;
  absentTeachers: string[]; absentPeriods: AbsentPeriod[];
  absenceConfigs: Record<string, AbsenceConfig>;
  cancelledClasses: string[]; useCancelledTeachers: boolean;
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
}

function PeriodRow({
  df, e, teacher, selectedDay, absentTeachers, absentPeriods,
  absenceConfigs, cancelledClasses, useCancelledTeachers,
  subs, clubs, subWl, onSetSub, onSetClub,
}: PeriodRowProps) {
  const k = subKey(e.teacher, e.period);
  const currentSub = subs[k] ?? '';
  const clubMode = clubs[k] ?? false;
  const isAssigned = !!currentSub;

  const periodBusy = useMemo(
    () => busySetExcludingCancelled(df, selectedDay, e.period, cancelledClasses, useCancelledTeachers),
    [df, selectedDay, e.period, cancelledClasses, useCancelledTeachers],
  );
  const alreadyThis = useMemo(() => new Set(
    absentPeriods.filter(e2 => e2.period === e.period && e2.teacher !== teacher)
      .map(e2 => subs[subKey(e2.teacher, e2.period)] ?? '').filter(Boolean),
  ), [absentPeriods, e.period, teacher, subs]);

  const allTeachers = useMemo(() => getAllTeachers(df), [df]);

  // Custom substitute mode — allows typing any name not in the master list
  const isCustomSub = !!currentSub && !allTeachers.includes(currentSub);
  const [customMode, setCustomMode] = useState(false);
  const inCustom = customMode || isCustomSub;
  useEffect(() => { if (!currentSub) setCustomMode(false); }, [currentSub]);

  const notReqTeachers = useMemo(
    () => getNotReqTeachersForPeriod(df, selectedDay, e.period),
    [df, selectedDay, e.period],
  );
  const absentThisPeriod = useMemo(
    () => absentTeachers.filter(t => isTeacherAbsentInPeriod(t, e.period, absentTeachers, absenceConfigs)),
    [absentTeachers, e.period, absenceConfigs],
  );
  const unavail = useMemo(
    () => new Set([...periodBusy, ...alreadyThis, ...absentThisPeriod]),
    [periodBusy, alreadyThis, absentThisPeriod],
  );
  const freeTeachers = useMemo(
    () => allTeachers.filter(t => !unavail.has(t) && !notReqTeachers.has(t))
      .sort((a, b) => (effectiveLoad(df, a, selectedDay, cancelledClasses) + (subWl[a] ?? 0)) - (effectiveLoad(df, b, selectedDay, cancelledClasses) + (subWl[b] ?? 0))),
    [allTeachers, unavail, notReqTeachers, df, selectedDay, cancelledClasses, subWl],
  );
  const clubTeachers = useMemo(
    () => allTeachers.filter(t => (periodBusy.has(t) || alreadyThis.has(t)) && !absentThisPeriod.includes(t) && !notReqTeachers.has(t)),
    [allTeachers, periodBusy, alreadyThis, absentThisPeriod, notReqTeachers],
  );

  const teacherSubjMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of freeTeachers) {
      const subjs = [...new Set(df.filter(r => r.Teacher_Name === t && !isNotReq(r.Subject)).map(r => r.Subject))];
      map[t] = subjs.slice(0, 2).join('/');
    }
    return map;
  }, [df, freeTeachers]);

  function clubLabel(t: string): string {
    if (periodBusy.has(t)) {
      const [cls] = teacherPeriodInfo(df, t, selectedDay, e.period);
      return `${shortName(t)}  ⚠ teaching ${cls}`;
    }
    for (const e2 of absentPeriods) {
      if (e2.period === e.period && e2.teacher !== teacher) {
        if ((subs[subKey(e2.teacher, e2.period)] ?? '') === t) {
          const isAlreadyClub = clubs[subKey(e2.teacher, e2.period)] ?? false;
          return isAlreadyClub ? `${shortName(t)}  🔀 clubbing ${e2.cls}` : `${shortName(t)}  🔀 subbing ${e2.cls}`;
        }
      }
    }
    return shortName(t);
  }

  // Status badge
  let statusBadge: React.ReactNode;
  if (clubMode && !isAssigned) {
    statusBadge = <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">🔀 Select to club</span>;
  } else if (!isAssigned) {
    statusBadge = <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 flex-shrink-0">Unassigned</span>;
  } else if (clubMode) {
    const [tc] = teacherPeriodInfo(df, currentSub, selectedDay, e.period);
    statusBadge = <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">🔀 {shortName(currentSub)}{tc ? ` (${tc})` : ''}</span>;
  } else {
    statusBadge = (
      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full pl-1 pr-2 py-0.5 flex-shrink-0 flex items-center gap-1">
        <span className="w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] leading-none font-bold flex-shrink-0"
          style={{ background: avColor(currentSub) }}>{avInitials(currentSub)}</span>
        {shortName(currentSub)}
      </span>
    );
  }

  return (
    <div className={`border-b border-slate-50 last:border-0 ${clubMode ? 'bg-amber-50/30' : ''}`}>
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div className={`min-w-[32px] h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          clubMode ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
        }`}>P{e.period}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate">{e.cls}</div>
          <div className="text-[10px] text-slate-400">{e.subj}</div>
        </div>
        {statusBadge}
      </div>

      <div className="px-4 pb-3 flex gap-2">
        {!clubMode ? (
          <>
            {inCustom ? (
              <>
                <input
                  type="text" list="kv-teacher-names"
                  value={currentSub}
                  onChange={e2 => onSetSub(teacher, e.period, e2.target.value)}
                  placeholder="Enter teacher name…"
                  autoFocus
                  className="flex-1 bg-white border border-blue-300 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
                />
                <button onClick={() => { setCustomMode(false); onSetSub(teacher, e.period, ''); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all whitespace-nowrap flex-shrink-0">
                  ↩ List
                </button>
              </>
            ) : (
              <>
                <SelectField className="flex-1" value={currentSub}
                  onChange={e2 => onSetSub(teacher, e.period, e2.target.value)}>
                  <option value="">— Not Assigned —</option>
                  {freeTeachers.map(t => (
                    <option key={t} value={t}>
                      {shortName(t)}  [{effectiveLoad(df, t, selectedDay, cancelledClasses) + (subWl[t] ?? 0)} periods]
                    </option>
                  ))}
                </SelectField>
                <button onClick={() => setCustomMode(true)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all whitespace-nowrap flex-shrink-0">
                  ✏
                </button>
                <button onClick={() => onSetClub(teacher, e.period, true)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all whitespace-nowrap flex-shrink-0">
                  🔀 Club
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <SelectField className="flex-1" value={currentSub}
              onChange={e2 => onSetSub(teacher, e.period, e2.target.value)}
              style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
              <option value="">— Not Assigned —</option>
              {clubTeachers.map(t => <option key={t} value={t}>{clubLabel(t)}</option>)}
            </SelectField>
            <button onClick={() => onSetClub(teacher, e.period, false)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all whitespace-nowrap flex-shrink-0">
              ↩ Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Status Tab
// ─────────────────────────────────────────────────────────────────────────────
interface StatusProps {
  df: TimetableRow[]; allTeachers: string[];
  absentTeachers: string[]; absentPeriods: AbsentPeriod[];
  absenceConfigs: Record<string, AbsenceConfig>;
  selectedDay: string; subs: Record<string, string>; clubs: Record<string, boolean>;
  cancelledClasses: string[];
  schoolMaxPeriod: number;
}

function TeacherStatusTab({ df, allTeachers, absentTeachers, absentPeriods, absenceConfigs, selectedDay, subs, clubs, cancelledClasses, schoolMaxPeriod }: StatusProps) {
  const [viewMode, setViewMode] = useState<'teacher' | 'class'>('teacher');
  const activePeriods = ALL_PERIODS.filter(p => p <= schoolMaxPeriod);

  const presentTeachers = useMemo(() => [
    ...allTeachers.filter(t => !absentTeachers.includes(t)),
    ...absentTeachers.filter(t => absenceConfigs[t]?.halfDay),
  ], [allTeachers, absentTeachers, absenceConfigs]);

  const teacherData: TeacherData[] = useMemo(() => {
    return presentTeachers.map(t => {
      const masterPs = new Set(
        df.filter(r => r.Teacher_Name === t && r.Day === selectedDay).map(r => r.Period),
      );
      const subPs = new Set<number>();
      const subFor: Record<number, string> = {};
      const subForCls: Record<number, string> = {};
      for (const e of absentPeriods) {
        if ((subs[subKey(e.teacher, e.period)] ?? '') === t) {
          subPs.add(e.period); subFor[e.period] = e.teacher; subForCls[e.period] = e.cls;
        }
      }
      const isHalfDayAbsent = absentTeachers.includes(t) && !!absenceConfigs[t]?.halfDay;
      const periodStatus: Record<number, 'teaching' | 'sub' | 'clubbed' | 'free' | 'notReq' | 'absent'> = {};
      const periodClass: Record<number, string> = {};
      for (const p of activePeriods) {
        if (isHalfDayAbsent && isTeacherAbsentInPeriod(t, p, absentTeachers, absenceConfigs)) {
          periodStatus[p] = 'absent'; periodClass[p] = 'Absent';
        } else if (subPs.has(p) && (clubs[`${subFor[p]}__${p}`] ?? false)) {
          periodStatus[p] = 'clubbed'; periodClass[p] = `${subForCls[p]} · Clubbing ${shortName(subFor[p])}`;
        } else if (masterPs.has(p)) {
          const row = df.find(r => r.Teacher_Name === t && r.Day === selectedDay && r.Period === p);
          if (row && isNotReq(row.Subject)) {
            periodStatus[p] = 'notReq'; periodClass[p] = 'Upper Class';
          } else if (row && cancelledClasses.includes(row.Class)) {
            periodStatus[p] = 'free'; periodClass[p] = `${row.Class} cancelled`;
          } else {
            periodStatus[p] = 'teaching'; periodClass[p] = row ? `${row.Class} · ${row.Subject}` : '';
          }
        } else if (subPs.has(p)) {
          periodStatus[p] = 'sub'; periodClass[p] = `${subForCls[p]} · Sub for ${shortName(subFor[p])}`;
        } else {
          periodStatus[p] = 'free'; periodClass[p] = '';
        }
      }
      const freeCount = Object.values(periodStatus).filter(s => s === 'free').length;
      return { name: t, periodStatus, periodClass, masterCount: masterPs.size, subCount: subPs.size, freeCount };
    }).sort((a, b) => {
      const TOTAL = 14;
      const pa = priorityIdx(a.name), pb = priorityIdx(b.name);
      const sa = pa >= TOTAL ? -1 : pa; const sb = pb >= TOTAL ? -1 : pb;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [df, presentTeachers, selectedDay, absentPeriods, subs, clubs, absenceConfigs, cancelledClasses]);

  const classData = useMemo(() => {
    const order = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    const classes = [...new Set(
      df.filter(r => r.Day === selectedDay && !isNotReq(r.Subject) && order.includes(r.Class.split(' ')[0]))
        .map(r => r.Class),
    )].sort((a, b) => {
      const [aNum, aSec = ''] = a.split(' '); const [bNum, bSec = ''] = b.split(' ');
      const ai = order.indexOf(aNum), bi = order.indexOf(bNum);
      if (ai !== bi) return ai - bi; return aSec.localeCompare(bSec);
    });
    return classes.map(cls => {
      const isCancelled = cancelledClasses.includes(cls);
      const periods = activePeriods.flatMap(p => {
        const row = df.find(r => r.Class === cls && r.Day === selectedDay && r.Period === p && !isNotReq(r.Subject));
        if (!row) return [];
        const isAbsent = isTeacherAbsentInPeriod(row.Teacher_Name, p, absentTeachers, absenceConfigs);
        const sub = isAbsent ? (subs[`${row.Teacher_Name}__${p}`] || null) : null;
        const isClub = isAbsent && !!(sub) && !!(clubs[`${row.Teacher_Name}__${p}`]);
        return [{ period: p, teacher: row.Teacher_Name, subject: row.Subject, isAbsent, substitute: sub, isClub }];
      });
      return { cls, periods, isCancelled };
    }).filter(c => c.periods.length > 0);
  }, [df, selectedDay, absentTeachers, absenceConfigs, subs, clubs]);

  const nPresent = presentTeachers.length;
  const nAbsent = absentTeachers.length;
  const nFreeAll = teacherData.filter(td => td.freeCount === activePeriods.length).length;
  const nOnSub = teacherData.filter(td => td.subCount > 0).length;

  const statTiles = [
    { val: nPresent, lbl: 'Present', color: '#10B981' },
    { val: nAbsent,  lbl: 'Absent',  color: '#EF4444' },
    { val: nFreeAll, lbl: 'Free',    color: '#3B82F6' },
    { val: nOnSub,   lbl: 'On Sub',  color: '#F59E0B' },
  ];

  const legend = [
    { color: '#3B82F6', label: 'Teaching' },
    { color: '#F59E0B', label: 'Substituting' },
    { color: '#F97316', label: 'Clubbing' },
    { color: '#E2E8F0', label: 'Free' },
    { color: '#A855F7', label: 'Upper Class' },
    { color: '#FCA5A5', label: 'Absent (part)' },
  ];

  return (
    <>
      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {statTiles.map(({ val, lbl, color }) => (
          <div key={lbl} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <div className="text-2xl font-extrabold" style={{ color }}>{val}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 px-1">
        {legend.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Absent pills */}
      {absentTeachers.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-xs text-red-700">
          <span className="font-bold">Absent today: </span>
          {absentTeachers.map(t => (
            <span key={t} className="inline-block bg-red-100 border border-red-200 rounded-full px-2 py-0.5 mr-1 mb-1 font-semibold">
              {shortName(t)}
            </span>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-1 mb-4 flex gap-1">
        {(['teacher', 'class'] as const).map(v => (
          <button key={v} onClick={() => setViewMode(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}>
            {v === 'teacher' ? '👥 Teacher View' : '🏫 Class View'}
          </button>
        ))}
      </div>

      {viewMode === 'teacher' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teacherData.map(td => <TeacherStatusCard key={td.name} td={td} activePeriods={activePeriods} />)}
        </div>
      )}
      {viewMode === 'class' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {classData.map(cd => <ClassStatusCard key={cd.cls} cd={cd} />)}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Status Card
// ─────────────────────────────────────────────────────────────────────────────
function TeacherStatusCard({ td, activePeriods }: { td: TeacherData; activePeriods: number[] }) {
  const [expanded, setExpanded] = useState(false);
  const busyCount = activePeriods.length - td.freeCount;
  const loadPct = activePeriods.length ? busyCount / activePeriods.length : 0;

  const dotColor = { teaching: '#3B82F6', sub: '#F59E0B', clubbed: '#F97316', free: '#E2E8F0', notReq: '#A855F7', absent: '#FCA5A5' };
  const dotText  = { teaching: '#fff', sub: '#fff', clubbed: '#fff', free: '#94A3B8', notReq: '#fff', absent: '#EF4444' };

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
          style={{ background: avColor(td.name) }}>
          {avInitials(td.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{shortName(td.name)}</div>
          <div className="text-xs text-slate-400">
            <span className="text-emerald-500 font-semibold">{td.freeCount} free</span>
            <span className="mx-1 text-slate-200">·</span>
            <span>{busyCount} busy</span>
          </div>
        </div>
      </div>

      {/* Load bar */}
      <KvProgressBar value={Math.round(loadPct * 100)}
        color={loadPct >= 0.75 ? 'danger' : loadPct >= 0.5 ? 'warning' : 'success'} />

      {/* Period dots */}
      <div className="flex gap-1 flex-wrap mt-2.5 mb-2">
        {activePeriods.map(p => {
          const s = td.periodStatus[p];
          const lbl = s === 'teaching' ? 'T' : s === 'sub' ? 'S' : s === 'clubbed' ? 'C' : s === 'notReq' ? 'UC' : s === 'absent' ? 'A' : String(p);
          return (
            <div key={p} title={`P${p}: ${td.periodClass[p] || s}`}
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-default select-none"
              style={{ background: dotColor[s], color: dotText[s] }}>
              {lbl}
            </div>
          );
        })}
      </div>

      <button onClick={() => setExpanded(!expanded)}
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium">
        {expanded ? '▲ Hide' : '▼ Details'}
      </button>

      {expanded && (
        <div className="mt-2 border-t border-slate-50 pt-2 space-y-0.5">
          {activePeriods.map(p => (
            <div key={p} className="flex items-center gap-2 py-0.5">
              <span className="w-6 text-[11px] text-slate-400 font-bold">P{p}</span>
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: dotColor[td.periodStatus[p]] }} />
              <span className="text-xs text-slate-600">{td.periodClass[p] || td.periodStatus[p]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Status Card
// ─────────────────────────────────────────────────────────────────────────────
type ClassPeriodInfo = {
  period: number; teacher: string; subject: string;
  isAbsent: boolean; substitute: string | null; isClub: boolean;
};

function ClassStatusCard({ cd }: { cd: { cls: string; periods: ClassPeriodInfo[]; isCancelled: boolean } }) {
  const hasIssue = !cd.isCancelled && cd.periods.some(p => p.isAbsent);

  return (
    <div className={`rounded-2xl p-3.5 shadow-sm border hover:shadow-md transition-shadow ${
      cd.isCancelled ? 'bg-orange-50 border-orange-200' :
      hasIssue ? 'bg-white border-amber-200' : 'bg-white border-slate-100'
    }`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm ${
          cd.isCancelled ? 'bg-orange-400' : 'bg-blue-600'
        }`}>
          {cd.cls.replace(' ', '')}
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-800">Class {cd.cls}</div>
          {cd.isCancelled
            ? <div className="text-xs font-semibold text-orange-600">🚫 Cancelled</div>
            : <div className="text-xs text-slate-400">{cd.periods.length} periods</div>
          }
        </div>
        {hasIssue && !cd.isCancelled && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">⚠ Issues</span>
        )}
      </div>

      <div className="space-y-1">
        {cd.periods.map(p => (
          <div key={p.period} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
            cd.isCancelled ? 'bg-orange-50/60 border border-orange-100' :
            p.isAbsent && !p.substitute ? 'bg-red-50 border border-red-100' :
            p.isClub ? 'bg-orange-50 border border-orange-100' :
            p.isAbsent ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'
          }`}>
            <span className="font-bold text-blue-700 w-5 flex-shrink-0">P{p.period}</span>
            <span className="text-slate-400 w-14 flex-shrink-0 truncate">{p.subject}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              {cd.isCancelled ? (
                <>
                  <span className="text-orange-300 line-through truncate">{shortName(p.teacher)}</span>
                  <span className="text-orange-500 font-semibold flex-shrink-0 ml-1 text-[10px]">FREE</span>
                </>
              ) : p.isAbsent ? (
                <>
                  <span className="text-red-400 line-through truncate">{shortName(p.teacher)}</span>
                  {p.substitute
                    ? <><span className="text-slate-400 flex-shrink-0">→</span>
                        <span className={`font-semibold truncate ${p.isClub ? 'text-orange-600' : 'text-amber-700'}`}>
                          {shortName(p.substitute)}
                        </span>
                        {p.isClub && <span className="font-bold text-orange-500 flex-shrink-0 text-[10px]">CLUB</span>}</>
                    : <span className="font-semibold text-red-600 flex-shrink-0">⚠ Unassigned</span>
                  }
                </>
              ) : (
                <span className="font-semibold text-slate-700 truncate">{shortName(p.teacher)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
