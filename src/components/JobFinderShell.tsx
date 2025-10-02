import { ResumeUploadCard } from './ResumeUploadCard'
import { SiteHeader } from './SiteHeader'
import { InsightsSection } from './InsightsSection'
import { SiteFooter } from './SiteFooter'
import { DeyHelper } from './DeyHelper'
import { useJobFinderState } from '../hooks/useJobFinderState'

export function JobFinderShell() {
  const state = useJobFinderState()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <SiteHeader onReset={state.clearSession} />

      <main className="flex-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <ResumeUploadCard
            resumeFile={state.resumeFile}
            resumeName={state.resumeName}
            resumeSizeLabel={state.resumeSizeLabel}
            preferredLocation={state.preferredLocation}
            customPrompt={state.customPrompt}
            remoteEnabled={state.remoteEnabled}
            isAnalyzing={state.isAnalyzing}
            error={state.error}
            onFileChange={state.handleFileChange}
            onPreferredLocationChange={state.handlePreferredLocationChange}
            onCustomPromptChange={state.handleCustomPromptChange}
            onRemoteToggle={state.handleRemoteToggle}
            onAnalyze={state.handleAnalyze}
          />

          {state.insightsVisible ? (
            <InsightsSection
              analysis={state.analysis}
              isLoading={state.isLoadingInsights}
              isFetchingJobs={state.isFetchingJobs}
              jobs={state.jobs}
              paginatedJobs={state.paginatedJobs}
              infoMessage={state.infoMessage}
              currentPage={state.currentPage}
              totalPages={state.totalPages}
              pageNumbers={state.pageNumbers}
              onGoToPage={state.goToPage}
              onFindMoreJobs={state.handleFindMoreJobs}
              isFindingMoreJobs={state.isFindingMoreJobs}
              hasBroadenedSearch={state.hasBroadenedSearch}
            />
          ) : null}
        </div>
      </main>

      <DeyHelper showPanel={state.showPetPanel} onToggle={state.handleTogglePetPanel} onClose={state.handleClosePetPanel} />

      <SiteFooter />
    </div>
  )
}
