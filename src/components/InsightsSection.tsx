import { type AnalysisResult, type JobPosting } from '../types'
import { JobCard } from './JobCard'

type InsightsSectionProps = {
  analysis: AnalysisResult | null
  isLoading: boolean
  isFetchingJobs: boolean
  jobs: JobPosting[]
  paginatedJobs: JobPosting[]
  infoMessage: string
  currentPage: number
  totalPages: number
  pageNumbers: number[]
  onGoToPage: (page: number) => void
  onFindMoreJobs: () => void
  isFindingMoreJobs: boolean
  hasBroadenedSearch: boolean
}

export function InsightsSection({
  analysis,
  isLoading,
  isFetchingJobs,
  jobs,
  paginatedJobs,
  infoMessage,
  currentPage,
  totalPages,
  pageNumbers,
  onGoToPage,
  onFindMoreJobs,
  isFindingMoreJobs,
  hasBroadenedSearch,
}: InsightsSectionProps) {
  const hasResults = jobs.length > 0

  return (
    <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Scroll down to explore your insights and job matches.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full border px-3 py-1 ${analysis ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
              {analysis ? 'Insights ready' : 'Awaiting upload'}
            </span>
            <span className={`rounded-full border px-3 py-1 ${isFetchingJobs ? 'border-slate-200 bg-slate-100 text-slate-600' : hasResults ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
              {isFetchingJobs ? 'Fetching jobs…' : hasResults ? `${jobs.length} matches` : 'Jobs pending'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Finding roles that align with your profile…
          </div>
        ) : analysis ? (
          <div className="space-y-10">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Signature strengths</h3>
              {analysis.strengths.length ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.strengths.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  The AI didn't surface signature strengths this round. Try adding more specific achievements to your resume.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">High-impact keywords</h3>
              {analysis.keywords.length ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No standout keywords detected. Emphasize tools, outcomes, or metrics so the AI can amplify them.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Search blueprint</h3>
              {analysis.jobQueries.length ? (
                <div className="space-y-2">
                  {analysis.jobQueries.map((query) => (
                    <div
                      key={`${query.title}-${query.query}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"
                    >
                      <span className="font-semibold text-slate-900">{query.title}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600">
                        {query.query}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  The AI could not derive search queries. Add more detail or a custom priority to refine the blueprint.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Found Jobs</h3>
                {hasResults ? (
                  <span className="text-xs font-semibold text-slate-500">Page {currentPage} of {totalPages}</span>
                ) : null}
              </div>

              {infoMessage ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  {infoMessage}
                </div>
              ) : null}

              {hasResults ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {paginatedJobs.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                  {totalPages > 1 ? (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onGoToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => onGoToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {pageNumbers.map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => onGoToPage(page)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${page === currentPage ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'}`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    <p>
                      Need more options? We can broaden the search to include additional locations and related roles.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={onFindMoreJobs}
                        disabled={isFindingMoreJobs}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isFindingMoreJobs ? 'Finding more jobs…' : 'Find more jobs'}
                      </button>
                      <span className="text-xs text-amber-600">
                        This will expand beyond your preferred location and may surface varied seniorities.
                      </span>
                      {hasBroadenedSearch ? (
                        <span className="text-xs font-semibold text-amber-700">
                          Expanded search active.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  We will surface roles as soon as the AI has queries to follow. Try refining your prompt or regenerating to explore more matches.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Upload your resume and generate matches to unlock tailored strengths, search blueprints, and find job pages.
          </div>
        )}
      </div>
    </section>
  )
}
