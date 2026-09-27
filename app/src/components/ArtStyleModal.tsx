import { getArtStyle } from '../lib/artStyles';
import type { Project } from '../types';

type ArtStyleModalProps = {
  open: boolean;
  project: Project;
  onClose: () => void;
};

export function ArtStyleModal({ open, project, onClose }: ArtStyleModalProps) {
  const style = getArtStyle(project.artStyleId);

  return (
    <div
      className={`scrim${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Choose your art style</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="hint" style={{ marginTop: -4 }}>
            Applies to every page in your book and shapes each image prompt. You can
            change it anytime.
          </div>
          <div className="style-grid">
            <div className="style-card">
              <img src={style.referenceImageUrl} alt={`${style.name} reference`} />
              <div className="style-card-body">
                <div className="style-card-title">
                  <strong style={{ fontFamily: 'Fraunces, serif' }}>{style.name}</strong>
                  <span className="soon selected">✓ Selected</span>
                </div>
                <div className="note" style={{ marginTop: 4 }}>
                  {style.description}
                </div>
              </div>
            </div>
            <div className="style-placeholder">
              <div>
                <div style={{ fontSize: 26 }}>＋</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>More styles</div>
                <div className="note">Coming soon</div>
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
