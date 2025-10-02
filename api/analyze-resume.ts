import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractResumeText, runGeminiAnalysis, truncateContent } from './lib/jobFinder.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method Not Allowed' })
      return
    }

    const { fileName, fileType, base64Data, customPrompt } = req.body ?? {}
    if (!fileName || !fileType || !base64Data) {
      res.status(400).json({ message: 'Missing resume payload.' })
      return
    }

    const resumeText = await extractResumeText(fileType, base64Data)
    if (!resumeText?.trim()) {
      res.status(400).json({ message: 'Unable to read text from the provided resume.' })
      return
    }

    const analysis = await runGeminiAnalysis({ resumeText, customPrompt })

    res.status(200).json({
      resumeTextSnippet: truncateContent(resumeText).slice(0, 1000),
      analysis,
    })
  } catch (error) {
    console.error('Resume analysis failed:', error)
    res.status(500).json({ message: 'Failed to analyze resume.' })
  }
}
