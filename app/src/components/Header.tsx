import type { GenerationStatus } from '../hooks/useProject';
import type { Project } from '../types';
import { ExportMenu } from './ExportMenu';

type HeaderProps = {
  project: Project;
  generationStatus: GenerationStatus;
  onRetry: () => void;
  onTitleChange: (title: string) => void;
  onOpenStorySetup: () => void;
  onOpenStyle: () => void;
  onExported: () => void;
  showToast: (msg: string) => void;
};

export function Header({
  project,
  generationStatus,
  onRetry,
  onTitleChange,
  onOpenStorySetup,
  onOpenStyle,
  onExported,
  showToast,
}: HeaderProps) {
  return (
    <header>
      <div className="brand">
        <span className="logo">📖</span> Playbook&nbsp;Pal
      </div>
      <div className="title-edit">
        <input
          value={project.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Book title"
        />
      </div>
      <div className="header-actions">
        {generationStatus.phase === 'illustration' ? (
          <span className="muted">
            Drawing page {generationStatus.pageNumber} of {generationStatus.total}
          </span>
        ) : null}
        {generationStatus.phase === 'story' ? <span className="muted">Writing the story.</span> : null}
        {generationStatus.phase === 'error' ? (
          <span className="muted" role="status">
            {generationStatus.message}
            {generationStatus.pageIndex !== null ? (
              <button type="button" className="btn btn-ghost" onClick={onRetry}>
                Retry page
              </button>
            ) : null}
          </span>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onOpenStorySetup}>
          📖 Story setup
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenStyle}>
          🎨 Art style
        </button>
        <ExportMenu
          project={project}
          onExported={onExported}
          showToast={showToast}
        />
      </div>
    </header>
  );
}
