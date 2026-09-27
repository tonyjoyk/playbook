type RasterLightboxProps = {
  imageUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
};

export function RasterLightbox({
  imageUrl,
  onClose,
  onDownload,
}: RasterLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      className={`scrim open`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal"
        style={{ maxWidth: 'min(900px, 96vw)', background: 'transparent', boxShadow: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <button type="button" className="btn btn-ghost" onClick={onDownload}>
            Download original
          </button>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <img
          src={imageUrl}
          alt="Original illustration"
          style={{
            width: '100%',
            borderRadius: 12,
            boxShadow: 'var(--shadow)',
            background: '#fff',
          }}
        />
      </div>
    </div>
  );
}
