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

type SearchProvider = {
  name: string
  hosts: string[]
  buildUrl: (options: {
    query: JobQuery
    company?: string
    location?: string
    remote?: boolean
  }) => string
}

const SEARCH_PROVIDERS: SearchProvider[] = [
  {
    name: 'LinkedIn search',
    hosts: ['linkedin.com'],
    buildUrl: ({ query, company, location, remote }) => {
      const keywords = [company ? `${company} ${query.title}` : query.query, remote ? 'remote' : null]
        .filter(Boolean)
        .join(' ')
      const params = new URLSearchParams()
      if (keywords) params.set('keywords', keywords)
      if (!remote && location?.trim()) params.set('location', location.trim())
      return `https://www.linkedin.com/jobs/search/?${params.toString()}`
    },
  },
  {
    name: 'JobStreet search',
    hosts: ['jobstreet.com'],
    buildUrl: ({ query, company, location, remote }) => {
      const keywords = [company ? `${company} ${query.title}` : query.query, remote ? 'work from home' : null]
        .filter(Boolean)
        .join(' ')
      const params = new URLSearchParams()
      if (keywords) params.set('keywords', keywords)
      params.set('page', '1')
      if (!remote && location?.trim()) params.set('locations', location.trim())
      return `https://www.jobstreet.com/search/jobs?${params.toString()}`
    },
  },
  {
    name: 'Glassdoor search',
    hosts: ['glassdoor.com'],
    buildUrl: ({ query, company, location, remote }) => {
      const keyword = [company ? `${company} ${query.title}` : query.query, remote ? 'remote' : null]
        .filter(Boolean)
        .join(' ')
      const params = new URLSearchParams()
      if (keyword) params.set('sc.keyword', keyword)
      if (!remote && location?.trim()) {
        params.set('locT', 'C')
        params.set('locName', location.trim())
      } else {
        params.set('locT', 'N')
        params.set('locId', '1')
      }
      params.set('p', '1')
      return `https://www.glassdoor.com/Job/jobs.htm?${params.toString()}`
    },
  },
  {
    name: 'Prosple search',
    hosts: ['prosple.com'],
    buildUrl: ({ query, company, location, remote }) => {
      const keywords = [company ? `${company} ${query.title}` : query.query].filter(Boolean).join(' ')
      const params = new URLSearchParams()
      if (keywords) params.set('keywords', keywords)
      if (remote) {
        params.set('location', 'Remote')
      } else if (location?.trim()) {
        params.set('location', location.trim())
      }
      return `https://prosple.com/search-jobs?${params.toString()}`
    },
  },
  {
    name: 'Indeed search',
    hosts: ['indeed.com'],
    buildUrl: ({ query, company, location, remote }) => {
      const keywords = [company ? `${company} ${query.title}` : query.query, remote ? 'remote' : null]
        .filter(Boolean)
        .join(' ')
      const params = new URLSearchParams()
      if (keywords) params.set('q', keywords)
      if (!remote && location?.trim()) params.set('l', location.trim())
      return `https://www.indeed.com/jobs?${params.toString()}`
    },
  },
]

const AGGREGATOR_HOSTS = new Set(SEARCH_PROVIDERS.flatMap((provider) => provider.hosts))

function findProviderForHost(hostname: string) {
  const lowerHost = hostname.toLowerCase()
  return SEARCH_PROVIDERS.find((provider) => provider.hosts.some((host) => lowerHost.includes(host)))
}

function selectSearchProvider(indexSeed: number) {
  if (!SEARCH_PROVIDERS.length) {
    throw new Error('No search providers configured.')
  }
  const index = Math.abs(indexSeed) % SEARCH_PROVIDERS.length
  return SEARCH_PROVIDERS[index]
}

function buildSearchLink({
  query,
  company,
  location,
  remote,
  seed,
}: {
  query: JobQuery
  company?: string
  location?: string
  remote?: boolean
  seed: number
}) {
  const provider = selectSearchProvider(seed)
  const url = provider.buildUrl({ query, company, location, remote })
  return {
    url,
    source: provider.name,
  }
}

