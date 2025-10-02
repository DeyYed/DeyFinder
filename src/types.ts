export type JobQuery = {
  title: string
  query: string
}

export type AnalysisResult = {
  summary: string
  keywords: string[]
  jobQueries: JobQuery[]
  strengths: string[]
  nextSteps: string[]
}

export type JobPosting = {
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
