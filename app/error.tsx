'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 text-sm font-medium mb-3">Something went wrong.</p>
        <button onClick={reset}
          className="text-xs font-semibold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all">
          Try again
        </button>
      </div>
    </div>
  );
}
