# JobFinder – AI-powered job discovery

JobFinder pairs a sleek, responsive React experience with Vercel serverless functions to turn any resume into a personalized shortlist of live roles. Upload a PDF, DOCX, or TXT resume and Gemini Flash 2 distills your strengths, keywords, and recommended search strategies. The backend then synthesises curated job-board searches and hands them straight back to the interface with deep links.

## ✨ Features

- **Gemini-powered resume intelligence** – Gemini Flash 2.5 summarizes positioning, standout strengths, high-impact keywords, and next-step coaching.
- **Automated job scouting** – Generates targeted search queries and delivers ready-to-open job board links with tailored summaries.
- **Responsive, professional UI** – Modern glassmorphism layout, built-in privacy messaging, and live status indicators across desktop and mobile.
- **Personalization controls** – Optional location and prioritization prompts refine both the AI analysis and job searches.
- **Safe fallbacks** – If external APIs are missing, the app gracefully falls back to curated sample roles so the workflow remains demoable.

## 🧱 Tech stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS 4
- **Backend:** Vercel serverless Node handlers powered by the Google Generative AI SDK
- **Parsing:** `pdf-parse` for PDFs, `mammoth` for DOCX, native decoders for TXT

## 🚀 Getting started

### 1. Prerequisites

- Node.js 18.17+ (Node 20 LTS recommended for best compatibility)
- npm 9+

### 2. Install dependencies

```powershell
npm install
```

### 3. Configure environment variables

Copy the example file and update it with your secrets:

```powershell
Copy-Item .env.example .env
```

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | **Required.** Create a Gemini API key in Google AI Studio and enable the Flash / Flash-Lite models. |
| `GEMINI_MODEL` | Optional. Overrides the default `gemini-2.0-flash`. |
| `VITE_API_BASE_URL` | Optional. Base URL for the serverless API (e.g. `http://localhost:3000` when running `vercel dev`). Leave unset for same-origin calls in production. |

### 4. Run the stack

1. Start the Vite dev server:

  ```powershell
  npm run dev
  ```

2. In another terminal, launch the Vercel serverless runtime (requires the Vercel CLI — `npm install -g vercel`):

  ```powershell
  vercel dev
  ```

  By default this serves API routes from `http://localhost:3000`. Set `VITE_API_BASE_URL=http://localhost:3000` in your `.env` so the frontend forwards requests correctly. For production deployments the API runs alongside the static build, so the variable can be omitted.

### 5. Build for production

```powershell
npm run build
```

Deploy via Vercel (recommended) so the static build and serverless functions ship together. Pushing to a connected Git repository or running `vercel` from the CLI will provision both automatically.

## 🔌 API surface

| Endpoint | Method | Body | Description |
| --- | --- | --- | --- |
| `/api/analyze-resume` | POST | `{ fileName, fileType, base64Data, customPrompt }` | Parses the resume, calls Gemini Flash 2, and returns structured insights plus suggested search queries. |
| `/api/jobs/search` | POST | `{ queries: JobQuery[], location?, remote? }` | Asks Gemini to craft role suggestions and job-board search links. Falls back to deterministic LinkedIn searches if Gemini is unavailable. |

`JobQuery` objects look like:

```ts
{
  title: string
  query: string
}
```

## 📝 Notes & tips

- Keep resume files under **5 MB**. Larger files are rejected client-side.
- Only PDF, DOCX, and TXT files are supported today. Extend `extractResumeText` in `api/lib/jobFinder.ts` to add more formats.
- For local development, export `VITE_API_BASE_URL` so the frontend knows where to reach your serverless functions. In production, deploy both together on Vercel for same-origin requests.
- Gemini requests are bounded to the first ~8 K characters of the resume to stay within context limits while remaining performant.

## ✅ Roadmap ideas

- Persist user sessions with secure storage.
- Add pagination or filters (salary range, remote-only toggle) to the job list.
- Instrument analytics to track conversion from AI suggestions to outbound clicks.
