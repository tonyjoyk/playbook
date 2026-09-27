import { useEffect, useRef, useState } from 'react';
import { exportBookPdf, exportPageImagesZip, exportPageSvgsZip } from '../lib/export';
import type { Project } from '../types';

type ExportMenuProps = {
  project: Project;
  onExported: () => void;
  showToast: (msg: string) => void;
};

export function ExportMenu({ project, onExported, showToast }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function runExport(kind: 'pdf' | 'zip' | 'svg') {
    setBusy(true);
    setOpen(false);
    try {
      if (kind === 'pdf') {
        await exportBookPdf(project);
        showToast('PDF downloaded');
      } else if (kind === 'zip') {
        await exportPageImagesZip(project);
        showToast('Page images downloaded');
      } else {
        const n = await exportPageSvgsZip(project);
        showToast(`Downloaded ${n} SVG page${n === 1 ? '' : 's'}`);
      }
      onExported();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void runExport('pdf')}
      >
        {busy ? 'Exporting…' : 'Export book ↓'}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: '9px 12px' }}
        aria-label="More export options"
        onClick={() => setOpen((v) => !v)}
      >
        ▾
      </button>
      {open && (
        <div className="export-menu">
          <button type="button" onClick={() => void runExport('pdf')}>
            Export as PDF
          </button>
          <button type="button" onClick={() => void runExport('zip')}>
            Download page images (ZIP)
          </button>
          <button type="button" onClick={() => void runExport('svg')}>
            Download SVG pages (ZIP)
          </button>
        </div>
      )}
    </div>
  );
}
