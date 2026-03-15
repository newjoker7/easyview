import React, { useState, useRef, useEffect } from 'react';

const CAPTION_TRACK_LABEL = 'Legenda (editor)';

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
      for (const s of segs) {
        const start = Math.max(clipStart, Math.min(clipEnd, clipStart + s.start));
        const end = Math.max(start, Math.min(clipEnd, clipStart + s.end));
        if (end <= start || !s.text.trim()) continue;
        const cue = new VTTCue(start, end, s.text.trim());
        track.addCue(cue);
        cuesRef.current.push(cue);
      }
      track.mode = 'showing';

      const onCueChange = () => {
        const vt = video.currentTime;
        if (vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
          setDisplayText('');
          return;
        }
        const active = track!.activeCues;
        if (!active || active.length === 0) {
          setDisplayText('');
          return;
        }
        const cue = active[0] as VTTCue;
        if (vt >= cue.startTime && vt < cue.endTime) {
          setDisplayText(cue.text);
        } else {
          setDisplayText('');
        }
      };
      track.addEventListener('cuechange', onCueChange);
      video.addEventListener('timeupdate', onCueChange);
      onCueChange();

      return () => {
        track.removeEventListener('cuechange', onCueChange);
        video.removeEventListener('timeupdate', onCueChange);
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
