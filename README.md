# JobFinder – AI-powered job discovery

JobFinder pairs a sleek, responsive React experience with a lightweight Express API to turn any resume into a personalized shortlist of live roles. Upload a PDF, DOCX, or TXT resume and Gemini Flash 2.5 distills your strengths, keywords, and recommended search strategies. The backend then scouts the web (via RapidAPI’s JSearch) for matching openings and pipes them straight back into the interface with deep links.

## ✨ Features

- **Gemini-powered resume intelligence** – Gemini Flash 2.5 summarizes positioning, standout strengths, high-impact keywords, and next-step coaching.
- **Automated job scouting** – Generates targeted search queries and delivers ready-to-open job board links with tailored summaries.
- **Responsive, professional UI** – Modern glassmorphism layout, built-in privacy messaging, and live status indicators across desktop and mobile.
- **Personalization controls** – Optional location and prioritization prompts refine both the AI analysis and job searches.
- **Safe fallbacks** – If external APIs are missing, the app gracefully falls back to curated sample roles so the workflow remains demoable.

## 🧱 Tech stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS 4
- **Backend:** Express 4 with Google Generative AI SDK powering both resume insights and job discovery
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
| `API_PORT` | Port for the Express API (defaults to `5174`). |
| `CLIENT_ORIGIN` | Allowed origins for CORS, comma-separated. For local dev keep `http://localhost:5173`. |
| `GEMINI_API_KEY` | Required. Create a Gemini API key in Google AI Studio and enable the **Gemini Flash 2.5** model. |
| `GEMINI_MODEL` | Model identifier (defaults to `gemini-2.0-flash`). |
| – | – |

You can point the frontend at a remote API by setting `VITE_API_URL` (e.g. `https://yourdomain.com`). Otherwise it targets the local Express server. If the UI shows “Cannot reach the JobFinder API…”, ensure `npm run server` (or `npm run dev:full`) is running and that the port matches `VITE_API_URL`.

### 4. Run the stack

Launch both the API and Vite dev server together:

```powershell
npm run dev:full
```

Or start them independently:

```powershell
npm run server
# in a second terminal
npm run dev
```

The frontend runs on `http://localhost:5173`, while the API listens on `http://localhost:5174` by default.

### 5. Build for production

```powershell
npm run build
```

Deploy the contents of `dist/` behind any static host and run the Express server (e.g. with a process manager such as PM2 or a serverless adapter).

## 🔌 API surface

| Endpoint | Method | Body | Description |
| --- | --- | --- | --- |
| `/api/health` | GET | – | Health check returning model readiness. |
| `/api/analyze-resume` | POST | `{ fileName, fileType, base64Data, customPrompt }` | Parses the resume, calls Gemini Flash 2.5, and returns structured insights. |
| `/api/jobs/search` | POST | `{ queries: JobQuery[], location? }` | Asks Gemini to craft role suggestions and job-board search links. Falls back to deterministic LinkedIn searches if Gemini is unavailable. |

`JobQuery` objects look like:

```ts
{
  title: string
  query: string
}
```

## 📝 Notes & tips

- Keep resume files under **5 MB**. Larger files are rejected client-side.
- Only PDF, DOCX, and TXT files are supported today. Extend `extractResumeText` in `server/index.js` to add more formats.
- When shipping to production, host the frontend and backend under the same domain or update `VITE_API_URL` + `CLIENT_ORIGIN` accordingly.
- Gemini requests are bounded to the first ~8 K characters of the resume to stay within context limits while remaining performant.

## ✅ Roadmap ideas

- Persist user sessions with secure storage.
- Add pagination or filters (salary range, remote-only toggle) to the job list.
- Instrument analytics to track conversion from AI suggestions to outbound clicks.
