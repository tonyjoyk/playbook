import {
  DEFAULT_TRANSFORM,
  type ObjectTransform,
  type SceneDocument,
  type SceneObject,
} from '../types';

const MAX_HISTORY = 50;

export type SceneCommand = {
  label: string;
  apply: (scene: SceneDocument) => SceneDocument;
  revert: (scene: SceneDocument) => SceneDocument;
};

export class SceneHistory {
  private undoStack: SceneCommand[] = [];
  private redoStack: SceneCommand[] = [];

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(cmd: SceneCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(scene: SceneDocument): SceneDocument {
    const cmd = this.undoStack.pop();
    if (!cmd) return scene;
    this.redoStack.push(cmd);
    return cmd.revert(scene);
  }

  redo(scene: SceneDocument): SceneDocument {
    const cmd = this.redoStack.pop();
    if (!cmd) return scene;
    this.undoStack.push(cmd);
    return cmd.apply(scene);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function cloneScene(scene: SceneDocument): SceneDocument {
  return {
    ...scene,
    objects: scene.objects.map((o) => ({
      ...o,
      transform: { ...o.transform },
      paths: o.paths.map((p) => ({ ...p })),
      groupMeta: o.groupMeta
        ? {
            ...o.groupMeta,
            children: o.groupMeta.children?.map((c) => ({
              ...c,
              transform: { ...c.transform },
              paths: c.paths.map((p) => ({ ...p })),
            })),
          }
        : undefined,
    })),
  };
}

function transformsEqual(a: ObjectTransform, b: ObjectTransform): boolean {
  return (
    a.tx === b.tx &&
    a.ty === b.ty &&
    a.scale === b.scale &&
    a.rotation === b.rotation
  );
}

export function createTransformCommand(
  objectId: string,
  before: ObjectTransform,
  after: ObjectTransform
): SceneCommand | null {
  if (transformsEqual(before, after)) return null;
  return {
    label: 'Move object',
    apply: (scene) => patchTransform(scene, objectId, after),
    revert: (scene) => patchTransform(scene, objectId, before),
  };
}

function patchTransform(
  scene: SceneDocument,
  objectId: string,
  transform: ObjectTransform
): SceneDocument {
  const next = cloneScene(scene);
  next.objects = next.objects.map((obj) =>
    obj.id === objectId ? { ...obj, transform: { ...transform } } : obj
  );
  return next;
}

export function createReorderCommand(
  objectId: string,
  beforeZ: number,
  afterZ: number,
  swapId: string,
  swapBeforeZ: number,
  swapAfterZ: number
): SceneCommand | null {
  if (beforeZ === afterZ) return null;
  return {
    label: 'Reorder layer',
    apply: (scene) => swapZ(scene, objectId, afterZ, swapId, swapAfterZ),
    revert: (scene) => swapZ(scene, objectId, beforeZ, swapId, swapBeforeZ),
  };
}

function swapZ(
  scene: SceneDocument,
  idA: string,
  zA: number,
  idB: string,
  zB: number
): SceneDocument {
  const next = cloneScene(scene);
  next.objects = next.objects.map((obj) => {
    if (obj.id === idA) return { ...obj, zIndex: zA };
    if (obj.id === idB) return { ...obj, zIndex: zB };
    return obj;
  });
  return next;
}

function mergePathsForGroup(objects: SceneObject[]): {
  transform: ObjectTransform;
  paths: SceneObject['paths'];
} {
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
  const primary = sorted[0];
  const paths: SceneObject['paths'] = [];
  for (const obj of sorted) {
    const dx = obj.transform.tx - primary.transform.tx;
    const dy = obj.transform.ty - primary.transform.ty;
    const offset =
      dx !== 0 || dy !== 0 ? `translate(${dx} ${dy}) ` : '';
    for (const p of obj.paths) {
      paths.push({
        ...p,
        transform: `${offset}${p.transform}`.trim(),
      });
    }
  }
  return {
    transform: { ...primary.transform },
    paths,
  };
}

export function groupObjectsInScene(
  scene: SceneDocument,
  objectIds: string[],
  groupId: string
): SceneDocument {
  const ids = [...new Set(objectIds)];
  if (ids.length < 2) return scene;
  const selected = scene.objects.filter((o) => ids.includes(o.id));
  if (selected.length < 2) return scene;
  const rest = scene.objects.filter((o) => !ids.includes(o.id));
  const zIndex = Math.max(...selected.map((o) => o.zIndex));
  const { transform, paths } = mergePathsForGroup(selected);
  const group: SceneObject = {
    id: groupId,
    paths,
    transform,
    zIndex,
    groupMeta: {
      isManualGroup: true,
      children: selected.map((o) => ({
        ...o,
        transform: { ...o.transform },
        paths: o.paths.map((p) => ({ ...p })),
      })),
    },
  };
  const next = cloneScene(scene);
  next.objects = [...rest, group];
  return next;
}

export function ungroupObjectInScene(
  scene: SceneDocument,
  groupId: string
): SceneDocument {
  const group = scene.objects.find((o) => o.id === groupId);
  if (!group?.groupMeta?.children?.length) return scene;
  const rest = scene.objects.filter((o) => o.id !== groupId);
  const next = cloneScene(scene);
  next.objects = [...rest, ...group.groupMeta.children];
  return next;
}

export function createGroupCommand(
  objectIds: string[],
  groupId: string
): SceneCommand {
  return {
    label: 'Group objects',
    apply: (scene) => groupObjectsInScene(scene, objectIds, groupId),
    revert: (scene) => ungroupObjectInScene(scene, groupId),
  };
}

export function createUngroupCommand(
  groupId: string,
  children: SceneObject[]
): SceneCommand {
  const childIds = children.map((c) => c.id);
  return {
    label: 'Ungroup objects',
    apply: (scene) => ungroupObjectInScene(scene, groupId),
    revert: (scene) => groupObjectsInScene(scene, childIds, groupId),
  };
}

/** Round-trip helper for tests. */
export function applyCommandRoundTrip(
  scene: SceneDocument,
  cmd: SceneCommand
): { applied: SceneDocument; restored: SceneDocument } {
  const applied = cmd.apply(cloneScene(scene));
  const restored = cmd.revert(cloneScene(applied));
  return { applied, restored };
}

export function newManualGroupId(): string {
  return `group-${crypto.randomUUID().slice(0, 8)}`;
}

export { DEFAULT_TRANSFORM };
