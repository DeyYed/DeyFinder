import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { WandSparkles } from 'lucide-react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5174'

type JobQuery = {
  title: string
  query: string
}

type AnalysisResult = {
  summary: string
  keywords: string[]
  jobQueries: JobQuery[]
  strengths: string[]
  nextSteps: string[]
}

type JobPosting = {
  id: string
  title: string
  company?: string
  location?: string
  salary?: string
  description?: string
  url: string
  source?: string
  postedAt?: string
}

const JOBS_PER_PAGE = 6

function App() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeName, setResumeName] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFetchingJobs, setIsFetchingJobs] = useState(false)
  const [isFindingMoreJobs, setIsFindingMoreJobs] = useState(false)
  const [hasBroadenedSearch, setHasBroadenedSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preferredLocation, setPreferredLocation] = useState('')
  const [remoteEnabled, setRemoteEnabled] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showPetPanel, setShowPetPanel] = useState(false)
  const [insightsVisible, setInsightsVisible] = useState(false)

  const hasResults = jobs.length > 0
  const isLoadingInsights = isAnalyzing || (isFetchingJobs && !hasResults)

  const resumeSizeLabel = useMemo(() => {
    if (!resumeFile) return ''
    const sizeKb = resumeFile.size / 1024
    if (sizeKb > 1024) {
      return `${(sizeKb / 1024).toFixed(1)} MB`
    }
    return `${sizeKb.toFixed(0)} KB`
  }, [resumeFile])

  const totalPages = useMemo(() => (jobs.length ? Math.ceil(jobs.length / JOBS_PER_PAGE) : 1), [jobs.length])
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE
    return jobs.slice(startIndex, startIndex + JOBS_PER_PAGE)
  }, [currentPage, jobs])
  const pageNumbers = useMemo(() => Array.from({ length: totalPages }, (_, index) => index + 1), [totalPages])

  const goToPage = useCallback(
    (page: number) => {
      const nextPage = Math.min(Math.max(page, 1), totalPages)
      setCurrentPage(nextPage)
    },
    [totalPages],
  )

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setResumeFile(null)
      setResumeName('')
      return
    }
    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setError('Please choose a file under 5 MB in size.')
      event.target.value = ''
      return
    }
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, DOCX, or TXT resume file.')
      event.target.value = ''
      return
    }
    setError(null)
    setResumeFile(file)
    setResumeName(file.name)
    setAnalysis(null)
    setJobs([])
    setInfoMessage('')
    setCurrentPage(1)
    setInsightsVisible(false)
    setShowPetPanel(false)
    setIsFindingMoreJobs(false)
    setHasBroadenedSearch(false)
  }, [])

  const clearSession = useCallback(() => {
    setResumeFile(null)
    setResumeName('')
    setAnalysis(null)
    setJobs([])
    setError(null)
    setCustomPrompt('')
    setPreferredLocation('')
    setRemoteEnabled(false)
    setInfoMessage('')
    setCurrentPage(1)
    setInsightsVisible(false)
    setShowPetPanel(false)
    setIsFindingMoreJobs(false)
    setHasBroadenedSearch(false)
  }, [])

  const convertFileToBase64 = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('Could not read file as base64.'))
          return
        }
        const [, base64] = result.split(',')
        if (!base64) {
          reject(new Error('Invalid base64 payload extracted from file.'))
          return
        }
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Failed to read file. Please try again.'))
      reader.readAsDataURL(file)
    })
  }, [])
  const handleAnalyze = useCallback(async () => {
    if (!resumeFile) {
      setError('Upload a resume to start analysis.')
      return
    }

    setError(null)
    setInfoMessage('')
    setAnalysis(null)
    setJobs([])
    setCurrentPage(1)
    setInsightsVisible(true)
  setHasBroadenedSearch(false)
  setIsFindingMoreJobs(false)
    setIsAnalyzing(true)

    try {
      const base64Data = await convertFileToBase64(resumeFile)
      const directive = [
        customPrompt?.trim() ? customPrompt.trim() : null,
        preferredLocation?.trim() ? `Preferred location: ${preferredLocation.trim()}` : null,
        remoteEnabled ? 'Remote preference: Focus on remote-friendly or fully remote roles.' : null,
      ]
        .filter(Boolean)
        .join('\n')

      const response = await fetch(`${API_BASE_URL}/api/analyze-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: resumeFile.name,
          fileType: resumeFile.type,
          base64Data,
          customPrompt: directive,
        }),
      })

      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.message ?? 'Failed to analyze resume.')
      }

      const payload = (await response.json()) as {
        analysis?: AnalysisResult
        resumeTextSnippet?: string
      }

      if (!payload.analysis) {
        throw new Error('Received an incomplete analysis response from the server.')
      }

  setAnalysis(payload.analysis)

      if (!payload.analysis.jobQueries?.length) {
  setInfoMessage('Our AI could not derive search queries. Try adding more specifics to your prompt or resume.')
        return
      }

      setIsFetchingJobs(true)

      const jobsResponse = await fetch(`${API_BASE_URL}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: payload.analysis.jobQueries,
          location: preferredLocation || undefined,
          remote: remoteEnabled,
        }),
      })

      if (!jobsResponse.ok) {
        const problem = await jobsResponse.json().catch(() => ({}))
        throw new Error(problem.message ?? 'Unable to fetch job listings.')
      }

      const jobsPayload = (await jobsResponse.json()) as { jobs?: JobPosting[] }
      const receivedJobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : []

      setJobs(receivedJobs)
      setCurrentPage(1)
      if (receivedJobs.length === 0) {
        setInfoMessage('No job suggestions surfaced this round. Tweak your prompt or add more detail to your resume and try again.')
      } else if (receivedJobs.every((job) => job.source === 'LinkedIn search')) {
  setInfoMessage('Links open tailored LinkedIn searches so you can scan real-time postings that match the AI’s queries.')
      } else {
  setInfoMessage('The AI curated these roles with ready-to-open job board links. Re-run the analysis anytime for a fresh set.')
      }
    } catch (caughtError) {
      console.error(caughtError)
      let message = 'Unexpected error while analyzing resume. Please try again.'
      if (caughtError instanceof TypeError && caughtError.message === 'Failed to fetch') {
        message = `Cannot reach the JobFinder API. Start the server with \`npm run server\` (or \`npm run dev:full\`) and confirm it is available at ${API_BASE_URL}.`
      } else if (caughtError instanceof Error && caughtError.message) {
        message = caughtError.message
      }
      setError(message)
    } finally {
      setIsAnalyzing(false)
      setIsFetchingJobs(false)
    }
  }, [convertFileToBase64, customPrompt, preferredLocation, remoteEnabled, resumeFile])

  const handleFindMoreJobs = useCallback(async () => {
    if (!analysis || isFindingMoreJobs) {
      return
    }

    if (!analysis.jobQueries?.length) {
      setInfoMessage('Add more detail to your resume or priorities so the AI can widen its job search.')
      return
    }

    setIsFindingMoreJobs(true)
    setIsFetchingJobs(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: analysis.jobQueries,
          location: undefined,
          remote: remoteEnabled,
        }),
      })

      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.message ?? 'Unable to broaden the job search.')
      }

      const payload = (await response.json()) as { jobs?: JobPosting[] }
      const widenedJobs = Array.isArray(payload.jobs) ? payload.jobs : []

      setJobs((existing) => {
        if (widenedJobs.length === 0) {
          return existing
        }
        const deduped = [...existing]
        for (const job of widenedJobs) {
          if (!deduped.some((current) => current.id === job.id && current.url === job.url)) {
            deduped.push(job)
          }
        }
        return deduped
      })
      setCurrentPage(1)
      setHasBroadenedSearch(true)

      if (widenedJobs.length === 0) {
        setInfoMessage('We broadened the filters, but no additional roles surfaced. Try refining your resume or priorities and run it again.')
      } else {
        setInfoMessage('We broadened the search, so expect roles from additional locations, seniorities, and adjacent disciplines.')
      }
    } catch (caughtError) {
      console.error(caughtError)
      if (caughtError instanceof Error && caughtError.message) {
        setError(caughtError.message)
      } else {
        setError('Unexpected error while broadening the job search. Please try again.')
      }
    } finally {
      setIsFindingMoreJobs(false)
      setIsFetchingJobs(false)
    }
  }, [analysis, isFindingMoreJobs, remoteEnabled])

  const renderJobCard = (job: JobPosting) => {
    const showSourceBadge = job.source && !job.source.toLowerCase().includes('gemini')

    return (
      <a
        key={job.id}
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-slate-900">
              {job.title}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              {[job.company, job.location].filter(Boolean).join(' • ')}
            </p>
          </div>
          {showSourceBadge ? (
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              {job.source}
            </span>
          ) : null}
        </div>
        {job.description ? (
          <p className="line-clamp-3 text-sm text-slate-600">{job.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
          {job.salary ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{job.salary}</span> : null}
          {job.postedAt ? <span>Posted {job.postedAt}</span> : null}
        </div>
      </a>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
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
            onClick={clearSession}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset workspace
          </button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">

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
                  onChange={handleFileChange}
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
                    onChange={(event) => setPreferredLocation(event.target.value)}
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
                    onChange={(event) => setCustomPrompt(event.target.value)}
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
                  onClick={() => setRemoteEnabled((value) => !value)}
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
                  onClick={handleAnalyze}
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

          {insightsVisible ? (
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

              {isLoadingInsights ? (
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
                      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Curated jobs</h3>
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
                          {paginatedJobs.map(renderJobCard)}
                        </div>
                        {totalPages > 1 ? (
                          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                onClick={() => goToPage(currentPage + 1)}
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
                                  onClick={() => goToPage(page)}
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
                              onClick={handleFindMoreJobs}
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
                  Upload your resume and generate matches to unlock tailored strengths, search blueprints, and curated job pages.
                </div>
              )}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {showPetPanel ? (
          <aside className="pointer-events-auto w-72 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Meet Dey</p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">Your search co-pilot</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPetPanel(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-2xl bg-slate-50 p-3">1. Upload a resume—PDF, DOCX, or TXT up to 5 MB.</li>
              <li className="rounded-2xl bg-slate-50 p-3">2. Add the location and priorities you want Dey to scout.</li>
              <li className="rounded-2xl bg-slate-50 p-3">3. Press <span className="font-semibold text-slate-900">Find Jobs</span> to unlock insights, strengths, and curated jobs.</li>
            </ul>
          </aside>
        ) : null}

        <button
          type="button"
          onClick={() => setShowPetPanel((value) => !value)}
          className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-300"
          aria-label="Toggle Dey help panel"
        >
          <WandSparkles className="h-6 w-6" />
        </button>
      </div>

      <footer>
        <div className="mx-auto max-w-6xl px-4 py-4 text-left text-xs text-slate-500 sm:py-6 sm:text-center sm:text-sm">
          © 2025 DeyFind — Created by John Dayrill P. Flores
        </div>
      </footer>
    </div>
  )
}

export default App
