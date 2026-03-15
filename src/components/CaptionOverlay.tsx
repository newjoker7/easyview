import React, { useState, useRef, useEffect } from 'react';

export interface CaptionOverlayClip {
  id?: string;
  start?: number;
  end?: number;
  captionText?: string;
  /** Segmentos em tempo relativo ao clipe (0 = início). */
  captionSegments?: { start: number; end: number; text: string }[];
}

interface CaptionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clip: CaptionOverlayClip;
  styleProps: React.CSSProperties | null;
}

/**
 * Exibe legenda respeitando os intervalos das falas:
 * - Durante um segmento [seg.start, seg.end): mostra o texto da legenda.
 * - Fora dos segmentos (pausas entre falas): não mostra nada — intervalo em branco.
 * Usa RAF para limpar a legenda assim que o tempo sai do segmento.
 */
export function CaptionOverlay({ videoRef, clip, styleProps }: CaptionOverlayProps) {
  const [activeText, setActiveText] = useState('');
  const segs = clip?.captionSegments ?? [];
  const hasSegments = segs.length > 0;
  const segsRef = useRef(segs);
  segsRef.current = segs;

  const clipStart = Number(clip?.start) ?? 0;
  const clipEnd = Number(clip?.end) ?? clipStart + 1;

  useEffect(() => {
    const video = videoRef?.current;
    if (!clip || !video) {
      setActiveText('');
      return;
    }

    if (!hasSegments) {
      setActiveText(clip?.captionText?.trim() ?? '');
      return;
    }

    let rafId: number;
    const tick = () => {
      const vt = video.currentTime;
      if (!Number.isFinite(vt) || vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
        setActiveText('');
        rafId = requestAnimationFrame(tick);
        return;
      }
      const timeInClip = vt - clipStart;
      const list = segsRef.current ?? [];
      // Só mostra legenda dentro de um segmento; entre segmentos = intervalo = nada.
      const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
      setActiveText(segment?.text?.trim() ?? '');
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      setActiveText('');
    };
  }, [clip?.id, clip?.start, clip?.end, clip?.captionText, videoRef, hasSegments, segs.length]);

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
