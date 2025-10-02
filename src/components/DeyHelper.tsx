import { WandSparkles } from 'lucide-react'

type DeyHelperProps = {
  showPanel: boolean
  onToggle: () => void
  onClose: () => void
}

export function DeyHelper({ showPanel, onToggle, onClose }: DeyHelperProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {showPanel ? (
        <aside className="pointer-events-auto w-72 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Meet Dey</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">Your search co-pilot</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="rounded-2xl bg-slate-50 p-3">1. Upload a resume—PDF, DOCX, or TXT up to 5 MB.</li>
            <li className="rounded-2xl bg-slate-50 p-3">2. Add the location and priorities you want Dey to scout.</li>
            <li className="rounded-2xl bg-slate-50 p-3">3. Press <span className="font-semibold text-slate-900">Find Jobs</span> to unlock insights, strengths, and found jobs.</li>
          </ul>
        </aside>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-300"
        aria-label="Toggle Dey help panel"
      >
        <WandSparkles className="h-6 w-6" />
      </button>
    </div>
  )
}