function toTitleCase(slug: string) {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function isGenericCompanyName(name: string) {
  const normalised = name.trim().toLowerCase()
  if (!normalised) return true
  if (normalised.length <= 2) return true

  const phrases = [
    'various companies',
    'various employers',
    'multiple companies',
    'multiple employers',
    'several companies',
    'several employers',
    'numerous companies',
    'numerous employers',
    'diverse companies',
    'diverse employers',
    'leading company',
    'leading employer',
    'top company',
    'top employer',
    'major company',
    'major employer',
    'global company',
    'global employer',
    'confidential company',
    'confidential employer',
    'stealth company',
    'stealth employer',
  ]
  if (phrases.some((phrase) => normalised.includes(phrase))) return true

  if (/\b(n\/a|na|tbd|tba|unknown|unspecified|not provided|not specified)\b/.test(normalised)) {
    return true
  }

  if (/^(company|employer|organisation|organization)$/i.test(normalised)) {
    return true
  }

  return false
}

function deriveCompanyFromLink(link: string) {
  try {
    const url = new URL(link)
    const host = url.hostname.toLowerCase()
    const pathSegments = url.pathname.split('/').filter(Boolean)

    if (host.includes('greenhouse.io')) {
      return pathSegments[0] ? toTitleCase(pathSegments[0]) : undefined
    }

    if (host.includes('lever.co')) {
      return pathSegments[0] ? toTitleCase(pathSegments[0]) : undefined
    }

    if (host.includes('ashbyhq.com')) {
      return pathSegments[0] ? toTitleCase(pathSegments[0]) : undefined
    }

    if (host.includes('workable.com')) {
      const subdomain = host.split('.')[0]
      if (subdomain && subdomain !== 'www' && subdomain !== 'jobs') {
        return toTitleCase(subdomain)
      }
    }

    if (host.includes('smartrecruiters.com')) {
      return pathSegments[0] ? toTitleCase(pathSegments[0]) : undefined
    }

    if (host.includes('jobvite.com')) {
      return pathSegments[0] ? toTitleCase(pathSegments[0]) : undefined
    }

    if (host.includes('wellfound.com')) {
      const companyIndex = pathSegments.findIndex((segment) => segment === 'company')
      if (companyIndex !== -1 && pathSegments[companyIndex + 1]) {
        return toTitleCase(pathSegments[companyIndex + 1])
      }
    }

    if (host.includes('myworkdayjobs.com')) {
      if (pathSegments[0]) {
        return toTitleCase(pathSegments[0])
      }
    }

    if (Array.from(AGGREGATOR_HOSTS).some((aggregatorHost) => host.includes(aggregatorHost)) || host.includes('ziprecruiter.com')) {
      // These aggregators rarely expose the company in a stable segment.
      return undefined
    }

    const trimmedHost = host.replace(/^www\./, '')
    const hostParts = trimmedHost.split('.')
    const domainRoot = hostParts.length > 2 ? hostParts[hostParts.length - 2] : hostParts[0]
    const blockedRoots = new Set([
      'greenhouse',
      'lever',
      'ashbyhq',
      'wellfound',
      'linkedin',
      'indeed',
      'ziprecruiter',
      'glassdoor',
      'workable',
      'smartrecruiters',
      'jobvite',
      'myworkdayjobs',
      'jobs',
    ])

    if (blockedRoots.has(domainRoot)) {
      return undefined
    }

    return domainRoot ? toTitleCase(domainRoot) : undefined
  } catch {
    return undefined
  }
}

type CompanyBucket = {
  keywords: string[]
  companies: string[]
}

const COMPANY_BUCKETS: CompanyBucket[] = [
  {
    keywords: ['data', 'analytics', 'machine learning', 'ml', 'ai', 'scientist'],
    companies: ['Snowflake', 'Databricks', 'Palantir', 'Anthropic', 'Airbnb'],
  },
  {
    keywords: ['frontend', 'javascript', 'typescript', 'react', 'ui', 'web'],
    companies: ['Vercel', 'Netlify', 'Canva', 'Shopify', 'Pinterest'],
  },
  {
    keywords: ['backend', 'api', 'server', 'distributed', 'platform'],
    companies: ['Cloudflare', 'HashiCorp', 'Twilio', 'DigitalOcean', 'MongoDB'],
  },
  {
    keywords: ['devops', 'infrastructure', 'sre', 'platform engineering', 'observability'],
    companies: ['Datadog', 'PagerDuty', 'GitHub', 'GitLab', 'New Relic'],
  },
  {
    keywords: ['mobile', 'android', 'ios', 'swift', 'kotlin'],
    companies: ['Spotify', 'Duolingo', 'Lyft', 'Uber', 'Headspace'],
  },
  {
    keywords: ['security', 'infosec', 'appsec', 'threat', 'soc', 'zero trust'],
    companies: ['Okta', 'CrowdStrike', 'Snyk', 'Cloudflare', '1Password'],
  },
  {
    keywords: ['product manager', 'product management', 'pm'],
    companies: ['Atlassian', 'Notion', 'Asana', 'Monday.com', 'Linear'],
  },
  {
    keywords: ['designer', 'design', 'ux', 'ui', 'product design'],
    companies: ['Figma', 'Adobe', 'Canva', 'IDEO', 'InVision'],
  },
  {
    keywords: ['marketing', 'growth', 'content', 'brand', 'demand'],
    companies: ['HubSpot', 'Klaviyo', 'Mailchimp', 'Sprout Social', 'Canva'],
  },
  {
    keywords: ['sales', 'account executive', 'account manager', 'business development'],
    companies: ['Salesforce', 'Gong', 'Outreach', 'HubSpot', 'Zendesk'],
  },
  {
    keywords: ['finance', 'fintech', 'bank', 'financial'],
    companies: ['Stripe', 'Plaid', 'Square', 'Chime', 'Robinhood'],
  },
  {
    keywords: ['health', 'healthcare', 'medtech', 'clinical', 'pharma'],
    companies: ['Teladoc', 'Walgreens Health', 'Johnson & Johnson', 'Moderna', 'One Medical'],
  },
  {
    keywords: ['education', 'edtech', 'teacher', 'learning'],
    companies: ['Duolingo', 'Coursera', 'Khan Academy', 'Udemy', 'Outschool'],
  },
  {
    keywords: ['gaming', 'game', 'unity', 'unreal'],
    companies: ['Riot Games', 'Epic Games', 'Blizzard Entertainment', 'Ubisoft', 'Supercell'],
  },
]

const DEFAULT_COMPANIES = [
  'Stripe',
  'Canva',
  'Atlassian',
  'HubSpot',
  'GitLab',
  'Notion',
  'Figma',
  'Twilio',
  'Airbnb',
  'Spotify',
]

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return hash
}

