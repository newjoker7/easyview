import React, { useState, useRef, useEffect } from 'react';

/** Ative (true) para ver no console os valores de sincronização da legenda a cada ~500ms. */
const DEBUG_CAPTION = false;

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

    if (DEBUG_CAPTION) {
      console.log('[CaptionOverlay] segmentos (start, end em s relativo ao clipe):', segsRef.current?.map((s, i) => ({ i, start: s.start, end: s.end, text: s.text?.slice(0, 40) })));
    }

    let rafId: number;
    let lastLog = 0;
    const tick = () => {
      const vt = video.currentTime;
      if (!Number.isFinite(vt) || vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
        setActiveText('');
        rafId = requestAnimationFrame(tick);
        return;
      }
      const timeInClip = vt - clipStart;
      const list = segsRef.current ?? [];
      // Verificação do intervalo entre falas:
      // - Se timeInClip está em [seg.start, seg.end) → mostra legenda desse segmento.
      // - Se timeInClip está entre seg[i].end e seg[i+1].start → nenhum segmento dá match → legenda em branco.
      const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
      

      console.log('timeInClip', timeInClip);
      console.log('segment.start', segment?.start);
      console.log('segment.end', segment?.end);
      console.log('segment', segment?.text?.trim() ?? '');
      setActiveText(segment?.text?.trim() ?? '');

      if (DEBUG_CAPTION && typeof performance !== 'undefined' && performance.now() - lastLog >= 500) {
        lastLog = performance.now();
        const idx = segment != null ? list.indexOf(segment) : -1;
        console.log('[CaptionOverlay]', {
          vt: Math.round(vt * 1000) / 1000,
          clipStart,
          clipEnd,
          timeInClip: Math.round(timeInClip * 1000) / 1000,
          segmentIndex: idx,
          segment: segment ? { start: segment.start, end: segment.end, text: segment.text?.slice(0, 30) } : null,
          totalSegments: list.length,
        });
      }
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
