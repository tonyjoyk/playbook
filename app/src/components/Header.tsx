import type { Project } from '../types';
import { ExportMenu } from './ExportMenu';

type HeaderProps = {
  project: Project;
  onTitleChange: (title: string) => void;
  onOpenStorySetup: () => void;
  onOpenStyle: () => void;
  onExported: () => void;
  showToast: (msg: string) => void;
};

export function Header({
  project,
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
