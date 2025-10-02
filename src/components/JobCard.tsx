import { type JobPosting } from '../types'

type JobCardProps = {
  job: JobPosting
}

export function JobCard({ job }: JobCardProps) {
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
