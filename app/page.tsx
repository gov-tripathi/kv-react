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
  TimetableRow, AbsentPeriod, ReportRow, TeacherData, DutyEntry, CancelledClassConfig,
} from '@/lib/types';
import {
  ALL_PERIODS, DAY_MAP,
  avColor, avInitials, shortName, getAllTeachers, getAllClasses,
  getSchedule, busySetExcludingCancelled, teacherPeriodInfo, effectiveLoad,
  buildAbsentPeriods, getCancelledPeriods, computeSubWorkload, autoFillAll,
  buildReportRowsWithCancelled, whatsappText, isTeacherAbsentInPeriod,
  getNotReqTeachersForPeriod, priorityIdx, isNotReq,
} from '@/lib/timetable';
import type { AbsenceConfig, FormState, Arrangement } from '@/lib/types';
import { generatePDF } from '@/lib/pdf';
import { computeRegisterDuties } from '@/lib/duties';
import type { RegisterDuty } from '@/lib/duties';
import {
  getMyArrangements, getSharedArrangements,
  saveArrangement, updateArrangement, deleteArrangement, setConcluded, saveDraft, loadDraft,
} from '@/lib/db';

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

// ── Sidebar nav items (shared by desktop sidebar + mobile bottom nav) ─────────
const NAV_ITEMS = [
  { id: 'arrangement' as const, icon: '⚡', label: 'Arrange', desc: 'Assign substitutes' },
  { id: 'status'      as const, icon: '👥', label: 'Status',  desc: 'Teacher overview'  },
  { id: 'history'     as const, icon: '☁',  label: 'History', desc: 'Cloud records'     },
] as const;

