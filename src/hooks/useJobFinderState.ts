import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { type AnalysisResult, type JobPosting } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const JOBS_PER_PAGE = 6

export function useJobFinderState() {
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
      } else if (
        receivedJobs.every((job) => job.source && job.source.toLowerCase().includes('search'))
      ) {
        setInfoMessage('Links open tailored searches across top job boards like LinkedIn, JobStreet, Glassdoor, Prosple, and more so you can review live postings from each employer.')
      } else {
        setInfoMessage('The AI found these roles with ready-to-open job board links. Re-run the analysis anytime for a fresh set.')
      }
    } catch (caughtError) {
      console.error(caughtError)
      let message = 'Unexpected error while analyzing resume. Please try again.'
      if (caughtError instanceof TypeError && caughtError.message === 'Failed to fetch') {
        message = 'Cannot reach the JobFinder API. Confirm your deployment or `vercel dev` session is running and VITE_API_BASE_URL is configured if needed.'
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

  const handleRemoteToggle = useCallback(() => {
    setRemoteEnabled((value) => !value)
  }, [])

  const handleTogglePetPanel = useCallback(() => {
    setShowPetPanel((value) => !value)
  }, [])

  const handleClosePetPanel = useCallback(() => {
    setShowPetPanel(false)
  }, [])

  const handlePreferredLocationChange = useCallback((value: string) => {
    setPreferredLocation(value)
  }, [])

  const handleCustomPromptChange = useCallback((value: string) => {
    setCustomPrompt(value)
  }, [])

  return {
    // state
    resumeFile,
    resumeName,
    analysis,
    jobs,
    isAnalyzing,
    isFetchingJobs,
    isFindingMoreJobs,
    hasBroadenedSearch,
    error,
    preferredLocation,
    remoteEnabled,
    customPrompt,
    infoMessage,
    currentPage,
    showPetPanel,
    insightsVisible,
    // derived values
    resumeSizeLabel,
    paginatedJobs,
    pageNumbers,
    totalPages,
    isLoadingInsights,
    // actions
    handleFileChange,
    handleAnalyze,
    handleFindMoreJobs,
    handleRemoteToggle,
    handleTogglePetPanel,
    handleClosePetPanel,
    handlePreferredLocationChange,
    handleCustomPromptChange,
    goToPage,
    clearSession,
  }
}
