import type { CompositeDocument, CompositeLayer } from '../types';

const MAX_HISTORY = 50;

export type CompositeSnapshot = {
  backgroundBlobId: string;
  layers: CompositeLayer[];
};

export type CompositeCommand = {
  label: string;
  apply: (doc: CompositeDocument) => CompositeDocument;
  revert: (doc: CompositeDocument) => CompositeDocument;
};

export class CompositeHistory {
  private undoStack: CompositeCommand[] = [];
  private redoStack: CompositeCommand[] = [];

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(cmd: CompositeCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(doc: CompositeDocument): CompositeDocument {
    const cmd = this.undoStack.pop();
    if (!cmd) return doc;
    this.redoStack.push(cmd);
    return cmd.revert(cloneComposite(doc));
  }

  redo(doc: CompositeDocument): CompositeDocument {
    const cmd = this.redoStack.pop();
    if (!cmd) return doc;
    this.undoStack.push(cmd);
    return cmd.apply(cloneComposite(doc));
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function cloneComposite(doc: CompositeDocument): CompositeDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      transform: { ...l.transform },
    })),
  };
}

function cloneLayers(layers: CompositeLayer[]): CompositeLayer[] {
  return layers.map((l) => ({ ...l, transform: { ...l.transform } }));
}

export function snapshotFromDoc(doc: CompositeDocument): CompositeSnapshot {
  return {
    backgroundBlobId: doc.backgroundBlobId,
    layers: cloneLayers(doc.layers),
  };
}

export function applySnapshot(
  doc: CompositeDocument,
  snap: CompositeSnapshot
): CompositeDocument {
  return {
    ...doc,
    backgroundBlobId: snap.backgroundBlobId,
    layers: cloneLayers(snap.layers),
  };
}

export function createCompositeSnapshotCommand(
  before: CompositeSnapshot,
  after: CompositeSnapshot,
  label: string
): CompositeCommand {
  return {
    label,
    apply: (doc) => applySnapshot(doc, after),
    revert: (doc) => applySnapshot(doc, before),
  };
}

export function applyCommandRoundTrip(
  doc: CompositeDocument,
  cmd: CompositeCommand
): { applied: CompositeDocument; restored: CompositeDocument } {
  const applied = cmd.apply(cloneComposite(doc));
  const restored = cmd.revert(cloneComposite(applied));
  return { applied, restored };
}
