import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Page, Project } from '../types';
import type { ImageUrls } from '../hooks/useProject';

type PageRailProps = {
  project: Project;
  activePageIndex: number;
  imageUrls: ImageUrls;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onReorder: (from: number, to: number) => void;
  onSeedPages: () => void;
  showToast: (msg: string) => void;
};

type SortableThumbProps = {
  page: Page;
  index: number;
  active: boolean;
  imageUrl: string | undefined;
  onSelect: () => void;
  onDelete: () => void;
};

function SortableThumb({
  page,
  index,
  active,
  imageUrl,
  onSelect,
  onDelete,
}: SortableThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm('Delete this page?')) onDelete();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`thumb${active ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      tabIndex={0}
    >
      <div className="frame">
        <div className="num">{index + 1}</div>
        {imageUrl ? (
          <div
            className="pic"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : (
          <div className="pic">
            <div className="blank">
              blank
              <br />
              page
            </div>
          </div>
        )}
        <div className="tools">
          <button
            type="button"
            className="drag-handle"
            title="Move"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            ⋮⋮
          </button>
          <button type="button" title="Delete" onClick={handleDelete}>
            🗑
          </button>
        </div>
      </div>
      <div className="cap">{page.script.trim() || 'Add the words…'}</div>
    </div>
  );
}

export function PageRail({
  project,
  activePageIndex,
  imageUrls,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onReorder,
  onSeedPages,
}: PageRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const showSeed =
    project.breakdownPageCount > project.pages.length &&
    project.theme.trim() !== '';

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = project.pages.findIndex((p) => p.id === active.id);
    const to = project.pages.findIndex((p) => p.id === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  }

  return (
    <section className="col rail">
      <div className="rail-head">
        <h3>Pages</h3>
        <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
          {project.pages.length} page{project.pages.length === 1 ? '' : 's'}
        </span>
        {showSeed && (
          <button type="button" className="seed-pages" onClick={onSeedPages}>
            + Add pages to match breakdown ({project.breakdownPageCount} total)
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={project.pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rail-list">
            {project.pages.map((page, index) => (
              <SortableThumb
                key={page.id}
                page={page}
                index={index}
                active={index === activePageIndex}
                imageUrl={
                  page.imageId ? imageUrls[page.imageId] : undefined
                }
                onSelect={() => onSelectPage(index)}
                onDelete={() => onDeletePage(page.id)}
              />
            ))}
            <button type="button" className="add-page" onClick={onAddPage}>
              ＋ Add page
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
