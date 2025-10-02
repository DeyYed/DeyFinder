import { GoogleGenerativeAI } from '@google/generative-ai'

export type JobQuery = {
  title: string
  query: string
}

export type AnalysisResult = {
  summary: string
  keywords: string[]
  strengths: string[]
  nextSteps: string[]
  jobQueries: JobQuery[]
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

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const GEMINI_KEY =
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_GEMINI_API_KEY ??
  process.env.GOOGLE_API_KEY ??
  ''

const MAX_RESUME_LENGTH = 8000

let cachedModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

function getModel() {
  if (cachedModel) {
    return cachedModel
  }

  if (!GEMINI_KEY) {
    throw new Error('Gemini model is not configured. Provide a valid GEMINI_API_KEY.')
  }

  const client = new GoogleGenerativeAI(GEMINI_KEY)
  cachedModel = client.getGenerativeModel({ model: GEMINI_MODEL })
  return cachedModel
}

function truncateContent(content: string) {
  if (!content) return ''
  if (content.length <= MAX_RESUME_LENGTH) return content
  return `${content.slice(0, MAX_RESUME_LENGTH)}...`
}

async function extractResumeText(fileType: string, base64Data: string) {
  const buffer = Buffer.from(base64Data, 'base64')

  if (fileType === 'application/pdf') {
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = (pdfParseModule as unknown as { default: typeof import('pdf-parse') }).default ?? pdfParseModule
    const parsed = await (pdfParse as unknown as (buffer: Buffer) => Promise<{ text: string }>)(buffer)
    return parsed.text
  }

  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammothModule = await import('mammoth')
    const mammoth = mammothModule.default ?? mammothModule
    const parsed = await mammoth.extractRawText({ buffer })
    return parsed.value
  }

  if (fileType.startsWith('text/')) {
    return buffer.toString('utf-8')
  }

  throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.')
}

function safeJsonParse(text: string) {
  if (!text) {
    throw new Error('Empty response from Gemini.')
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Unable to locate JSON block in Gemini response.')
  }

  const possibleJson = text.slice(firstBrace, lastBrace + 1)
  return JSON.parse(possibleJson)
}

