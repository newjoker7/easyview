import React, { useState, useRef, useEffect } from 'react';

export interface CaptionOverlayClip {
  id?: string;
  /** Início do clipe no ficheiro (segundos). */
  start?: number;
  /** Fim do clipe no ficheiro (segundos). */
  end?: number;
  captionText?: string;
  /** Segmentos em tempo relativo ao clipe: 0 = início do clipe. Sempre normalizados por captionSegments.normalizeToClipRelative. */
  captionSegments?: { start: number; end: number; text: string }[];
}

interface CaptionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clip: CaptionOverlayClip;
  styleProps: React.CSSProperties | null;
}

/**
 * Exibe legenda sincronizada com a fala.
 * Regra: só mostra texto quando o tempo de vídeo está estritamente dentro de um segmento [start, end).
 * Entre segmentos mostra nada (pausa). clip.start/clip.end = trim do clipe no ficheiro; segmentos em 0..duração do clipe.
 */
export function CaptionOverlay({ videoRef, clip, styleProps }: CaptionOverlayProps) {
  const [displayText, setDisplayText] = useState('');
  const segs = clip?.captionSegments;
  const hasSegments = Array.isArray(segs) && segs.length > 0;
  const segsRef = useRef(segs);
  segsRef.current = segs;

  useEffect(() => {
    const video = videoRef?.current;
    if (!clip || !video || !hasSegments || !segs?.length) {
      if (clip?.captionText?.trim()) setDisplayText(clip.captionText.trim());
      else setDisplayText('');
      return;
    }

    const clipStart = Number(clip.start) ?? 0;
    const clipEnd = Number(clip.end) ?? clipStart + 1;

    const update = () => {
      const vt = video.currentTime;
      if (Number.isFinite(vt) === false || vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
        setDisplayText('');
        return;
      }
      const timeInClip = vt - clipStart;
      const list = segsRef.current ?? [];
      const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
      setDisplayText(segment?.text?.trim() ?? '');
    };

    video.addEventListener('timeupdate', update);
    update();

    return () => {
      video.removeEventListener('timeupdate', update);
      setDisplayText('');
    };
  }, [clip?.id, clip?.start, clip?.end, clip?.captionText, videoRef, hasSegments, segs?.length]);

  if (!styleProps || !displayText) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-6 z-10 px-4">
      <span
        className="text-xl font-medium break-words text-center max-w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        style={styleProps}
      >
        {displayText}
      </span>
    </div>
  );
}
