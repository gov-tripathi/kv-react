'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  TimetableRow, AbsentPeriod, ReportRow, TeacherData,
} from '@/lib/types';
import {
  ALL_PERIODS, DAY_MAP,
  avColor, avInitials, shortName, getAllTeachers,
  getSchedule, busySet, teacherPeriodInfo, masterLoad,
  buildAbsentPeriods, computeSubWorkload, autoFillAll,
  buildReportRows, whatsappText,
} from '@/lib/timetable';
import { generatePDF } from '@/lib/pdf';

// ─── tiny helpers ────────────────────────────────────────────────────────────
const subKey = (teacher: string, period: number) => `${teacher}__${period}`;

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function App() {
  const [df, setDf] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'arrangement' | 'status'>('arrangement');
  const [dateVal, setDateVal] = useState(todayDate);
  const selectedDay = useMemo(() => {
    const d = new Date(dateVal + 'T00:00:00');
    return DAY_MAP[d.getDay()] ?? 'MON';
  }, [dateVal]);
  const [absentTeachers, setAbsentTeachers] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [clubs, setClubs] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [log, setLog] = useState<ReportRow[]>([]);
  const [showLog, setShowLog] = useState(false);

  // Load timetable CSV
  useEffect(() => {
    fetch('/timetable_master.csv')
      .then(r => r.text())
      .then(csv => {
        const result = Papa.parse<TimetableRow>(csv, {
          header: true, dynamicTyping: true, skipEmptyLines: true,
        });
        setDf(result.data);
        setLoading(false);
      });
  }, []);

  // Load log from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kv_arrangement_log');
      if (saved) setLog(JSON.parse(saved));
    } catch {}
  }, []);

  const allTeachers = useMemo(() => getAllTeachers(df), [df]);

  const absentPeriods = useMemo(
    () => buildAbsentPeriods(df, absentTeachers, selectedDay),
    [df, absentTeachers, selectedDay],
  );

  // Reset subs/clubs when day changes
  useEffect(() => {
    setSubs({});
    setClubs({});
    setReport(null);
  }, [selectedDay, absentTeachers]);

  const subWl = useMemo(
    () => computeSubWorkload(absentPeriods, subs),
    [absentPeriods, subs],
  );

  const covered = useMemo(
    () => absentPeriods.filter(e => !!subs[subKey(e.teacher, e.period)]).length,
    [absentPeriods, subs],
  );

  const handleAutoFill = useCallback(() => {
    const newSubs = autoFillAll(df, absentPeriods, absentTeachers, selectedDay, subs);
    setSubs(newSubs);
    setReport(null);
  }, [df, absentPeriods, absentTeachers, selectedDay, subs]);

  const handleSetSub = useCallback((teacher: string, period: number, val: string) => {
    setSubs(prev => ({ ...prev, [subKey(teacher, period)]: val }));
    setReport(null);
  }, []);

  const handleSetClub = useCallback((teacher: string, period: number, val: boolean) => {
    setClubs(prev => ({ ...prev, [subKey(teacher, period)]: val }));
    setSubs(prev => ({ ...prev, [subKey(teacher, period)]: '' }));
    setReport(null);
  }, []);

  const handleGenerateReport = useCallback(() => {
    const rows = buildReportRows(df, absentPeriods, subs, clubs, selectedDay, dateVal);
    setReport(rows);
    // Persist to log
    const newLog = [...log, ...rows];
    setLog(newLog);
    try { localStorage.setItem('kv_arrangement_log', JSON.stringify(newLog)); } catch {}
  }, [df, absentPeriods, subs, clubs, selectedDay, dateVal, log]);

  const handleDownloadPDF = useCallback(async () => {
    if (!report) return;
    setPdfLoading(true);
    await generatePDF(report, selectedDay, dateVal);
    setPdfLoading(false);
  }, [report, selectedDay, dateVal]);

  const handleDownloadCSV = useCallback(() => {
    if (!report) return;
    const headers = Object.keys(report[0]).join(',');
    const body = report.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `arrangement_${dateVal}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [report, dateVal]);

  const handleDownloadLog = useCallback(() => {
    if (!log.length) return;
    const headers = Object.keys(log[0]).join(',');
    const body = log.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'arrangements_log.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [log]);

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading timetable…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-3xl mx-auto px-3 py-4 pb-20">

        {/* Header */}
        <div className="rounded-2xl p-5 mb-4 text-white flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 60%,#3B82F6 100%)', boxShadow: '0 4px 24px rgba(37,99,235,.3)' }}>
          <img src="/2023042075.png" alt="KV Logo" className="h-12 w-auto flex-shrink-0 object-contain" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.25))' }} />
          <div className="flex-1 text-center">
            <h1 className="text-xl font-extrabold tracking-tight">🏫 KV Burhanpur</h1>
            <p className="text-xs opacity-75 mt-0.5">Teacher Arrangement &amp; Substitution · Academic Year 2026-27</p>
          </div>
          <img src="/2025021137.png" alt="PM SHRI Logo" className="h-9 w-auto flex-shrink-0 object-contain" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.25))' }} />
        </div>

        {/* Morning Setup */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Morning Setup</p>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">Date</label>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{selectedDay}</span>
            </div>
            <input
              type="date" value={dateVal}
              onChange={e => { setDateVal(e.target.value); setAbsentTeachers([]); }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Absent teacher multi-select */}
          <label className="block text-xs text-slate-500 mb-1">Mark Teachers as Absent</label>
          <div className="relative">
            <input
              type="text" placeholder="Search or tap to see all teachers…"
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              onFocus={() => setShowTeacherDropdown(true)}
              onBlur={() => setTimeout(() => setShowTeacherDropdown(false), 150)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-800 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {showTeacherDropdown && (
              <div className="absolute z-20 left-0 right-0 top-full -mt-1 border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto shadow-lg bg-white">
                {allTeachers
                  .filter(t => !absentTeachers.includes(t) && t.toLowerCase().includes(teacherSearch.toLowerCase()))
                  .map(t => (
                    <button key={t}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setAbsentTeachers(prev => [...prev, t]); setTeacherSearch(''); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-100 last:border-0">
                      {shortName(t)}
                    </button>
                  ))
                }
                {allTeachers.filter(t => !absentTeachers.includes(t) && t.toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2.5 text-sm text-slate-400">No teachers found</div>
                )}
              </div>
            )}
          </div>
          {/* Selected absent pills */}
          {absentTeachers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {absentTeachers.map(t => (
                <span key={t} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {shortName(t)}
                  <button onClick={() => setAbsentTeachers(prev => prev.filter(x => x !== t))} className="ml-0.5 text-red-400 hover:text-red-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
          {(['arrangement', 'status'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
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
            selectedDay={selectedDay} dateVal={dateVal}
            subs={subs} clubs={clubs} subWl={subWl} covered={covered}
            report={report} pdfLoading={pdfLoading}
            log={log} showLog={showLog} setShowLog={setShowLog}
            onAutoFill={handleAutoFill}
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
            selectedDay={selectedDay} subs={subs}
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
  selectedDay: string; dateVal: string;
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>; covered: number;
  report: ReportRow[] | null; pdfLoading: boolean;
  log: ReportRow[]; showLog: boolean; setShowLog: (v: boolean) => void;
  onAutoFill: () => void;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
  onGenerateReport: () => void;
  onDownloadPDF: () => void;
  onDownloadCSV: () => void;
  onDownloadLog: () => void;
}

function ArrangementTab({
  df, absentTeachers, absentPeriods, selectedDay, dateVal,
  subs, clubs, subWl, covered, report, pdfLoading,
  log, showLog, setShowLog,
  onAutoFill, onSetSub, onSetClub, onGenerateReport,
  onDownloadPDF, onDownloadCSV, onDownloadLog,
}: ArrProps) {

  if (!absentTeachers.length) return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-3">☀️</div>
      <div className="font-semibold text-slate-600">Good morning!</div>
      <div className="text-sm mt-1">Mark absent teachers above to begin the arrangement.</div>
    </div>
  );

  if (!absentPeriods.length) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
      None of the selected teachers have classes on <strong>{selectedDay}</strong>.
    </div>
  );

  const total = absentPeriods.length;
  const pct = total ? covered / total : 0;

  return (
    <>
      {/* Progress */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="text-2xl font-extrabold text-slate-800">
              {covered}<span className="text-lg font-medium text-slate-400"> / {total}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Periods covered</div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
          <div className="text-center px-3">
            <div className="text-xl font-extrabold text-red-500">{total - covered}</div>
            <div className="text-xs text-slate-500">Pending</div>
          </div>
          <div className="text-center px-3">
            <div className="text-xl font-extrabold text-emerald-500">{absentTeachers.length}</div>
            <div className="text-xs text-slate-500">Absent</div>
          </div>
          <button onClick={onAutoFill}
            className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
            ⚡ Auto-Fill
          </button>
        </div>
      </div>

      {/* Per-teacher cards */}
      {absentTeachers.map(teacher => {
        const tPeriods = absentPeriods.filter(e => e.teacher === teacher);
        if (!tPeriods.length) return null;
        const tCov = tPeriods.filter(e => !!subs[subKey(e.teacher, e.period)]).length;

        return (
          <div key={teacher} className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
            {/* Teacher header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: avColor(teacher) }}>
                {avInitials(teacher)}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">{shortName(teacher)}</div>
                <div className="text-xs text-slate-400">{tPeriods.length} periods · {tCov}/{tPeriods.length} assigned</div>
              </div>
            </div>

            {/* Period rows */}
            {tPeriods.map(e => (
              <PeriodRow key={e.period}
                df={df} e={e} teacher={teacher} selectedDay={selectedDay}
                absentTeachers={absentTeachers} absentPeriods={absentPeriods}
                subs={subs} clubs={clubs} subWl={subWl}
                onSetSub={onSetSub} onSetClub={onSetClub}
              />
            ))}
          </div>
        );
      })}

      {/* Generate Report */}
      <button onClick={onGenerateReport}
        className="w-full py-3.5 rounded-2xl font-bold text-white text-sm mb-4 transition-all hover:opacity-90 active:scale-95"
        style={{ background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', boxShadow: '0 4px 14px rgba(59,130,246,.4)' }}>
        📋 Finalise &amp; Generate Report
      </button>

      {/* Report */}
      {report && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Arrangement Sheet · {selectedDay} {dateVal}
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-700 text-white">
                  {['Per.', 'Absent Teacher', 'Class', 'Substitute', 'Mode'].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-2 font-medium text-blue-700">{r.Period}</td>
                    <td className="px-2 py-2">{shortName(r.Absent_Teacher)}</td>
                    <td className="px-2 py-2">{r.Class}</td>
                    <td className="px-2 py-2">
                      {r.Type === 'CLUBBED'
                        ? <span className="text-amber-700 font-semibold">🔀 {shortName(r.Substitute)}{r.Sub_Own_Class ? ` (${r.Sub_Own_Class})` : ''}</span>
                        : <span className="font-semibold text-slate-800">{shortName(r.Substitute)}</span>
                      }
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${r.Type === 'CLUBBED' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {r.Type === 'CLUBBED' ? 'CLUB' : 'SUB'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WhatsApp text */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">📱 WhatsApp Summary</p>
            <textarea
              readOnly
              value={whatsappText(report, selectedDay, dateVal)}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono bg-slate-50 resize-none h-40 text-slate-700"
            />
          </div>

          {/* Download buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={onDownloadPDF} disabled={pdfLoading}
              className="py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-60">
              {pdfLoading ? '…' : '📄 PDF'}
            </button>
            <button onClick={onDownloadCSV}
              className="py-2.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
              ⬇ CSV
            </button>
            <button onClick={() => {
              const wa = whatsappText(report, selectedDay, dateVal);
              const blob = new Blob([wa], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `arrangement_${dateVal}.txt`; a.click();
              URL.revokeObjectURL(url);
            }}
              className="py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
              📱 Text
            </button>
          </div>
        </div>
      )}

      {/* Past Log */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        <button onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-600 font-medium hover:bg-slate-50">
          <span>📂 Past Arrangements Log ({log.length} records)</span>
          <span>{showLog ? '▲' : '▼'}</span>
        </button>
        {showLog && (
          <div className="border-t border-slate-100 p-4">
            {log.length === 0
              ? <p className="text-xs text-slate-400">No arrangements saved yet.</p>
              : (
                <>
                  <button onClick={onDownloadLog}
                    className="mb-3 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition-colors">
                    ⬇ Download Full Log
                  </button>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          {['Date', 'Day', 'Period', 'Absent', 'Sub', 'Type'].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {log.slice(-30).reverse().map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-2 py-1.5">{r.Date}</td>
                            <td className="px-2 py-1.5">{r.Day}</td>
                            <td className="px-2 py-1.5">{r.Period}</td>
                            <td className="px-2 py-1.5">{shortName(r.Absent_Teacher)}</td>
                            <td className="px-2 py-1.5">{shortName(r.Substitute)}</td>
                            <td className="px-2 py-1.5">{r.Type}</td>
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
  subs: Record<string, string>; clubs: Record<string, boolean>;
  subWl: Record<string, number>;
  onSetSub: (t: string, p: number, v: string) => void;
  onSetClub: (t: string, p: number, v: boolean) => void;
}

function PeriodRow({
  df, e, teacher, selectedDay, absentTeachers, absentPeriods,
  subs, clubs, subWl, onSetSub, onSetClub,
}: PeriodRowProps) {
  const k = subKey(e.teacher, e.period);
  const currentSub = subs[k] ?? '';
  const clubMode = clubs[k] ?? false;
  const isAssigned = !!currentSub;

  const periodBusy = useMemo(() => busySet(df, selectedDay, e.period), [df, selectedDay, e.period]);
  const alreadyThis = useMemo(() => new Set(
    absentPeriods
      .filter(e2 => e2.period === e.period && e2.teacher !== teacher)
      .map(e2 => subs[subKey(e2.teacher, e2.period)] ?? '')
      .filter(Boolean),
  ), [absentPeriods, e.period, teacher, subs]);

  const allTeachers = useMemo(() => getAllTeachers(df), [df]);

  const unavail = useMemo(
    () => new Set([...periodBusy, ...alreadyThis, ...absentTeachers]),
    [periodBusy, alreadyThis, absentTeachers],
  );

  const freeTeachers = useMemo(
    () => allTeachers.filter(t => !unavail.has(t))
      .sort((a, b) => (masterLoad(df, a, selectedDay) + (subWl[a] ?? 0)) - (masterLoad(df, b, selectedDay) + (subWl[b] ?? 0))),
    [allTeachers, unavail, df, selectedDay, subWl],
  );

  const clubTeachers = useMemo(
    () => allTeachers.filter(t => (periodBusy.has(t) || alreadyThis.has(t)) && !absentTeachers.includes(t)),
    [allTeachers, periodBusy, alreadyThis, absentTeachers],
  );

  function clubLabel(t: string): string {
    if (periodBusy.has(t)) {
      const [cls] = teacherPeriodInfo(df, t, selectedDay, e.period);
      return `${shortName(t)}  ⚠ teaching ${cls}`;
    }
    for (const e2 of absentPeriods) {
      if (e2.period === e.period && e2.teacher !== teacher) {
        if ((subs[subKey(e2.teacher, e2.period)] ?? '') === t)
          return `${shortName(t)}  🔀 subbing ${e2.cls}`;
      }
    }
    return shortName(t);
  }

  let statusEl: React.ReactNode;
  if (clubMode && !isAssigned) {
    statusEl = <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">🔀 Club — select teacher</span>;
  } else if (!isAssigned) {
    statusEl = <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">● Unassigned</span>;
  } else if (clubMode) {
    const [tc] = teacherPeriodInfo(df, currentSub, selectedDay, e.period);
    statusEl = <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">🔀 Clubbed · {shortName(currentSub)}{tc ? ` (${tc})` : ''}</span>;
  } else {
    statusEl = (
      <span className="text-xs font-semibold text-emerald-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex items-center gap-1">
        <span className="w-4 h-4 rounded-full text-white flex items-center justify-center text-xs leading-none flex-shrink-0 font-bold"
          style={{ background: avColor(currentSub), fontSize: '0.5rem' }}>
          {avInitials(currentSub)}
        </span>
        {shortName(currentSub)}
      </span>
    );
  }

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className={`min-w-[28px] h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          clubMode ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
        }`}>
          P{e.period}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-800 truncate">{e.cls} · {e.subj}</div>
        </div>
        {statusEl}
      </div>

      {/* Selectbox row */}
      <div className="px-4 pb-3 flex gap-2">
        {!clubMode ? (
          <>
            <select
              value={currentSub}
              onChange={e2 => onSetSub(teacher, e.period, e2.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-2 py-1.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— Not Assigned —</option>
              {freeTeachers.map(t => (
                <option key={t} value={t}>
                  {shortName(t)}  [{masterLoad(df, t, selectedDay) + (subWl[t] ?? 0)} periods]
                </option>
              ))}
            </select>
            <button
              onClick={() => onSetClub(teacher, e.period, true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
              🔀 Club
            </button>
          </>
        ) : (
          <>
            <select
              value={currentSub}
              onChange={e2 => onSetSub(teacher, e.period, e2.target.value)}
              className="flex-1 border border-amber-200 rounded-xl px-2 py-1.5 text-xs bg-amber-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— Not Assigned —</option>
              {clubTeachers.map(t => (
                <option key={t} value={t}>{clubLabel(t)}</option>
              ))}
            </select>
            <button
              onClick={() => { onSetClub(teacher, e.period, false); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap">
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
  selectedDay: string; subs: Record<string, string>;
}

function TeacherStatusTab({ df, allTeachers, absentTeachers, absentPeriods, selectedDay, subs }: StatusProps) {
  const presentTeachers = allTeachers.filter(t => !absentTeachers.includes(t));

  const teacherData: TeacherData[] = useMemo(() => {
    return presentTeachers.map(t => {
      const masterPs = new Set(
        df.filter(r => r.Teacher_Name === t && r.Day === selectedDay).map(r => r.Period),
      );
      const subPs = new Set<number>();
      const subFor: Record<number, string> = {};
      for (const e of absentPeriods) {
        if ((subs[subKey(e.teacher, e.period)] ?? '') === t) {
          subPs.add(e.period); subFor[e.period] = e.teacher;
        }
      }
      const periodStatus: Record<number, 'teaching' | 'sub' | 'free'> = {};
      const periodClass: Record<number, string> = {};
      for (const p of ALL_PERIODS) {
        if (masterPs.has(p)) {
          periodStatus[p] = 'teaching';
          const row = df.find(r => r.Teacher_Name === t && r.Day === selectedDay && r.Period === p);
          periodClass[p] = row?.Class ?? '';
        } else if (subPs.has(p)) {
          periodStatus[p] = 'sub';
          periodClass[p] = `Sub for ${shortName(subFor[p])}`;
        } else {
          periodStatus[p] = 'free';
          periodClass[p] = '';
        }
      }
      const freeCount = Object.values(periodStatus).filter(s => s === 'free').length;
      return {
        name: t, periodStatus, periodClass,
        masterCount: masterPs.size, subCount: subPs.size, freeCount,
      };
    }).sort((a, b) => b.freeCount - a.freeCount || a.name.localeCompare(b.name));
  }, [df, presentTeachers, selectedDay, absentPeriods, subs]);

  const nPresent = presentTeachers.length;
  const nAbsent = absentTeachers.length;
  const nFreeAll = teacherData.filter(td => td.freeCount === 8).length;
  const nOnSub = teacherData.filter(td => td.subCount > 0).length;

  const tiles = [
    { val: nPresent, lbl: 'Present', desc: 'In school today', col: '#10B981' },
    { val: nAbsent, lbl: 'Absent', desc: 'On leave', col: '#EF4444' },
    { val: nFreeAll, lbl: 'Fully Free', desc: 'No classes', col: '#3B82F6' },
    { val: nOnSub, lbl: 'On Sub', desc: 'Covering absent', col: '#F59E0B' },
  ];

  return (
    <>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {tiles.map(({ val, lbl, desc, col }) => (
          <div key={lbl} className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <div className="text-2xl font-extrabold" style={{ color: col }}>{val}</div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mt-0.5">{lbl}</div>
            <div className="text-xs text-slate-300 mt-0.5">{desc}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 flex-wrap">
        {[['#3B82F6', 'Teaching'], ['#F59E0B', 'Substituting'], ['#E2E8F0', 'Free']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>

      {/* Absent pills */}
      {absentTeachers.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-xs text-red-700">
          🔴 <strong>Absent:</strong>{' '}
          {absentTeachers.map(t => (
            <span key={t} className="inline-block bg-red-100 border border-red-200 rounded-full px-2 py-0.5 mr-1 mb-1 font-semibold">
              {shortName(t)}
            </span>
          ))}
        </div>
      )}

      {/* Teacher grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teacherData.map(td => (
          <TeacherStatusCard key={td.name} td={td} />
        ))}
      </div>
    </>
  );
}

function TeacherStatusCard({ td }: { td: TeacherData }) {
  const [expanded, setExpanded] = useState(false);
  const busyCount = 8 - td.freeCount;
  const loadPct = busyCount / 8;
  const barColor = loadPct >= 0.75 ? '#EF4444' : loadPct >= 0.5 ? '#F59E0B' : '#10B981';

  const dotColor = { teaching: '#3B82F6', sub: '#F59E0B', free: '#E2E8F0' };
  const dotText = { teaching: '#fff', sub: '#fff', free: '#94A3B8' };

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: avColor(td.name) }}>
          {avInitials(td.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{shortName(td.name)}</div>
          <div className="text-xs text-slate-400">
            <span className="text-emerald-500 font-semibold">{td.freeCount} free</span>
            {' · '}{busyCount} busy
          </div>
        </div>
      </div>
      {/* Load bar */}
      <div className="h-1 bg-slate-100 rounded-full mb-2.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${loadPct * 100}%`, background: barColor }} />
      </div>
      {/* Period dots */}
      <div className="flex gap-1 flex-wrap mb-2">
        {ALL_PERIODS.map(p => {
          const s = td.periodStatus[p];
          const lbl = s === 'teaching' ? 'T' : s === 'sub' ? 'S' : String(p);
          return (
            <div key={p} title={`P${p}: ${td.periodClass[p] || s}`}
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-default"
              style={{ background: dotColor[s], color: dotText[s] }}>
              {lbl}
            </div>
          );
        })}
      </div>
      {/* Details toggle */}
      <button onClick={() => setExpanded(!expanded)}
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
        {expanded ? '▲ Hide details' : '▼ Show details'}
      </button>
      {expanded && (
        <div className="mt-2 border-t border-slate-50 pt-2">
          {ALL_PERIODS.map(p => (
            <div key={p} className="flex items-center gap-2 py-0.5">
              <span className="w-5 text-xs text-slate-400 font-medium">P{p}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor[td.periodStatus[p]] }} />
              <span className="text-xs text-slate-600">{td.periodClass[p] || td.periodStatus[p]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