// ── Desktop sidebar ───────────────────────────────────────────────────────────
function AppSidebar({
  activeTab, setActiveTab, onSignOut, currentUser,
  absentCount, coveredCount, totalPeriods, dateVal, selectedDay,
}: {
  activeTab: 'arrangement' | 'status' | 'history';
  setActiveTab: (t: 'arrangement' | 'status' | 'history') => void;
  onSignOut: () => void;
  currentUser: string;
  absentCount: number;
  coveredCount: number;
  totalPeriods: number;
  dateVal: string;
  selectedDay: string;
}) {
  const progress = totalPeriods > 0 ? Math.round((coveredCount / totalPeriods) * 100) : null;
  const fmtShort = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <aside
      className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 z-40 select-none overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0F172A 0%, #1a2c6a 55%, #1E3A8A 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Dot-grid texture */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      {/* Top glow */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(59,130,246,0.14)', filter: 'blur(40px)' }} />

      {/* Branding */}
      <div className="relative px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <img src="/2023042075.png" alt="KV Logo" className="h-10 w-auto flex-shrink-0"
            style={{ filter: 'brightness(1.15) drop-shadow(0 2px 10px rgba(0,0,0,.6))' }} />
          <img src="/2025021137.png" alt="PM SHRI Logo" className="h-8 w-auto flex-shrink-0"
            style={{ filter: 'brightness(1.15) drop-shadow(0 2px 10px rgba(0,0,0,.6))' }} />
        </div>
        <p className="text-[10px] font-extrabold text-white/70 tracking-[0.12em] uppercase leading-snug">PM SHRI Kendriya Vidyalaya</p>
        <p className="text-[10px] font-bold tracking-wider mt-0.5" style={{ color: 'rgba(147,197,253,0.55)' }}>Burhanpur · 2026–27</p>
        <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />
      </div>

      {/* Date + coverage widgets */}
      <div className="relative px-4 space-y-2 mb-2">
        {/* Date chip */}
        <div className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-[9px] font-bold text-white/25 tracking-widest uppercase">Date</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>{fmtShort(dateVal)}</p>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(37,99,235,0.3)', color: 'rgba(147,197,253,0.9)', border: '1px solid rgba(37,99,235,0.25)' }}>
            {selectedDay}
          </span>
        </div>

        {/* Coverage widget — only when arrangement is active */}
        {absentCount > 0 && (
          <div className="rounded-xl px-3.5 py-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[9px] font-bold text-white/25 tracking-widest uppercase mb-1.5">Coverage</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-xl font-extrabold" style={{ color: 'rgba(255,255,255,0.9)' }}>{coveredCount}</span>
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {totalPeriods}</span>
              <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>periods</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress ?? 0}%`,
                  background: (progress ?? 0) >= 100 ? '#10B981' : (progress ?? 0) >= 50 ? '#F59E0B' : '#EF4444',
                  boxShadow: `0 0 6px ${(progress ?? 0) >= 100 ? '#10B981' : (progress ?? 0) >= 50 ? '#F59E0B80' : '#EF444480'}`,
                }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(248,113,113,0.7)' }}>{absentCount} absent</span>
              {progress !== null && (
                <span className="text-[10px] font-bold" style={{ color: progress >= 100 ? '#6EE7B7' : progress >= 50 ? '#FCD34D' : '#FCA5A5' }}>
                  {progress}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 pt-3 overflow-y-auto">
        <p className="text-[8px] font-bold text-white/20 tracking-[0.2em] uppercase px-3 mb-1.5">Workspace</p>
        {NAV_ITEMS.map(({ id, icon, label, desc }) => {
          const isActive = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5 text-left transition-all duration-150 group relative hover:bg-white/5"
              style={isActive
                ? { background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.09)' }
                : { border: '1px solid transparent' }
              }>
              {/* Active left accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #93C5FD, #3B82F6)' }} />
              )}
              <span className={`text-lg leading-none flex-shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold leading-none ${isActive ? 'text-white' : 'text-white/45 group-hover:text-white/70'}`}>
                  {label}
                </div>
                <div className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-blue-300/50' : 'text-white/20 group-hover:text-white/35'}`}>
                  {desc}
                </div>
              </div>
              {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#60A5FA' }} />}
            </button>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="relative px-4 pb-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5 px-1 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
            {currentUser.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate leading-none" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {currentUser.split('@')[0]}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Admin · KV Burhanpur</p>
          </div>
        </div>
        <button onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Mobile bottom navigation ──────────────────────────────────────────────────
function MobileBottomNav({
  activeTab, setActiveTab,
}: {
  activeTab: 'arrangement' | 'status' | 'history';
  setActiveTab: (t: 'arrangement' | 'status' | 'history') => void;
}) {
  return (
    <nav className="kv-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
      <div className="flex">
        {NAV_ITEMS.map(({ id, icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-all">
              {isActive && (
                <span className="absolute top-0 left-[25%] right-[25%] h-[2px] rounded-b-full bg-blue-600" />
              )}
              <span className={`text-xl leading-none transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                {icon}
              </span>
              <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
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
          <h1 className="text-base font-extrabold text-white tracking-widest uppercase text-center">PM SHRI KENDRIYA VIDYALAYA BURHANPUR</h1>
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

// ── Workflow step indicator ───────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: 'Setup' },
    { n: 2 as const, label: 'Assign' },
    { n: 3 as const, label: 'Report' },
  ];
  return (
    <div className="flex items-center mb-4 px-1">
      {steps.map(({ n, label }, i) => {
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-1.5 flex-shrink-0 transition-all duration-200 ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 transition-all duration-200 ${
                done ? 'bg-blue-500 text-white' : active ? 'bg-blue-600 text-white ring-2 ring-blue-200 ring-offset-1' : 'bg-slate-200 text-slate-400'
              }`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-bold ${active ? 'text-blue-700' : done ? 'text-slate-500' : 'text-slate-300'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-px mx-2 transition-colors duration-300 ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  useEffect(() => {
    try {
      const email = localStorage.getItem('kv_auth') ?? '';
      setAuthed(!!email);
      if (email) setCurrentUser(email);
    } catch { setAuthed(false); }
  }, []);
  const [df, setDf] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'arrangement' | 'status' | 'history'>('arrangement');

  const [dateVal, setDateVal] = useState<string>(todayDate());
  const selectedDay = useMemo(() => {
    const d = new Date(dateVal + 'T00:00:00');
    return DAY_MAP[d.getDay()] ?? 'MON';
  }, [dateVal]);
  const [absentTeachers, setAbsentTeachers] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [absenceConfigs, setAbsenceConfigs] = useState<Record<string, AbsenceConfig>>({});
  const [cancelledClasses, setCancelledClasses] = useState<string[]>([]);
  const [cancelledClassConfigs, setCancelledClassConfigs] = useState<Record<string, CancelledClassConfig>>({});
  const [useCancelledTeachers, setUseCancelledTeachers] = useState<boolean>(false);
  const [schoolHalfDay, setSchoolHalfDay] = useState<boolean>(false);
  const [schoolHalfDayPeriod, setSchoolHalfDayPeriod] = useState<number>(4);
  const [lunchDuties, setLunchDuties] = useState<DutyEntry[]>([]);
  const [attendanceDuties, setAttendanceDuties] = useState<DutyEntry[]>([]);
  const [lunchTeacher, setLunchTeacher] = useState('');
  const [lunchClass, setLunchClass] = useState('');
  const [attendanceTeacher, setAttendanceTeacher] = useState('');
  const [attendanceClass, setAttendanceClass] = useState('');
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [clubs, setClubs] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savedArrangementId, setSavedArrangementId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [arrangementTitle, setArrangementTitle] = useState('');
  const [titleLocked, setTitleLocked] = useState(false);
  const [loadedArrangementId, setLoadedArrangementId] = useState<string | null>(null);
  const [myArrangements, setMyArrangements] = useState<Arrangement[]>([]);

  // Load draft + arrangements from DB on login
  useEffect(() => {
    if (!currentUser) return;
    getMyArrangements(currentUser).then(setMyArrangements).catch(() => {});
    loadDraft(currentUser).then(draft => {
      if (!draft?.form_state) return;
      const fs = draft.form_state;
      skipSubsReset.current = true;
      skipDayReset.current = true;
      setDateVal(fs.dateVal);
      setAbsentTeachers(fs.absentTeachers);
      setAbsenceConfigs(fs.absenceConfigs);
      setCancelledClasses(fs.cancelledClasses);
      setCancelledClassConfigs(fs.cancelledClassConfigs);
      setUseCancelledTeachers(fs.useCancelledTeachers ?? false);
      setSchoolHalfDay(fs.schoolHalfDay);
      setSchoolHalfDayPeriod(fs.schoolHalfDayPeriod);
      setLunchDuties(fs.lunchDuties);
      setAttendanceDuties(fs.attendanceDuties);
      setSubs(fs.subs);
      setClubs(fs.clubs);
      if (draft.report_rows) setReport(draft.report_rows);
    }).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    fetch('/timetable_master.csv').then(r => r.text()).then(csv => {
      const result = Papa.parse<TimetableRow>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      setDf(result.data);
      setLoading(false);
    });
  }, []);


  // Debounced draft save to DB (3 s after last change)
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      saveDraft(currentUser, {
        dateVal, absentTeachers, absenceConfigs, cancelledClasses, cancelledClassConfigs,
        useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
        lunchDuties, attendanceDuties, subs, clubs,
      }, report).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentUser, dateVal, absentTeachers, absenceConfigs, cancelledClasses, cancelledClassConfigs,
      useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod, lunchDuties, attendanceDuties, subs, clubs, report]);

  const allTeachers = useMemo(() => getAllTeachers(df), [df]);
  const allClasses = useMemo(() => getAllClasses(df), [df]);
  const schoolMaxPeriod = schoolHalfDay ? schoolHalfDayPeriod : 8;

  const absentPeriods = useMemo(
    () => buildAbsentPeriods(df, absentTeachers, selectedDay, absenceConfigs, cancelledClasses, schoolMaxPeriod, cancelledClassConfigs),
    [df, absentTeachers, selectedDay, absenceConfigs, cancelledClasses, schoolMaxPeriod, cancelledClassConfigs],
  );

  const cancelledPeriods = useMemo(
    () => getCancelledPeriods(df, cancelledClasses, selectedDay, schoolMaxPeriod, cancelledClassConfigs),
    [df, cancelledClasses, selectedDay, schoolMaxPeriod, cancelledClassConfigs],
  );

  // These refs prevent the reset effects from wiping restored localStorage state on mount
  const skipSubsReset = useRef(true);
  const skipDayReset = useRef(true);
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(e.target as Node)) {
        setShowTeacherDropdown(false);
      }
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, []);

  useEffect(() => {
    if (skipSubsReset.current) { skipSubsReset.current = false; return; }
    setSubs({}); setClubs({}); setReport(null);
  }, [selectedDay, absentTeachers]);
  useEffect(() => {
    if (skipDayReset.current) { skipDayReset.current = false; return; }
    setCancelledClasses([]); setCancelledClassConfigs({}); setUseCancelledTeachers(false);
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
    const newSubs = autoFillAll(df, absentPeriods, absentTeachers, selectedDay, subs, cancelledClasses, useCancelledTeachers, absenceConfigs, cancelledClassConfigs);
    setSubs(newSubs); setReport(null);
  }, [df, absentPeriods, absentTeachers, selectedDay, subs, cancelledClasses, useCancelledTeachers, absenceConfigs]);

  const handleReset = useCallback(() => {
    setSubs({}); setClubs({}); setReport(null);
  }, []);

  const handleNewSchedule = useCallback(() => {
    setDateVal(todayDate());
    setAbsentTeachers([]);
    setAbsenceConfigs({});
    setCancelledClasses([]);
    setCancelledClassConfigs({});
    setUseCancelledTeachers(false);
    setSchoolHalfDay(false);
    setSchoolHalfDayPeriod(4);
    setLunchDuties([]);
    setAttendanceDuties([]);
    setSubs({});
    setClubs({});
    setReport(null);
    setSavedArrangementId(null);
    setArrangementTitle('');
    setTitleLocked(false);
    setLoadedArrangementId(null);
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
    setSavedArrangementId(null);
  }, [df, absentPeriods, cancelledPeriods, subs, clubs, selectedDay, dateVal]);

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

  const handleSaveArrangement = useCallback(async (titleOverride?: string) => {
    if (!report) return;
    setSaving(true);
    const formState: FormState = {
      dateVal, absentTeachers, absenceConfigs, cancelledClasses, cancelledClassConfigs,
      useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
      lunchDuties, attendanceDuties, subs, clubs,
    };
    try {
      const fmtD = new Date(dateVal + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const resolvedTitle = (titleOverride ?? arrangementTitle).trim() || `${selectedDay} · ${fmtD}`;
      const arr = await saveArrangement({
        title: resolvedTitle,
        date: dateVal, day: selectedDay, created_by: currentUser,
        form_state: formState, report_rows: report, is_shared: false,
      });
      setSavedArrangementId(arr.id);
      setArrangementTitle(resolvedTitle);
      setLoadedArrangementId(null);
      setTitleLocked(true);
      setMyArrangements(prev => [arr, ...prev.filter(a => a.id !== arr.id)]);
    } catch (e) { console.error('Save error:', e); alert('Failed to save: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  }, [report, dateVal, absentTeachers, absenceConfigs, cancelledClasses, cancelledClassConfigs,
      useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
      lunchDuties, attendanceDuties, subs, clubs, selectedDay, currentUser, arrangementTitle]);

  const handleLoadArrangement = useCallback((fs: FormState, title?: string | null, id?: string) => {
    skipSubsReset.current = true;
    skipDayReset.current = true;
    setDateVal(fs.dateVal);
    setAbsentTeachers(fs.absentTeachers);
    setAbsenceConfigs(fs.absenceConfigs);
    setCancelledClasses(fs.cancelledClasses);
    setCancelledClassConfigs(fs.cancelledClassConfigs);
    setUseCancelledTeachers(fs.useCancelledTeachers ?? false);
    setSchoolHalfDay(fs.schoolHalfDay);
    setSchoolHalfDayPeriod(fs.schoolHalfDayPeriod);
    setLunchDuties(fs.lunchDuties);
    setAttendanceDuties(fs.attendanceDuties);
    setSubs(fs.subs);
    setClubs(fs.clubs);
    setReport(null);
    setSavedArrangementId(null);
    setArrangementTitle(title ?? '');
    setTitleLocked(true);
    setLoadedArrangementId(id ?? null);
    setActiveTab('arrangement');
  }, []);

  const handleUpdateVersion = useCallback(async () => {
    if (!report || !loadedArrangementId) return;
    setSaving(true);
    const formState: FormState = {
      dateVal, absentTeachers, absenceConfigs, cancelledClasses, cancelledClassConfigs,
      useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
      lunchDuties, attendanceDuties, subs, clubs,
    };
    try {
      const updated = await updateArrangement(loadedArrangementId, { title: arrangementTitle || undefined, form_state: formState, report_rows: report });
      setSavedArrangementId(loadedArrangementId);
      setTitleLocked(true);
      setMyArrangements(prev => prev.map(a => a.id === loadedArrangementId ? updated : a));
    } catch (e) { console.error('Update error:', e); alert('Failed to update: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  }, [report, loadedArrangementId, arrangementTitle, dateVal, absentTeachers, absenceConfigs,
      cancelledClasses, cancelledClassConfigs, useCancelledTeachers, schoolHalfDay, schoolHalfDayPeriod,
      lunchDuties, attendanceDuties, subs, clubs]);


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
    <div className="min-h-screen flex" style={{ background: '#F1F5F9' }}>
      {/* Global datalist */}
      <datalist id="kv-teacher-names">
        {allTeachers.map(t => <option key={t} value={shortName(t)} />)}
      </datalist>

      {/* Desktop sidebar */}
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={() => { try { localStorage.removeItem('kv_auth'); } catch {} setAuthed(false); }}
        currentUser={currentUser}
        absentCount={absentTeachers.length}
        coveredCount={covered}
        totalPeriods={absentPeriods.length}
        dateVal={dateVal}
        selectedDay={selectedDay}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 lg:pl-64">
        {/* Mobile sticky header */}
        <div className="lg:hidden sticky top-0 z-30 px-3 py-2.5 flex items-center justify-between"
          style={{ background: 'rgba(241,245,249,0.96)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
          <div className="flex items-center gap-2.5">
            <img src="/2023042075.png" alt="KV" className="h-7 w-auto"
              style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.2))' }} />
            <div>
              <div className="text-sm font-extrabold text-slate-800 leading-none">KV Burhanpur</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Arrangement · 2026–27</div>
            </div>
          </div>
          <StatusChip color="accent" size="sm">{selectedDay}</StatusChip>
        </div>

        <div className="max-w-3xl mx-auto px-3 py-4 pb-24 lg:pb-8 lg:px-8 lg:py-6">

        {/* ── Arrangement Tab (setup + assignment) ── */}
        {activeTab === 'arrangement' && (<div className="kv-tab-content">
        <StepIndicator step={report ? 3 : (absentTeachers.length > 0 || cancelledClasses.length > 0) ? 2 : 1} />
        <button
          onClick={handleNewSchedule}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-xl text-sm font-bold border-2 border-dashed border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-[0.99]"
        >
          <span className="text-base leading-none">＋</span> New Arrangement
        </button>
        {/* ── Morning Setup ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Morning Setup</span>
          </div>
          <div className="p-4">

          {/* Date */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-600">Date</label>
              <StatusChip color="accent" size="sm">{selectedDay}</StatusChip>
            </div>
            <input type="date" value={dateVal}
              onChange={e => {
                const newDate = e.target.value;
                const concluded = myArrangements.filter(a => a.date === newDate).find(a => a.is_concluded);
                if (concluded) { handleLoadArrangement(concluded.form_state, concluded.title, concluded.id); return; }
                setDateVal(newDate); setAbsentTeachers([]);
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>

          {/* Absent Teachers */}
          <div className="mb-1">
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Mark Teachers Absent</label>
            <div className="relative" ref={teacherDropdownRef}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search or tap to see all teachers…"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  onFocus={() => setShowTeacherDropdown(true)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" />
              </div>
              {showTeacherDropdown && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {filteredTeachers.map(t => (
                    <button key={t}
                      onPointerDown={e => { e.preventDefault(); setAbsentTeachers(prev => [...prev, t]); setTeacherSearch(''); setShowTeacherDropdown(false); }}
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
                      <button onClick={() => {
                        setCancelledClasses(prev => prev.filter(x => x !== c));
                        setCancelledClassConfigs(prev => { const n = { ...prev }; delete n[c]; return n; });
                        setReport(null);
                      }} className="ml-0.5 w-4 h-4 rounded-full text-orange-400 hover:text-white hover:bg-orange-500 flex items-center justify-center transition-colors text-xs leading-none flex-shrink-0">×</button>
                    </span>
                  ))}
                </div>

                {/* Per-class half-day config */}
                <div className="mt-3 space-y-2.5">
                  {cancelledClasses.map(c => {
                    const cfg: CancelledClassConfig = cancelledClassConfigs[c] ?? { halfDay: false, cancelledPeriods: [] };
                    const classPeriods = new Set(
                      df.filter(r => r.Class === c && r.Day === selectedDay && !isNotReq(r.Subject) && r.Period <= schoolMaxPeriod).map(r => r.Period)
                    );
                    const allPeriods = Array.from({ length: schoolMaxPeriod }, (_, i) => i + 1);
                    return (
                      <div key={c} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{c}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${cfg.halfDay ? 'text-orange-600' : 'text-slate-400'}`}>
                              {cfg.halfDay ? 'Select Periods' : 'Full Day'}
                            </span>
                            <Toggle on={cfg.halfDay} accent="amber"
                              onToggle={() => {
                                setCancelledClassConfigs(prev => ({ ...prev, [c]: { ...cfg, halfDay: !cfg.halfDay, cancelledPeriods: [] } }));
                                setReport(null);
                              }} />
                          </div>
                        </div>
                        {cfg.halfDay && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Tap periods to <strong>cancel</strong>:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {allPeriods.map(p => {
                                const hasClass = classPeriods.has(p);
                                const isCancelled = cfg.cancelledPeriods?.includes(p) ?? false;
                                return (
                                  <button key={p}
                                    onClick={() => {
                                      const current = cfg.cancelledPeriods ?? [];
                                      const next = isCancelled ? current.filter(pp => pp !== p) : [...current, p];
                                      setCancelledClassConfigs(prev => ({ ...prev, [c]: { ...cfg, cancelledPeriods: next } }));
                                      setReport(null);
                                    }}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all min-h-[32px] ${
                                      isCancelled
                                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                        : hasClass
                                          ? 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600'
                                          : 'bg-white text-slate-300 border-slate-150 hover:border-orange-200 hover:text-orange-400'
                                    }`}>
                                    P{p}{!hasClass ? ' · Free' : ''}
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
                  const full = allTeachers.find(t => shortName(t).toLowerCase() === lunchTeacher.trim().toLowerCase() || t.toLowerCase() === lunchTeacher.trim().toLowerCase()) ?? lunchTeacher.trim();
                  setLunchDuties(prev => [...prev, { teacher: full, cls: lunchClass }]);
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
                  const full = allTeachers.find(t => shortName(t).toLowerCase() === attendanceTeacher.trim().toLowerCase() || t.toLowerCase() === attendanceTeacher.trim().toLowerCase()) ?? attendanceTeacher.trim();
                  setAttendanceDuties(prev => [...prev, { teacher: full, cls: attendanceClass }]);
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
        </div>
          <ArrangementTab
            df={df} absentTeachers={absentTeachers} absentPeriods={absentPeriods}
            absenceConfigs={absenceConfigs}
            cancelledClasses={cancelledClasses} cancelledClassConfigs={cancelledClassConfigs} cancelledPeriods={cancelledPeriods}
            useCancelledTeachers={useCancelledTeachers}
            selectedDay={selectedDay} dateVal={dateVal}
            subs={subs} clubs={clubs} subWl={subWl} covered={covered}
            registerDuties={registerDuties}
            lunchDuties={lunchDuties} attendanceDuties={attendanceDuties}
            report={report} pdfLoading={pdfLoading}
            onAutoFill={handleAutoFill}
            onReset={handleReset}
            onSetSub={handleSetSub} onSetClub={handleSetClub}
            onGenerateReport={handleGenerateReport}
            onDownloadPDF={handleDownloadPDF}
            onDownloadCSV={handleDownloadCSV}
            onSave={handleSaveArrangement}
            saving={saving}
            isSaved={savedArrangementId !== null}
            arrangementTitle={arrangementTitle}
            onTitleChange={setArrangementTitle}
            titleLocked={titleLocked}
            loadedArrangementId={loadedArrangementId}
            onUpdateVersion={handleUpdateVersion}
          />
        </div>)}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <div className="kv-tab-content">
          <HistoryTab currentUser={currentUser} onLoad={handleLoadArrangement} />
          </div>
        )}

        {/* ── Teacher Status Tab ── */}
        {activeTab === 'status' && (
          <div className="kv-tab-content">
          <TeacherStatusTab
            df={df} allTeachers={allTeachers}
            absentTeachers={absentTeachers} absentPeriods={absentPeriods}
            absenceConfigs={absenceConfigs}
            selectedDay={selectedDay} subs={subs} clubs={clubs}
            cancelledClasses={cancelledClasses}
            cancelledClassConfigs={cancelledClassConfigs}
            schoolMaxPeriod={schoolMaxPeriod}
          />
          </div>
        )}

        </div>{/* /max-w-3xl */}
      </div>{/* /main content */}

      {/* Mobile bottom navigation */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arrangement Tab
// ─────────────────────────────────────────────────────────────────────────────
interface ArrProps {
  df: TimetableRow[]; absentTeachers: string[]; absentPeriods: AbsentPeriod[];
  absenceConfigs: Record<string, AbsenceConfig>;
  cancelledClasses: string[]; cancelledClassConfigs: Record<string, CancelledClassConfig>; cancelledPeriods: AbsentPeriod[];
  useCancelledTeachers: boolean;
  selectedDay: string; dateVal: string;
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>; covered: number;
  registerDuties: RegisterDuty[];
  lunchDuties: DutyEntry[]; attendanceDuties: DutyEntry[];
  report: ReportRow[] | null; pdfLoading: boolean;
  onAutoFill: () => void;
  onReset: () => void;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
  onGenerateReport: () => void;
  onDownloadPDF: (note: string | null) => void;
  onDownloadCSV: () => void;
  onSave: (titleOverride?: string) => void;
  onUpdateVersion: () => void;
  saving: boolean;
  isSaved: boolean;
  arrangementTitle: string;
  onTitleChange: (t: string) => void;
  titleLocked: boolean;
  loadedArrangementId: string | null;
}

function ArrangementTab({
  df, absentTeachers, absentPeriods,
  absenceConfigs, cancelledClasses, cancelledClassConfigs, cancelledPeriods, useCancelledTeachers,
  selectedDay, dateVal, subs, clubs, subWl, covered, registerDuties,
  lunchDuties, attendanceDuties,
  report, pdfLoading,
  onAutoFill, onReset, onSetSub, onSetClub, onGenerateReport,
  onDownloadPDF, onDownloadCSV,
  onSave, onUpdateVersion, saving, isSaved,
  arrangementTitle, onTitleChange, titleLocked, loadedArrangementId,
}: ArrProps) {
  const [copied, setCopied] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [newVersionMode, setNewVersionMode] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState('');

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
                cancelledClasses={cancelledClasses} cancelledClassConfigs={cancelledClassConfigs} useCancelledTeachers={useCancelledTeachers}
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

          {/* Schedule name */}
          <div className="mt-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Schedule name</label>
            {titleLocked || isSaved ? (
              <div className="w-full border border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 bg-slate-50">
                {arrangementTitle || `${selectedDay} – arrangement`}
              </div>
            ) : (
              <input type="text" value={arrangementTitle} onChange={e => onTitleChange(e.target.value)}
                placeholder={`e.g., ${selectedDay} – regular day`}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400" />
            )}
          </div>

          {/* Save actions */}
          {isSaved ? (
            <div className="mt-3 w-full py-3 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-2">
              ✓ Saved to History
            </div>
          ) : loadedArrangementId && !newVersionMode ? (
            /* Loaded arrangement — ask update or new version */
            <div className="mt-3 rounded-2xl border border-slate-200 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 bg-slate-50 border-b border-slate-100">
                You edited a loaded arrangement — save as:
              </p>
              <div className="flex divide-x divide-slate-100">
                <button onClick={onUpdateVersion} disabled={saving}
                  className="flex-1 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <LoadingSpinner size="sm" /> : '↺'} Update same version
                </button>
                <button onClick={() => { setNewVersionMode(true); setNewVersionTitle(arrangementTitle ? arrangementTitle + ' (v2)' : ''); }} disabled={saving}
                  className="flex-1 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  ＋ New version
                </button>
              </div>
            </div>
          ) : newVersionMode ? (
            /* New version title input + confirm */
            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">New version name</p>
              <input type="text" value={newVersionTitle} onChange={e => setNewVersionTitle(e.target.value)}
                placeholder={`e.g., ${selectedDay} – revised`} autoFocus
                className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 mb-2" />
              <div className="flex gap-2">
                <button onClick={() => setNewVersionMode(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={() => { onSave(newVersionTitle || undefined); setNewVersionMode(false); }} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <LoadingSpinner size="sm" /> : '☁ Save New Version'}
                </button>
              </div>
            </div>
          ) : (
            /* Fresh arrangement — normal save */
            <button onClick={() => onSave()} disabled={saving}
              className="mt-3 w-full py-3 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <LoadingSpinner size="sm" /> : '☁ Save to History'}
            </button>
          )}
        </div>
      )}

    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function HistoryTab({ currentUser, onLoad }: { currentUser: string; onLoad: (fs: FormState, title?: string | null, id?: string) => void }) {
  const [section, setSection] = useState<'mine' | 'shared'>('mine');
  const [mine, setMine] = useState<Arrangement[]>([]);
  const [shared, setShared] = useState<Arrangement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [m, s] = await Promise.all([
        getMyArrangements(currentUser),
        getSharedArrangements(currentUser),
      ]);
      setMine(m); setShared(s);
    } catch { setErr('Failed to load. Check your connection.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this arrangement?')) return;
    setActionId(id);
    try {
      await deleteArrangement(id);
      setMine(prev => prev.filter(a => a.id !== id));
    } catch (e) { console.error('Delete error:', e); alert('Failed to delete: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setActionId(null); }
  }

  async function handleToggleShare(arr: Arrangement) {
    setActionId(arr.id);
    try {
      const updated = await updateArrangement(arr.id, { is_shared: !arr.is_shared });
      setMine(prev => prev.map(a => a.id === arr.id ? updated : a));
    } catch (e) { console.error('Share error:', e); alert('Failed to update sharing: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setActionId(null); }
  }

  async function handleRename(id: string, newTitle: string) {
    if (!newTitle.trim()) { setEditingId(null); return; }
    setActionId(id);
    try {
      const updated = await updateArrangement(id, { title: newTitle.trim() });
      setMine(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e) { alert('Failed to rename: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setActionId(null); setEditingId(null); }
  }

  async function handleConclude(arr: Arrangement, siblingIds: string[]) {
    const newValue = !arr.is_concluded;
    const toUnconclude = siblingIds.filter(sid => sid !== arr.id);
    setActionId(arr.id);
    try {
      await Promise.all([
        ...(toUnconclude.length > 0 ? [setConcluded(toUnconclude, false)] : []),
        setConcluded([arr.id], newValue),
      ]);
      setMine(prev => prev.map(a => {
        if (a.id === arr.id) return { ...a, is_concluded: newValue };
        if (toUnconclude.includes(a.id)) return { ...a, is_concluded: false };
        return a;
      }));
    } catch (e) { alert('Failed to update: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setActionId(null); }
  }

  function Card({ arr, isOwn, siblingIds = [] }: { arr: Arrangement; isOwn: boolean; siblingIds?: string[] }) {
    const busy = actionId === arr.id;
    const isEditing = editingId === arr.id;
    const isConcluded = arr.is_concluded;
    const absent = arr.form_state.absentTeachers.length;
    const cancelled = arr.form_state.cancelledClasses.length;
    const subs = arr.report_rows.filter(r => r.Type !== 'CANCELLED').length;
    return (
      <div className={`bg-white border rounded-2xl p-4 mb-2 shadow-sm transition-all ${isConcluded ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-100'}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                onBlur={() => handleRename(arr.id, editTitle)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(arr.id, editTitle); if (e.key === 'Escape') setEditingId(null); }}
                className="w-full border border-blue-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {isConcluded && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">★ Final</span>}
                <span className="font-bold text-slate-800 text-sm">{arr.title || `${arr.day} · ${fmtDate(arr.date)}`}</span>
                {isOwn && (
                  <button onClick={() => { setEditingId(arr.id); setEditTitle(arr.title || ''); }}
                    className="text-slate-300 hover:text-blue-500 transition-colors flex-shrink-0 text-xs leading-none">✏</button>
                )}
              </div>
            )}
            <div className="text-xs text-slate-400 mt-0.5">
              {arr.day} · {fmtDate(arr.date)}
              <span className="mx-1 text-slate-200">·</span>
              {new Date(arr.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              <span className="mx-1 text-slate-200">·</span>
              {isOwn ? 'You' : arr.created_by.split('@')[0]}
            </div>
          </div>
          {arr.is_shared && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">Shared</span>
          )}
        </div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {absent > 0 && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">{absent} absent</span>}
          {cancelled > 0 && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">{cancelled} cancelled</span>}
          {subs > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">{subs} subs</span>}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onLoad(arr.form_state, arr.title, arr.id)}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all">
            Load
          </button>
          {siblingIds.length > 0 && (
            <button onClick={() => handleConclude(arr, siblingIds)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${isConcluded ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'}`}>
              {isConcluded ? '★ Final' : '☆ Conclude'}
            </button>
          )}
          {isOwn && (<>
            {(siblingIds.length === 0 || isConcluded) && (
              <button onClick={() => handleToggleShare(arr)} disabled={busy}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${arr.is_shared ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                {busy ? '…' : arr.is_shared ? 'Unshare' : 'Share'}
              </button>
            )}
            <button onClick={() => handleDelete(arr.id)} disabled={busy}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50">
              🗑
            </button>
          </>)}
        </div>
      </div>
    );
  }

  const list = section === 'mine' ? mine : shared;

  const grouped = useMemo(() => {
    const groups: Record<string, Arrangement[]> = {};
    for (const arr of list) {
      if (!groups[arr.date]) groups[arr.date] = [];
      groups[arr.date].push(arr);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, arrs]) => ({
        date,
        arrs: [...arrs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }));
  }, [list]);

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-100 p-1 mb-4 flex gap-1 shadow-sm">
        {(['mine', 'shared'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${section === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            {s === 'mine' ? `My Saved${mine.length ? ` (${mine.length})` : ''}` : `Shared${shared.length ? ` (${shared.length})` : ''}`}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm flex items-center gap-2">
          ⚠ {err}
          <button onClick={load} className="ml-auto text-xs font-bold underline">Retry</button>
        </div>
      )}

      {!loading && !err && (
        list.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <div className="text-4xl mb-3">{section === 'mine' ? '☁' : '🔗'}</div>
            <div className="font-bold text-slate-600 text-sm">
              {section === 'mine' ? 'No saved arrangements' : 'Nothing shared yet'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {section === 'mine' ? 'Generate a report and tap Save to History' : 'Other users haven\'t shared any arrangements'}
            </div>
          </div>
        ) : (
          grouped.map(({ date, arrs }) => {
            const hasMultiple = arrs.length > 1;
            const isExpanded = expandedDates.has(date);
            const allIds = arrs.map(a => a.id);
            // Put concluded version first, then by created_at desc
            const sorted = [...arrs].sort((a, b) => {
              if (a.is_concluded !== b.is_concluded) return a.is_concluded ? -1 : 1;
              return b.created_at.localeCompare(a.created_at);
            });
            const displayed = hasMultiple && !isExpanded ? [sorted[0]] : sorted;
            const toggleExpand = () => setExpandedDates(prev => {
              const next = new Set(prev);
              if (isExpanded) next.delete(date); else next.add(date);
              return next;
            });
            return (
              <div key={date}>
                {hasMultiple && (
                  <button
                    onClick={() => onLoad(sorted[0].form_state, sorted[0].title, sorted[0].id)}
                    className="w-full flex items-center gap-2 mt-2 mb-1.5 px-1 hover:opacity-75 transition-opacity text-left"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{arrs[0].day} · {fmtDate(date)}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      {arrs.length} versions
                    </span>
                    {arrs.some(a => a.is_concluded) && (
                      <span className="text-[10px] font-bold text-amber-700">★ concluded</span>
                    )}
                  </button>
                )}
                {displayed.map((arr, i) => (
                  <div key={arr.id} className={hasMultiple ? 'border-l-2 border-amber-200 pl-3 ml-1' : ''}>
                    {hasMultiple && i === 0 && !arr.is_concluded && (
                      <span className="inline-block text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 mb-1">Latest</span>
                    )}
                    {hasMultiple && i > 0 && (
                      <span className="inline-block text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 mb-1">Older</span>
                    )}
                    <Card arr={arr} isOwn={section === 'mine'} siblingIds={hasMultiple ? allIds : []} />
                  </div>
                ))}
                {hasMultiple && (
                  <button onClick={toggleExpand}
                    className="ml-4 mb-3 text-xs font-semibold text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-full transition-all">
                    {isExpanded ? '▲ Show less' : `▼ ${arrs.length - 1} older version${arrs.length > 2 ? 's' : ''}`}
                  </button>
                )}
              </div>
            );
          })
        )
      )}

      {!loading && (
        <div className="flex justify-center mt-2">
          <button onClick={load} className="text-xs font-semibold text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 px-4 py-2 rounded-full transition-all">
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Period Row
// ─────────────────────────────────────────────────────────────────────────────
interface PeriodRowProps {
  df: TimetableRow[]; e: AbsentPeriod; teacher: string; selectedDay: string;
  absentTeachers: string[]; absentPeriods: AbsentPeriod[];
  absenceConfigs: Record<string, AbsenceConfig>;
  cancelledClasses: string[]; cancelledClassConfigs: Record<string, CancelledClassConfig>; useCancelledTeachers: boolean;
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
}

function PeriodRow({
  df, e, teacher, selectedDay, absentTeachers, absentPeriods,
  absenceConfigs, cancelledClasses, cancelledClassConfigs, useCancelledTeachers,
  subs, clubs, subWl, onSetSub, onSetClub,
}: PeriodRowProps) {
  const k = subKey(e.teacher, e.period);
  const currentSub = subs[k] ?? '';
  const clubMode = clubs[k] ?? false;
  const isAssigned = !!currentSub;

  const periodBusy = useMemo(
    () => busySetExcludingCancelled(df, selectedDay, e.period, cancelledClasses, useCancelledTeachers, cancelledClassConfigs),
    [df, selectedDay, e.period, cancelledClasses, useCancelledTeachers, cancelledClassConfigs],
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
                      {shortName(t)}  [{effectiveLoad(df, t, selectedDay, cancelledClasses, cancelledClassConfigs) + (subWl[t] ?? 0)} periods]
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
  cancelledClasses: string[]; cancelledClassConfigs: Record<string, CancelledClassConfig>;
  schoolMaxPeriod: number;
}

function TeacherStatusTab({ df, allTeachers, absentTeachers, absentPeriods, absenceConfigs, selectedDay, subs, clubs, cancelledClasses, cancelledClassConfigs, schoolMaxPeriod }: StatusProps) {
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
            const clsCfg = cancelledClassConfigs[row.Class];
            const isPeriodCancelled = !clsCfg?.halfDay || clsCfg.cancelledPeriods.includes(p);
            if (!isPeriodCancelled) {
              periodStatus[p] = 'teaching'; periodClass[p] = `${row.Class} · ${row.Subject}`;
            } else if (subPs.has(p)) {
              periodStatus[p] = 'sub'; periodClass[p] = `${subForCls[p]} · Sub for ${shortName(subFor[p])}`;
            } else {
              periodStatus[p] = 'free'; periodClass[p] = `${row.Class} cancelled`;
            }
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
  }, [df, presentTeachers, selectedDay, absentPeriods, subs, clubs, absenceConfigs, cancelledClasses, cancelledClassConfigs]);

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
      const inCancelList = cancelledClasses.includes(cls);
      const cfg = inCancelList ? (cancelledClassConfigs[cls] ?? { halfDay: false, cancelledPeriods: [] }) : null;
      const cancelledPeriodNums: number[] = (inCancelList && cfg!.cancelledPeriods.length > 0) ? cfg!.cancelledPeriods : [];
      const isCancelled = inCancelList && cancelledPeriodNums.length === 0;
      const periods = activePeriods.flatMap(p => {
        const row = df.find(r => r.Class === cls && r.Day === selectedDay && r.Period === p && !isNotReq(r.Subject));
        if (!row) return [];
        const isAbsent = isTeacherAbsentInPeriod(row.Teacher_Name, p, absentTeachers, absenceConfigs);
        const sub = isAbsent ? (subs[`${row.Teacher_Name}__${p}`] || null) : null;
        const isClub = isAbsent && !!(sub) && !!(clubs[`${row.Teacher_Name}__${p}`]);
        return [{ period: p, teacher: row.Teacher_Name, subject: row.Subject, isAbsent, substitute: sub, isClub }];
      });
      return { cls, periods, isCancelled, cancelledPeriodNums };
    }).filter(c => c.periods.length > 0);
  }, [df, selectedDay, absentTeachers, absenceConfigs, subs, clubs, cancelledClasses, cancelledClassConfigs]);

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

function ClassStatusCard({ cd }: { cd: { cls: string; periods: ClassPeriodInfo[]; isCancelled: boolean; cancelledPeriodNums: number[] } }) {
  const isPartialCancel = cd.cancelledPeriodNums.length > 0;
  const hasIssue = !cd.isCancelled && cd.periods.some(p => p.isAbsent && !p.substitute && !cd.cancelledPeriodNums.includes(p.period));

  return (
    <div className={`rounded-2xl p-3.5 shadow-sm border hover:shadow-md transition-shadow ${
      cd.isCancelled ? 'bg-orange-50 border-orange-200' :
      isPartialCancel ? 'bg-orange-50/40 border-orange-100' :
      hasIssue ? 'bg-white border-amber-200' : 'bg-white border-slate-100'
    }`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm ${
          cd.isCancelled ? 'bg-orange-400' : isPartialCancel ? 'bg-orange-300' : 'bg-blue-600'
        }`}>
          {cd.cls.replace(' ', '')}
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-800">Class {cd.cls}</div>
          {cd.isCancelled
            ? <div className="text-xs font-semibold text-orange-600">🚫 Cancelled</div>
            : isPartialCancel
            ? <div className="text-xs font-semibold text-orange-500">🚫 P{cd.cancelledPeriodNums.join(', P')} cancelled</div>
            : <div className="text-xs text-slate-400">{cd.periods.length} periods</div>
          }
        </div>
        {hasIssue && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">⚠ Issues</span>
        )}
      </div>

      <div className="space-y-1">
        {cd.periods.map(p => {
          const isPeriodCancelled = cd.isCancelled || cd.cancelledPeriodNums.includes(p.period);
          return (
            <div key={p.period} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
              isPeriodCancelled ? 'bg-orange-50/60 border border-orange-100' :
              p.isAbsent && !p.substitute ? 'bg-red-50 border border-red-100' :
              p.isClub ? 'bg-orange-50 border border-orange-100' :
              p.isAbsent ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'
            }`}>
              <span className="font-bold text-blue-700 w-5 flex-shrink-0">P{p.period}</span>
              <span className="text-slate-400 w-14 flex-shrink-0 truncate">{p.subject}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                {isPeriodCancelled ? (
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
          );
        })}
      </div>
    </div>
  );
}