function pickSampleCompany(query: JobQuery, index: number) {
  const haystack = `${query.title} ${query.query}`.toLowerCase()

  for (const bucket of COMPANY_BUCKETS) {
    if (bucket.keywords.some((keyword) => haystack.includes(keyword))) {
      const offset = Math.abs(hashString(haystack))
      const position = (offset + index) % bucket.companies.length
      return bucket.companies[position]
    }
  }

  const fallbackPosition = (Math.abs(hashString(haystack)) + index) % DEFAULT_COMPANIES.length
  return DEFAULT_COMPANIES[fallbackPosition]
}

function normaliseCompanyName(rawCompany: string | null, link: string, query: JobQuery, index: number) {
  const trimmed = rawCompany?.trim()
  if (trimmed && !isGenericCompanyName(trimmed)) {
    return trimmed
  }

  const derived = deriveCompanyFromLink(link)
  if (derived) {
    return derived
  }

  return pickSampleCompany(query, index)
}

function ensureCompanyLink({
  rawLink,
  company,
  fallbackQuery,
  location,
  remote,
  index,
  modelSource,
}: {
  rawLink: string | null
  company: string
  fallbackQuery: JobQuery
  location?: string
  remote?: boolean
  index: number
  modelSource?: string
}) {
  const seed = hashString(`${fallbackQuery.title}:${fallbackQuery.query}:${index}`)
  const fallbackLink = buildSearchLink({
    query: fallbackQuery,
    company,
    location,
    remote,
    seed,
  })

  if (!rawLink || !rawLink.startsWith('https://')) {
    return fallbackLink
  }

  try {
    const parsed = new URL(rawLink)
    const provider = findProviderForHost(parsed.hostname)
    if (!company) {
      return {
        url: rawLink,
        source: modelSource ?? provider?.name ?? fallbackLink.source,
      }
    }

    const companySlug = slugify(company)
    const linkIncludesCompany = companySlug ? rawLink.toLowerCase().includes(companySlug) : false

    if (provider) {
      if (linkIncludesCompany) {
        return {
          url: rawLink,
          source: modelSource ?? provider.name,
        }
      }

      return {
        url: provider.buildUrl({ query: fallbackQuery, company, location, remote }),
        source: provider.name,
      }
    }

    if (linkIncludesCompany) {
      return {
        url: rawLink,
        source: modelSource ?? 'AI curated',
      }
    }

    return {
      url: rawLink,
      source: modelSource ?? fallbackLink.source,
    }
  } catch {
    return fallbackLink
  }
}

