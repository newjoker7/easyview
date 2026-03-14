import React, { useState, useRef, useEffect } from 'react';

const CAPTION_TRACK_LABEL = 'Legenda (editor)';
/** Intervalo mínimo (em segundos) entre cues para haver "break" sem legenda entre falas. */
const CAPTION_GAP_BETWEEN_CUES_SEC = 0.2;

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
 * Overlay de legenda sincronizado via API nativa TextTrack + VTTCue.
 * O browser decide quando cada cue está ativo (evento cuechange); evitamos RAF e erros de referência de tempo.
 * Contrato: captionSegments devem estar em tempo relativo ao clipe (0 = início do clipe).
 */
export function CaptionOverlay({ videoRef, clip, styleProps }: CaptionOverlayProps) {
  const [displayText, setDisplayText] = useState('');
  const segs = clip?.captionSegments;
  const hasSegments = Array.isArray(segs) && segs.length > 0;
  const trackRef = useRef<TextTrack | null>(null);
  const cuesRef = useRef<VTTCue[]>([]);

  useEffect(() => {
    const video = videoRef?.current;
    if (!clip || !video) return;

    if (hasSegments && segs?.length) {
      let track = trackRef.current;
      if (!track || !Array.from(video.textTracks).includes(track)) {
        track = Array.from(video.textTracks).find((t) => t.label === CAPTION_TRACK_LABEL) ?? null;
        if (!track) {
          track = video.addTextTrack('captions', CAPTION_TRACK_LABEL, 'pt');
        }
        trackRef.current = track;
      }

      cuesRef.current.forEach((c) => {
        try {
          track!.removeCue(c);
        } catch {
          /* ignore */
        }
      });
      cuesRef.current = [];

      const clipStart = clip.start ?? 0;
      const clipEnd = clip.end ?? clipStart + 1;
      const gap = CAPTION_GAP_BETWEEN_CUES_SEC;
      const sorted = [...segs].sort((a, b) => a.start - b.start);
      let prevEnd = clipStart - 1;
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const mediaStart = clipStart + s.start;
        const mediaEnd = clipStart + s.end;
        const nextStart = i + 1 < sorted.length ? clipStart + sorted[i + 1].start : Infinity;
        const cueStart = Math.max(clipStart, mediaStart, prevEnd + gap);
        const cueEnd = Math.min(clipEnd, mediaEnd, nextStart - gap);
        if (cueEnd <= cueStart || !s.text.trim()) continue;
        const cue = new VTTCue(cueStart, cueEnd, s.text.trim());
        track.addCue(cue);
        cuesRef.current.push(cue);
        prevEnd = cueEnd;
      }
      track.mode = 'showing';

      const onCueChange = () => {
        const active = track!.activeCues;
        const text = active?.length ? (active[0] as VTTCue).text : '';
        setDisplayText(text);
      };
      track.addEventListener('cuechange', onCueChange);
      onCueChange();

      return () => {
        track.removeEventListener('cuechange', onCueChange);
        cuesRef.current.forEach((c) => {
          try {
            track!.removeCue(c);
          } catch {
            /* ignore */
          }
        });
        cuesRef.current = [];
        track.mode = 'disabled';
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
