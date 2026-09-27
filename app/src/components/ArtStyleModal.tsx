import { ART_STYLES } from '../lib/artStyles';
import type { Project } from '../types';

type ArtStyleModalProps = {
  open: boolean;
  project: Project;
  onClose: () => void;
  onChange: (patch: Partial<Project>) => void;
};

export function ArtStyleModal({ open, project, onClose, onChange }: ArtStyleModalProps) {
  const styles = Object.values(ART_STYLES);

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
            {styles.map((style) => {
              const selected = style.id === project.artStyleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  className="style-card"
                  onClick={() => onChange({ artStyleId: style.id })}
                >
                  {style.referenceImageUrl ? (
                    <img src={style.referenceImageUrl} alt="" />
                  ) : null}
                  <div className="style-card-body">
                    <div className="style-card-title">
                      <strong style={{ fontFamily: 'Fraunces, serif' }}>{style.name}</strong>
                      {selected ? <span className="soon selected">Selected</span> : null}
                    </div>
                    <div className="note" style={{ marginTop: 4 }}>
                      {style.description}
                    </div>
                  </div>
                </button>
              );
            })}
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
