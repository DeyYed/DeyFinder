import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 5174)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const GEMINI_KEY =
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_GEMINI_API_KEY ??
  process.env.GOOGLE_API_KEY ??
  ''

const app = express()

// Middleware
app.use(
  cors({
    origin: CLIENT_ORIGIN.split(',').map((entry) => entry.trim()),
  }),
)
app.use(express.json({ limit: '12mb' }))

let generativeModel = null
if (GEMINI_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY)
    generativeModel = genAI.getGenerativeModel({ model: GEMINI_MODEL })
  } catch (error) {
    console.error('Failed to initialize Gemini model:', error)
  }
} else {
  console.warn('⚠️  Missing Gemini API key. Set GEMINI_API_KEY in your environment.')
}

const MAX_RESUME_LENGTH = 8000

function truncateContent(content) {
  if (!content) return ''
  if (content.length <= MAX_RESUME_LENGTH) return content
  return `${content.slice(0, MAX_RESUME_LENGTH)}...`
}

async function extractResumeText(fileType, buffer) {
  if (fileType === 'application/pdf') {
    const parsed = await pdfParse(buffer)
    return parsed.text
  }
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const parsed = await mammoth.extractRawText({ buffer })
    return parsed.value
  }
  if (fileType.startsWith('text/')) {
    return buffer.toString('utf-8')
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.')
}

function safeJsonParse(text) {
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

async function runGeminiAnalysis({ resumeText, customPrompt }) {
  if (!generativeModel) {
    throw new Error('Gemini model is not configured. Provide a valid GEMINI_API_KEY.')
  }

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

function synthesiseSearchUrl(query, location, remote) {
  const keywords = [query.query, remote ? 'remote' : null, location?.trim()].filter(Boolean).join(' ')
  const params = new URLSearchParams({ keywords })
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

function buildFallbackJobs(queries, location, remote) {
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

async function generateJobsWithGemini({ queries, location, remote }) {
  if (!generativeModel) {
    return buildFallbackJobs(queries, location, remote)
  }

  const directives = queries
    .map((query, index) => `${index + 1}. Title: ${query.title}\n   Search: ${query.query}`)
    .join('\n')

  const locationLine = location?.trim() ? location.trim() : 'No explicit preference'
  const remoteLine = remote ? 'Remote or remote-first roles only' : 'No remote requirement specified'

  const instruction = `You are an expert technical recruiter. Based on the search directives below, recommend up to ${Math.min(queries.length * 2, 9)} appealing job opportunities. Reply strictly in minified JSON with the schema:
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
      .map((job, index) => {
        const fallbackQuery = queries[index % queries.length]
        const link = typeof job.link === 'string' && job.link.startsWith('https://')
          ? job.link
          : synthesiseSearchUrl(fallbackQuery, location, remote)

        const derivedLocation = job.location ?? (remote ? 'Remote' : location ?? undefined)

        return {
          id: job.id ?? `gemini-${Date.now()}-${index}`,
          title: job.title ?? fallbackQuery.title,
          company: job.company ?? 'AI recommendation',
          location: derivedLocation,
          salary: job.salary ?? undefined,
          description:
            job.description ?? `Review opportunities that align with ${fallbackQuery.title}.`,
          url: link,
          source: job.source ?? 'AI curated',
          postedAt: undefined,
        }
      })
      .filter((job) => Boolean(job.url))
  } catch (error) {
    console.error('Gemini job synthesis failed:', error)
    return buildFallbackJobs(queries, location, remote)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', modelReady: Boolean(generativeModel) })
})

app.post('/api/analyze-resume', async (req, res) => {
  try {
    const { fileName, fileType, base64Data, customPrompt } = req.body ?? {}
    if (!fileName || !fileType || !base64Data) {
      return res.status(400).json({ message: 'Missing resume payload.' })
    }

    const buffer = Buffer.from(base64Data, 'base64')
    const resumeText = await extractResumeText(fileType, buffer)

    if (!resumeText?.trim()) {
      return res.status(400).json({ message: 'Unable to read text from the provided resume.' })
    }

    const analysis = await runGeminiAnalysis({ resumeText, customPrompt })

    res.json({
      resumeTextSnippet: truncateContent(resumeText).slice(0, 1000),
      analysis,
    })
  } catch (error) {
    console.error('Resume analysis failed:', error)
    res.status(500).json({ message: 'Failed to analyze resume.', details: error.message })
  }
})

app.post('/api/jobs/search', async (req, res) => {
  try {
    const { queries, location, remote } = req.body ?? {}
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ message: 'Provide at least one job query.' })
    }

    const jobs = await generateJobsWithGemini({ queries, location, remote: Boolean(remote) })

    res.json({ jobs })
  } catch (error) {
    console.error('Job search failed:', error)
    res.status(500).json({ message: 'Failed to fetch job listings.', details: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`JobFinder API listening on port ${PORT}`)
})