export async function runGeminiAnalysis({
  resumeText,
  customPrompt,
}: {
  resumeText: string
  customPrompt?: string
}): Promise<AnalysisResult> {
  const generativeModel = getModel()

  const condensedResume = truncateContent(resumeText)
  const guidance = customPrompt?.trim() ? customPrompt.trim() : 'None provided'

  const instruction = `You are an expert career coach and recruiter. Analyze the candidate resume below and respond strictly with minified JSON using this schema:
  {
    "summary": string,
    "keywords": string[6-10],
    "strengths": string[4-6],
    "nextSteps": string[3-5],
    "jobQueries": Array<{"title": string, "query": string}>
  }
  Requirements:
  - Summary <= 3 sentences, energetic and specific.
  - Keywords should be ATS-friendly hard skills and industry terms.
  - Strengths should highlight differentiators (achievements, domains, leadership, etc.).
  - Next steps must be short imperatives tailored to the candidate.
  - jobQueries should contain 3-4 targeted search queries blending seniority, domain, and skills.
  - Consider candidate priorities: ${guidance}
  - Output ONLY JSON. No markdown, no commentary.`

  const resumePrompt = `RESUME CONTENT START\n${condensedResume}\nRESUME CONTENT END`

  const result = await generativeModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${instruction}\n\n${resumePrompt}` }],
      },
    ],
  })

  const textResponse = result?.response?.text()
  if (!textResponse) {
    throw new Error('Gemini returned an empty response.')
  }

  const parsed = safeJsonParse(textResponse)

  return {
    summary: parsed.summary ?? '',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    jobQueries: Array.isArray(parsed.jobQueries) ? parsed.jobQueries : [],
  }
}

function synthesiseSearchUrl(query: JobQuery, location?: string, remote?: boolean) {
  const keywords = [query.query, remote ? 'remote' : null, location?.trim()].filter(Boolean).join(' ')
  const params = new URLSearchParams({ keywords })
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

function buildFallbackJobs(queries: JobQuery[], location?: string, remote?: boolean): JobPosting[] {
  const locationLabel = remote ? 'Remote' : location || 'Flexible location'
  return queries.map((query, index) => ({
    id: `fallback-${index}-${Date.now()}`,
    title: query.title,
    company: 'Explore curated opportunities',
    location: locationLabel,
    salary: undefined,
    description: `Review live listings that match “${query.query}”. Use the link to launch a targeted ${remote ? 'remote' : 'location-aligned'} search.`,
    url: synthesiseSearchUrl(query, location, remote),
    source: 'LinkedIn search',
    postedAt: undefined,
  }))
}

export async function generateJobsWithGemini({
  queries,
  location,
  remote,
}: {
  queries: JobQuery[]
  location?: string
  remote?: boolean
}): Promise<JobPosting[]> {
  const generativeModel = getModel()

  const directives = queries
    .map((query, index) => `${index + 1}. Title: ${query.title}\n   Search: ${query.query}`)
    .join('\n')

  const locationLine = location?.trim() ? location.trim() : 'No explicit preference'
  const remoteLine = remote ? 'Remote or remote-first roles only' : 'No remote requirement specified'

  const instruction = `You are an expert technical recruiter. Based on the search directives below, recommend up to ${Math.min(
    queries.length * 2,
    9,
  )} appealing job opportunities. Reply strictly in minified JSON with the schema:
{"jobs": [{"title": string, "company": string, "location": string, "salary": string?, "description": string, "link": string, "source": string?}]}.
Hard requirements:
- Every link must be an https URL to a reputable job board search or company careers page aligned with the role (LinkedIn, Indeed, Wellfound, Greenhouse, Lever, Ashby, etc.).
- If you do not know an exact posting, construct a pre-filled job search URL that includes the relevant keywords and location.
- Descriptions should be concise (<= 55 words), benefit-led, and specific to the role.
- Do not emit markdown, explanations, or additional keys.`

  const prompt = `${instruction}\n\nSearch directives:\n${directives}\n\nPreferred location: ${locationLine}\nRemote preference: ${remoteLine}`

  try {
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    })

    const textResponse = result?.response?.text()
    const parsed = safeJsonParse(textResponse)
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : []

    if (!jobs.length) {
      return buildFallbackJobs(queries, location, remote)
    }

    return jobs
      .map((job: Record<string, unknown>, index: number) => {
        const fallbackQuery = queries[index % queries.length]
        const rawLink = typeof job.link === 'string' ? job.link : null
        const link = rawLink && rawLink.startsWith('https://') ? rawLink : synthesiseSearchUrl(fallbackQuery, location, remote)
        const derivedLocation = typeof job.location === 'string' && job.location.trim()
          ? job.location
          : remote
            ? 'Remote'
            : location ?? undefined

        return {
          id: typeof job.id === 'string' && job.id ? job.id : `gemini-${Date.now()}-${index}`,
          title: typeof job.title === 'string' && job.title ? job.title : fallbackQuery.title,
          company: typeof job.company === 'string' && job.company ? job.company : 'AI recommendation',
          location: derivedLocation,
          salary: typeof job.salary === 'string' ? job.salary : undefined,
          description:
            typeof job.description === 'string' && job.description
              ? job.description
              : `Review opportunities that align with ${fallbackQuery.title}.`,
          url: link,
          source: typeof job.source === 'string' && job.source
            ? job.source.replace(/gemini/gi, 'AI curated')
            : 'AI curated',
          postedAt: undefined,
        }
      })
      .filter((job: JobPosting) => Boolean(job.url))
  } catch (error) {
    console.error('Gemini job synthesis failed:', error)
    return buildFallbackJobs(queries, location, remote)
  }
}

export { extractResumeText, truncateContent }
