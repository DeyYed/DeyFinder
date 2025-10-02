type SiteHeaderProps = {
  onReset: () => void
}

export function SiteHeader({ onReset }: SiteHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="space-y-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">Smart job finder</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">DeyFind</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            DeyFind pairs your resume with AI-driven insights to surface roles to find jobs that fit your profile.
          </p>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Reset workspace
        </button>
      </div>
    </header>
  )
}
