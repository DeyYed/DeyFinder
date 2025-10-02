import { type ChangeEvent } from 'react'

export type ResumeUploadCardProps = {
  resumeFile: File | null
  resumeName: string
  resumeSizeLabel: string
  preferredLocation: string
  customPrompt: string
  remoteEnabled: boolean
  isAnalyzing: boolean
  error: string | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPreferredLocationChange: (value: string) => void
  onCustomPromptChange: (value: string) => void
  onRemoteToggle: () => void
  onAnalyze: () => void
}

export function ResumeUploadCard({
  resumeFile,
  resumeName,
  resumeSizeLabel,
  preferredLocation,
  customPrompt,
  remoteEnabled,
  isAnalyzing,
  error,
  onFileChange,
  onPreferredLocationChange,
  onCustomPromptChange,
  onRemoteToggle,
  onAnalyze,
}: ResumeUploadCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Upload your resume</h2>
          <p className="text-sm text-slate-600">
            Accepts PDF, DOCX, or TXT up to 5 MB. Your files stay private to this session.
          </p>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-slate-400 hover:bg-slate-100">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={onFileChange}
          />
          <div className="flex size-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600">
            <span className="text-2xl">⬆️</span>
          </div>
          {resumeFile ? (
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">{resumeName}</p>
              <p className="text-xs text-slate-500">{resumeSizeLabel}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">Drop your resume</p>
              <p className="text-xs text-slate-500">or click to browse files</p>
            </div>
          )}
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Preferred location (optional)
            </label>
            <input
              value={preferredLocation}
              onChange={(event) => onPreferredLocationChange(event.target.value)}
              placeholder="e.g. Pampanga, Philippines"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              What should we prioritize? (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(event) => onCustomPromptChange(event.target.value)}
              rows={3}
              placeholder="Tech stack, industries, salary range? Tell the AI what matters."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Include remote-friendly roles</p>
            <p className="text-xs text-slate-500">
              Toggle on to prioritize remote or remote-first opportunities.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={remoteEnabled}
            onClick={onRemoteToggle}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-150 ease-out ${remoteEnabled ? 'bg-slate-900' : 'bg-slate-300'}`}
          >
            <span className="sr-only">Include remote roles</span>
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-150 ease-out ${remoteEnabled ? 'translate-x-7' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <div className="space-y-3">
          <button
            disabled={!resumeFile || isAnalyzing}
            onClick={onAnalyze}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isAnalyzing ? 'Analyzing resume…' : 'Find Jobs'}
          </button>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <p className="text-xs leading-relaxed text-slate-500">
            Files are processed in-memory for this session only. Clear the workspace anytime to remove your data.
          </p>
        </div>
      </div>
    </section>
  )
}
