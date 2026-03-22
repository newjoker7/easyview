import React, { useCallback, useRef } from 'react';
import type { EditorTextOverlay } from '../types/editorText';

interface TextOverlayLayerProps {
  containerRef: React.RefObject<HTMLElement | null>;
  overlays: EditorTextOverlay[];
  currentTime: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Pick<EditorTextOverlay, 'xPercent' | 'yPercent'>>) => void;
  /** Chamado uma vez ao iniciar arrasto (para undo). */
  onDragStart?: () => void;
}

export function TextOverlayLayer({
  containerRef,
  overlays,
  currentTime,
  selectedId,
  onSelect,
  onUpdate,
  onDragStart,
}: TextOverlayLayerProps) {
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      const el = containerRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dx = ((e.clientX - d.startX) / w) * 100;
      const dy = ((e.clientY - d.startY) / h) * 100;
      const x = Math.max(0, Math.min(100, d.origX + dx));
      const y = Math.max(0, Math.min(100, d.origY + dy));
      onUpdate(d.id, { xPercent: x, yPercent: y });
    },
    [containerRef, onUpdate]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [onPointerMove]);

  const onPointerDown = (e: React.PointerEvent, o: EditorTextOverlay) => {
    if (selectedId !== o.id) {
      onSelect(o.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onDragStart?.();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: o.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: o.xPercent,
      origY: o.yPercent,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const visible = overlays.filter(
    (o) => currentTime >= o.timelineStart && currentTime < o.timelineEnd
  );

  return (
    <div
      className="absolute inset-0 z-[15] pointer-events-none"
      aria-hidden={visible.length === 0}
    >
      {visible.map((o) => {
        const isSel = selectedId === o.id;
        return (
          <button
            key={o.id}
            type="button"
            data-text-overlay-item
            className={`absolute pointer-events-auto max-w-[90%] text-left break-words cursor-pointer select-none touch-none ${
              isSel ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-zinc-900/40 rounded-md' : ''
            }`}
            style={{
              left: `${o.xPercent}%`,
              top: `${o.yPercent}%`,
              transform: 'translate(-50%, -50%)',
              fontFamily: o.fontFamily,
              fontSize: `clamp(10px, ${o.fontSize * 0.09}vmin, ${o.fontSize}px)`,
              fontWeight: o.fontWeight,
              color: o.color,
              textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)',
              cursor: isSel ? 'grab' : 'pointer',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDown(e, o);
            }}
          >
            {o.text || 'Texto'}
          </button>
        );
      })}
    </div>
  );
}