function buildFallbackJobs(queries: JobQuery[], location?: string, remote?: boolean): JobPosting[] {
  const locationLabel = remote ? 'Remote' : location || 'Flexible location'
  const resultsPerQuery = Math.max(SEARCH_PROVIDERS.length, 5)
  const now = Date.now()

  return queries.flatMap((query, queryIndex) => {
    return Array.from({ length: resultsPerQuery }).map((_, offset) => {
  const company = pickSampleCompany(query, queryIndex + offset)
  const seed = hashString(`${query.title}:${query.query}:${queryIndex}:${offset}`)
  const provider = SEARCH_PROVIDERS[Math.abs(seed) % SEARCH_PROVIDERS.length]
      const url = provider.buildUrl({ query, company, location, remote })
      return {
        id: `fallback-${queryIndex}-${offset}-${now}`,
        title: `${query.title} at ${company}`,
        company,
        location: locationLabel,
        salary: undefined,
        description: `Browse ${company} and peer organisations hiring for ${query.title}. This search stays focused on ${remote ? 'remote-first' : locationLabel} roles.`,
        url,
        source: provider.name,
        postedAt: undefined,
      }
    })
  })
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

  const instruction = `You are an expert technical recruiter. Based on the search directives below, recommend at least ${Math.min(
    Math.max(queries.length * 3, 12),
    20,
  )} appealing job opportunities (include more if relevant). Reply strictly in minified JSON with the schema:
{"jobs": [{"title": string, "company": string, "location": string, "salary": string?, "description": string, "link": string, "source": string?}]}.
Hard requirements:
- Every link must be an https URL to a reputable job board search or company careers page aligned with the role (LinkedIn, Indeed, Wellfound, Greenhouse, Lever, Ashby, JobStreet, Glassdoor, Prosple, etc.).
- If you do not know an exact posting, construct a pre-filled job search URL that includes the relevant keywords and location.
- \`company\` must be the name of a specific employer (e.g. "Canva", "HubSpot"). Generic phrases like "Various companies", "Multiple employers", or "N/A" are strictly forbidden.
- Descriptions should be concise (<= 55 words), benefit-led, and specific to the role.
- Avoid duplicates—each job should reference a distinct combination of company + link unless it's a different office/region.
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
        const derivedLocation = typeof job.location === 'string' && job.location.trim()
          ? job.location
          : remote
            ? 'Remote'
            : location ?? undefined
        const company = normaliseCompanyName(
          typeof job.company === 'string' ? job.company : null,
          rawLink ?? '',
          fallbackQuery,
          index,
        )
        const { url, source } = ensureCompanyLink({
          rawLink,
          company,
          fallbackQuery,
          location,
          remote,
          index,
          modelSource: typeof job.source === 'string' ? job.source : undefined,
        })

        const displaySource = source ? source.replace(/gemini/gi, 'AI curated') : 'AI curated'

        return {
          id: typeof job.id === 'string' && job.id ? job.id : `gemini-${Date.now()}-${index}`,
          title: typeof job.title === 'string' && job.title ? job.title : fallbackQuery.title,
          company,
          location: derivedLocation,
          salary: typeof job.salary === 'string' ? job.salary : undefined,
          description:
            typeof job.description === 'string' && job.description
              ? job.description
              : `Review opportunities that align with ${fallbackQuery.title}.`,
          url,
          source: displaySource,
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
