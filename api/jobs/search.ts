import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateJobsWithGemini, type JobQuery } from '../lib/jobFinder'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method Not Allowed' })
      return
    }

    const { queries, location, remote } = req.body ?? {}
    if (!Array.isArray(queries) || queries.length === 0) {
      res.status(400).json({ message: 'Provide at least one job query.' })
      return
    }

    const parsedQueries = queries.filter((query: JobQuery) => query?.title && query?.query)
    if (parsedQueries.length === 0) {
      res.status(400).json({ message: 'Provide at least one job query.' })
      return
    }

    const jobs = await generateJobsWithGemini({
      queries: parsedQueries,
      location,
      remote: Boolean(remote),
    })

    res.status(200).json({ jobs })
  } catch (error) {
    console.error('Job search failed:', error)
    res.status(500).json({ message: 'Failed to fetch job listings.' })
  }
}
