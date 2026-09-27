import { buildBreakdownPrompt } from '../lib/prompts';
import { copyToClipboard } from '../lib/clipboard';
import type { GenerationStatus } from '../hooks/useProject';
import type { Project } from '../types';

type StorySetupModalProps = {
  open: boolean;
  project: Project;
  onClose: () => void;
  onChange: (patch: Partial<Project>) => void;
  onGenerate: () => void;
  generationStatus: GenerationStatus;
  showToast: (msg: string) => void;
};

export function StorySetupModal({
  open,
  project,
  onClose,
  onChange,
  onGenerate,
  generationStatus,
  showToast,
}: StorySetupModalProps) {
  const busy = generationStatus.phase === 'story' || generationStatus.phase === 'illustration';
  const statusLine =
    generationStatus.phase === 'error'
      ? generationStatus.message
      : generationStatus.phase === 'story'
        ? 'Writing the story.'
        : null;
  const breakdownPrompt = buildBreakdownPrompt({
    theme: project.theme,
    detailedWriteup: project.detailedWriteup,
    pageCount: project.breakdownPageCount,
  });

  async function copyBreakdown() {
    const ok = await copyToClipboard(breakdownPrompt);
    showToast(ok ? 'Prompt copied' : 'Copy failed');
  }

  function handlePageCount(raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 99) {
      onChange({ breakdownPageCount: n });
    }
  }

  return (
    <div
      className={`scrim${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Start your story</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="theme">
              <span className="stepnum">1</span>Your theme (1–2 lines)
            </label>
            <textarea
              id="theme"
              rows={2}
              value={project.theme}
              onChange={(e) => onChange({ theme: e.target.value })}
              placeholder="e.g. Me and a friend had a discussion today about the meaning of life."
            />
          </div>
          <div className="field">
            <label htmlFor="writeup">
              <span className="stepnum">2</span>Tell us more
            </label>
            <div className="hint">
              What did you talk about? What do you want the story to be around?
            </div>
            <textarea
              id="writeup"
              rows={4}
              value={project.detailedWriteup}
              onChange={(e) => onChange({ detailedWriteup: e.target.value })}
              placeholder="Write more details about what you discussed and what you want the story to be about."
            />
          </div>
          <div className="divider" />
          <div className="field">
            <label>
              <span className="stepnum">3</span>Write the story
            </label>
            <div className="hint">
              The story is written from your theme and from Tell us more.
            </div>
            <div className="pagecount" style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>Number of pages</span>
              <input
                type="number"
                min={1}
                max={99}
                value={project.breakdownPageCount}
                onChange={(e) => handlePageCount(e.target.value)}
              />
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                (default 8, edit anytime)
              </span>
            </div>
            {statusLine ? (
              <p className="hint" role="status">
                {statusLine}
              </p>
            ) : null}
            <div className="row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || project.theme.trim() === ''}
                onClick={onGenerate}
              >
                Write the story
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void copyBreakdown()}>
                Copy prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
