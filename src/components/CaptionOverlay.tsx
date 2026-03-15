import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toDisplaySegments } from '../services/captionSegments';

export interface CaptionOverlayClip {
  id?: string;
  /** Início do clipe no ficheiro (segundos). */
  start?: number;
  /** Fim do clipe no ficheiro (segundos). */
  end?: number;
  captionText?: string;
  /** Segmentos em tempo relativo ao clipe (0 = início). Normalizados no backend e por normalizeToClipRelative. */
  captionSegments?: { start: number; end: number; text: string }[];
}

interface CaptionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clip: CaptionOverlayClip;
  styleProps: React.CSSProperties | null;
}

/**
 * Exibe legenda sincronizada com a fala.
 * Usa segmentos com "display offset": só mostra quando timeInClip está em [seg.start+offset, seg.end).
 * Atualização por requestAnimationFrame para sincronia precisa; estado só muda quando o segmento ativo muda.
 */
export function CaptionOverlay({ videoRef, clip, styleProps }: CaptionOverlayProps) {
  const [activeText, setActiveText] = useState('');
  const clipStart = Number(clip?.start) ?? 0;
  const clipEnd = Number(clip?.end) ?? clipStart + 1;
  const rawSegs = clip?.captionSegments;
  const hasSegments = Array.isArray(rawSegs) && rawSegs.length > 0;

  const displaySegments = useMemo(
    () => (hasSegments ? toDisplaySegments(rawSegs!) : []),
    [hasSegments, rawSegs]
  );

  const displaySegsRef = useRef(displaySegments);
  displaySegsRef.current = displaySegments;

  useEffect(() => {
    const video = videoRef?.current;
    if (!clip || !video) {
      setActiveText('');
      return;
    }

    if (!hasSegments || displaySegments.length === 0) {
      const fallback = clip?.captionText?.trim() ?? '';
      setActiveText(fallback);
      return;
    }

    let rafId: number;
    let lastActiveText = '';

    const tick = () => {
      const vt = video.currentTime;
      if (!Number.isFinite(vt) || vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
        if (lastActiveText !== '') {
          lastActiveText = '';
          setActiveText('');
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      const timeInClip = vt - clipStart;
      const list = displaySegsRef.current ?? [];
      const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
      const nextText = segment?.text?.trim() ?? '';

      if (nextText !== lastActiveText) {
        lastActiveText = nextText;
        setActiveText(nextText);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      setActiveText('');
    };
  }, [clip?.id, clip?.start, clip?.end, clip?.captionText, videoRef, hasSegments, displaySegments.length]);

  if (!styleProps || !activeText) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-6 z-10 px-4">
      <span
        className="text-xl font-medium break-words text-center max-w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        style={styleProps}
      >
        {activeText}
      </span>
    </div>
  );
}
