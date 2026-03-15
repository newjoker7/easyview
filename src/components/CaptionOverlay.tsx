import React, { useState, useRef, useEffect } from 'react';

export interface CaptionOverlayClip {
  id?: string;
  start?: number;
  end?: number;
  captionText?: string;
  captionSegments?: { start: number; end: number; text: string }[];
}

interface CaptionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clip: CaptionOverlayClip;
  styleProps: React.CSSProperties | null;
}

/**
 * Lógica: entra o primeiro trecho de legenda → quando termina, pausa (nada) → espera → entra o próximo trecho.
 * Só mostramos texto quando o tempo está estritamente dentro de um segmento [start, end); entre segmentos mostramos nada.
 * Contrato: captionSegments em tempo relativo ao clipe (0 = início do clipe).
 */
export function CaptionOverlay({ videoRef, clip, styleProps }: CaptionOverlayProps) {
  const [displayText, setDisplayText] = useState('');
  const segs = clip?.captionSegments;
  const hasSegments = Array.isArray(segs) && segs.length > 0;
  const segsRef = useRef(segs);
  segsRef.current = segs;

  useEffect(() => {
    const video = videoRef?.current;
    if (!clip || !video) return;

    if (hasSegments && segs?.length) {
      const clipStart = clip.start ?? 0;
      const clipEnd = clip.end ?? clipStart + 1;

      const update = () => {
        const vt = video.currentTime;
        if (vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
          setDisplayText('');
          return;
        }
        const timeInClip = vt - clipStart;
        const list = segsRef.current ?? [];
        const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
        if (segment) {
          setDisplayText(segment.text.trim());
        } else {
          setDisplayText('');
        }
      };

      video.addEventListener('timeupdate', update);
      update();

      return () => {
        video.removeEventListener('timeupdate', update);
        setDisplayText('');
      };
    }

    setDisplayText(clip.captionText?.trim() ?? '');
    return undefined;
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
