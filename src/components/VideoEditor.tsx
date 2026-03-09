import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Scissors, CircleOff, Image, Palette, Contrast, Sparkles, Download, Upload, Loader2, CheckCircle, X, Trash2, GripVertical, Layout, Type } from 'lucide-react';
import { LegendaModal, getCaptionStyleProps } from './LegendaModal';
import { uploadFile, exportVideoOnServer, convertWebmToMp4 } from '../services/api';
import type { ProjectData } from '../services/projects';

export type FilterType = 'none' | 'grayscale' | 'sepia' | 'invert' | 'blur' | 'blur-bg-band-h' | 'blur-bg-band-v';

const BLUR_BG_BAND_TYPES: FilterType[] = ['blur-bg-band-h', 'blur-bg-band-v'];

function buildFilter(type: FilterType, intensity: number): string {
  if (type === 'none' || intensity <= 0) return 'none';
  if (BLUR_BG_BAND_TYPES.includes(type)) return 'none'; // band video sem filtro; o fundo usa blur à parte
  const pct = Math.max(0, Math.min(100, intensity)) / 100;
  switch (type) {
    case 'grayscale':
      return `grayscale(${pct * 100}%)`;
    case 'sepia':
      return `sepia(${pct * 100}%)`;
    case 'invert':
      return `invert(${pct * 100}%)`;
    case 'blur':
      return `blur(${pct * 8}px)`;
    default:
      return 'none';
  }
}

/** Intensidade do blur do fundo para os efeitos blur-bg-band (1–30px). */
function blurBgBandBlurPx(intensity: number): number {
  const pct = Math.max(0, Math.min(100, intensity)) / 100;
  return 8 + Math.round(pct * 22);
}

export type CaptionStyleId =
  | 'none'
  | 'karaoke'
  | 'deep-diver'
  | 'popline'
  | 'seamless-bounce'
  | 'beasty'
  | 'youshaei'
  | 'mozi'
  | 'glitch'
  | 'baby-earthquake';

export interface Clip {
  id: string;
  url: string;
  start: number;
  end: number;
  name?: string;
  offset?: number;
  serverUrl?: string;
  muted?: boolean;
  filterType?: FilterType;
  filterIntensity?: number;
  captionStyle?: CaptionStyleId;
  captionText?: string;
  /** Segmentos de legenda extraídos do vídeo (start/end em segundos relativos ao clipe). */
  captionSegments?: { start: number; end: number; text: string }[];
}

const SAMPLE_VIDEO_URL =
  'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function generateId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getClipName(c: Clip, fallback?: string) {
  if (c.name) return c.name;
  try {
    const u = new URL(c.url);
    const parts = u.pathname.split('/');
    const last = parts[parts.length - 1];
    if (last) return last;
  } catch {
    // ignore
  }
  return fallback ?? 'Clip';
}

const CAPTION_TOLERANCE_SEC = 0.04;

function CaptionOverlay({
  videoRef,
  clip,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clip: Clip;
}) {
  const [displayText, setDisplayText] = useState('');
  const segs = clip?.captionSegments;
  const hasSegments = Array.isArray(segs) && segs.length > 0;

  useEffect(() => {
    if (!clip) return;
    if (hasSegments && segs) {
      const clipStart = clip.start;
      let rafId: number;
      const tick = () => {
        const video = videoRef?.current;
        if (video && typeof video.currentTime === 'number') {
          const timeInClip = video.currentTime - clipStart;
          const seg = segs.find(
            (s) => timeInClip >= s.start - CAPTION_TOLERANCE_SEC && timeInClip < s.end + CAPTION_TOLERANCE_SEC
          );
          const next = seg?.text ?? '';
          setDisplayText((prev) => (next === prev ? prev : next));
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }
    setDisplayText(clip.captionText?.trim() ?? '');
    return undefined;
  }, [clip?.id, clip?.start, clip?.captionText, videoRef, hasSegments, segs]);

  if (!displayText) return null;

  const baseStyle: React.CSSProperties = {
    color: '#ffffff',
    fontWeight: 700,
    textShadow: '0 0 4px rgba(0,0,0,0.9)',
  };
  const styleProps =
    getCaptionStyleProps(clip.captionStyle as any) || baseStyle;

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

export interface VideoEditorHandle {
  getProjectData: () => ProjectData;
  loadProjectData: (data: ProjectData) => void;
  addVideoFile: (file: File, serverUrl?: string) => void;
  addAudioFile: (file: File, serverUrl?: string) => void;
  hasVideo: () => boolean;
}

interface VideoEditorProps {
  projectId?: string;
  initialData?: ProjectData;
  onDirty?: () => void;
}

function VideoEditorInner(
  props: VideoEditorProps,
  ref: React.ForwardedRef<VideoEditorHandle>
) {
  const { initialData, onDirty } = props;
  const [clips, setClips] = useState<Clip[]>(() => {
    if (initialData?.clips?.length) {
      return initialData.clips.map((c) => ({ ...c, url: c.serverUrl || c.url || '' }));
    }
    return [];
  });
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<FilterType>((initialData?.filterType as FilterType) || 'none');
  const [filterIntensity, setFilterIntensity] = useState<number>(initialData?.filterIntensity ?? 100);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const [isDragOver, setIsDragOver] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPhase, setExportPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [legendaModalOpen, setLegendaModalOpen] = useState(false);
  const [playheadKey, setPlayheadKey] = useState(0);
  const [audioTracks, setAudioTracks] = useState<Array<{ id: string; name: string; clips: Clip[]; muted?: boolean }>>(() => {
    if (initialData?.audioTracks?.length) {
      return initialData.audioTracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, url: c.serverUrl || c.url || '' })),
      }));
    }
    return [];
  });
  const audioTracksRef = useRef(audioTracks);
  audioTracksRef.current = audioTracks;
  const playAllAudioAtTimeRef = useRef<(t: number, play: boolean) => void>(() => {});
  const [selectedTrack, setSelectedTrack] = useState<'video' | string>('video');
  const [selectedClip, setSelectedClip] = useState<{ track: 'video' | 'audio' | null; trackId?: string; clipId?: string }>({ track: null });
  // undo history
  const historyRef = useRef<Array<{ clips: Clip[]; audioTracks: Array<{ id: string; name: string; clips: Clip[]; muted?: boolean }>; currentTime: number; selectedClip: any; selectedTrack: any }>>([]);
  const pushHistory = useCallback(() => {
    const snapshot = {
      clips: JSON.parse(JSON.stringify(clips)),
      audioTracks: JSON.parse(JSON.stringify(audioTracks)),
      currentTime,
      selectedClip,
      selectedTrack,
    };
    historyRef.current.push(snapshot);
    // limitar histórico de undo para no máximo 4 estados
    while (historyRef.current.length > 4) historyRef.current.shift();
    onDirty?.();
  }, [clips, audioTracks, currentTime, selectedClip, selectedTrack, onDirty]);

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    const restoredClips: Clip[] = JSON.parse(JSON.stringify(snap.clips));
    const restoredTracks = JSON.parse(JSON.stringify(snap.audioTracks));
    setClips(restoredClips);
    setAudioTracks(restoredTracks);
    setCurrentTime(snap.currentTime);
    setSelectedClip(snap.selectedClip ?? { track: null });
    setSelectedTrack(snap.selectedTrack ?? 'video');
    // se estiver tocando durante o undo, pausar vídeo e TODAS as trilhas de áudio
    if (isPlayingRef.current) {
      setIsPlaying(false);
      if (videoRef.current) {
        try { videoRef.current.pause(); } catch {}
      }
      Object.values(audioElsRef.current).forEach((el) => {
        if (!el) return;
        try {
          el.pause();
          // opcional: manter posição; não zeramos currentTime
        } catch {
          // ignore
        }
      });
    }
    if (restoredClips.length > 0 && videoRef.current) {
      let acc = 0;
      let clipIdx = 0;
      for (let i = 0; i < restoredClips.length; i++) {
        const len = restoredClips[i].end - restoredClips[i].start;
        if (snap.currentTime < acc + len) { clipIdx = i; break; }
        acc += len;
        if (i === restoredClips.length - 1) clipIdx = i;
      }
      const clip = restoredClips[clipIdx];
      currentClipIndexRef.current = clipIdx;
      if (currentClipUrlRef.current !== clip.url) {
        currentClipUrlRef.current = clip.url;
        videoRef.current.src = clip.url;
        videoRef.current.load();
      }
      const sourceTime = clip.start + (snap.currentTime - acc);
      videoRef.current.currentTime = Math.max(clip.start, Math.min(clip.end, sourceTime));
    }
  }, []);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; track: 'video' | 'audio'; trackId?: string; clipId?: string }>(
    { visible: false, x: 0, y: 0, track: 'video' }
  );
  const [showContinueOverlay, setShowContinueOverlay] = useState(false);
  const [isAttemptingPlay, setIsAttemptingPlay] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const audioElsRef = useRef<Record<string, HTMLAudioElement | null>>({});
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineAreaRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const playheadDragStartPctRef = useRef<number>(0);
  const wasPlayingBeforePlayheadDragRef = useRef<boolean>(false);
  const currentClipIndexRef = useRef<number>(0);
  const currentClipUrlRef = useRef<string>('');
  const hasInitialDurationRef = useRef(false);
  const isPlayingRef = useRef(false);
  const pendingSwitchRef = useRef<{ clipIndex: number; sourceTime: number; playAfterLoad?: boolean } | null>(null);
  isPlayingRef.current = isPlaying;
  const isSwitchingRef = useRef(false);
  const tryPlayRetriesRef = useRef(0);
  const audioRafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const [draggingAudio, setDraggingAudio] = useState<null | { clipId: string; fromTrackId: string; duration: number; originalOffset?: number; grabOffset: number }>(null);
  const [dragGhost, setDragGhost] = useState<null | { trackId: string; start: number; duration: number }>(null);
  const SNAP_SECONDS = 1;
  const DISPLAY_STEP = 2; // seconds between displayed thumbnails (visual coverage)
  const BASE_THUMB_STEP = 5; // seconds between generated base thumbnails
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (clips.length > 0 && videoRef.current && !currentClipUrlRef.current) {
      hasInitialDurationRef.current = false;
      currentClipIndexRef.current = 0;
      currentClipUrlRef.current = clips[0].url;
      videoRef.current.src = clips[0].url;
      videoRef.current.load();
    }
    audioTracks.forEach((track) => {
      if (track.clips.length > 0 && track.clips[0].url && !audioElsRef.current[track.id]) {
        const audioEl = new Audio(track.clips[0].url);
        audioEl.preload = 'metadata';
        audioElsRef.current[track.id] = audioEl;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptPlay = useCallback((v: HTMLVideoElement | null, maxRetries = 5) => {
    return new Promise<void>((resolve, reject) => {
      if (!v) return reject();
      tryPlayRetriesRef.current = 0;
      const tryOnce = () => {
        v.play()
          .then(() => {
            setIsPlaying(true);
            tryPlayRetriesRef.current = 0;
            resolve();
          })
          .catch(() => {
            tryPlayRetriesRef.current++;
            if (tryPlayRetriesRef.current <= maxRetries) {
              setTimeout(tryOnce, 200);
            } else {
              tryPlayRetriesRef.current = 0;
              reject(new Error('play-failed'));
            }
          });
      };
      tryOnce();
    });
  }, []);

  const totalDuration = useMemo(
    () => clips.reduce((acc, c) => acc + (c.end - c.start), 0),
    [clips]
  );

  const audioTotal = useMemo(() => {
    // compute per-track timeline end by simulating clip positions (respecting explicit offsets)
    let maxEnd = 0;
    for (const tr of audioTracks) {
      let acc = 0;
      for (const c of tr.clips) {
        const duration = c.end - c.start;
        const start = typeof c.offset === 'number' ? c.offset : acc;
        const end = start + duration;
        acc = Math.max(acc, end);
        if (end > maxEnd) maxEnd = end;
      }
    }
    return maxEnd;
  }, [audioTracks]);

  const timelineDuration = Math.max(totalDuration, audioTotal);

  const startTimes = useMemo(() => {
    const st: number[] = [];
    let t = 0;
    for (const c of clips) {
      st.push(t);
      t += c.end - c.start;
    }
    return st;
  }, [clips]);

  const startTimesRef = useRef<number[]>(startTimes);
  startTimesRef.current = startTimes;

  // compute per-track clip timeline positions (respecting optional offsets)
  const computeTrackPositions = useCallback((clipsForTrack: Clip[]) => {
    const positions: { clip: Clip; start: number; end: number }[] = [];
    let acc = 0;
    for (const c of clipsForTrack) {
      const duration = c.end - c.start;
      const start = typeof c.offset === 'number' ? c.offset : acc;
      const end = start + duration;
      positions.push({ clip: c, start, end });
      acc = Math.max(acc, end);
    }
    return { positions, trackEnd: acc };
  }, []);

  const getClipAtTime = useCallback(
    (t: number): { clipIndex: number; clip: Clip; sourceTime: number } | null => {
      if (clips.length === 0 || t < 0) return null;
      for (let i = 0; i < clips.length; i++) {
        const len = clips[i].end - clips[i].start;
        if (t < startTimes[i] + len) {
          const sourceTime = clips[i].start + (t - startTimes[i]);
          return { clipIndex: i, clip: clips[i], sourceTime };
        }
      }
      const last = clips.length - 1;
      return {
        clipIndex: last,
        clip: clips[last],
        sourceTime: clips[last].end,
      };
    },
    [clips, startTimes]
  );

  const seekToTime = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(timelineDuration, t));
      setCurrentTime(clamped);
      // if we have video clips, map to video; otherwise sync audios only
      if (clips.length === 0) {
        playAllAudioAtTime(clamped, false);
        if (isPlaying) playAllAudioAtTime(clamped, true);
        return;
      }
      const at = getClipAtTime(clamped);
      if (at && videoRef.current) {
        videoFinishedRef.current = false;
        setVideoFinished(false);
        const { clipIndex, clip, sourceTime } = at;
        const video = videoRef.current;
        if (currentClipUrlRef.current !== clip.url) {
          video.src = clip.url;
          currentClipUrlRef.current = clip.url;
          video.load();
          currentClipIndexRef.current = clipIndex;
          video.addEventListener('loadeddata', () => {
            video.currentTime = sourceTime;
          }, { once: true });
        } else {
          video.currentTime = sourceTime;
          currentClipIndexRef.current = clipIndex;
        }
      }
      // sempre sincronizar trilhas de áudio com o tempo buscado (vídeo já foi reposicionado acima)
      playAllAudioAtTimeRef.current?.(clamped, false);
      if (isPlaying) playAllAudioAtTimeRef.current?.(clamped, true);
    },
    [timelineDuration, getClipAtTime, clips, isPlaying]
  );

  useEffect(() => {
    const at = getClipAtTime(currentTime);
    if (!at || !videoRef.current) return;
    const { clipIndex, clip, sourceTime } = at;
    const video = videoRef.current;
    if (currentClipUrlRef.current !== clip.url) {
      video.src = clip.url;
      currentClipUrlRef.current = clip.url;
      video.load();
      currentClipIndexRef.current = clipIndex;
      const onLoaded = () => {
        video.currentTime = sourceTime;
      };
      video.addEventListener('loadeddata', onLoaded, { once: true });
      return () => video.removeEventListener('loadeddata', onLoaded);
    }
    if (Math.abs(video.currentTime - sourceTime) > 0.1) {
      video.currentTime = sourceTime;
      currentClipIndexRef.current = clipIndex;
    }
  }, [currentTime, getClipAtTime]);

  const atForBg = getClipAtTime(currentTime);
  const isBlurBgBand = atForBg?.clip?.filterType != null && BLUR_BG_BAND_TYPES.includes(atForBg.clip.filterType);

  useEffect(() => {
    if (!isBlurBgBand || !videoRef.current || !videoBgRef.current) return;
    const main = videoRef.current;
    const bg = videoBgRef.current;
    if (bg.src !== main.src) {
      bg.src = main.src;
      bg.load();
    }
    if (Math.abs(bg.currentTime - main.currentTime) > 0.2) {
      bg.currentTime = main.currentTime;
    }
    if (!main.paused && bg.paused) bg.play().catch(() => {});
    if (main.paused && !bg.paused) bg.pause();
  }, [isBlurBgBand, currentTime, clips, isPlaying]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current || hasInitialDurationRef.current) return;
    const d = videoRef.current.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    hasInitialDurationRef.current = true;
    setClips((prev) => {
      if (prev.length === 0) return prev;
      // Só atualizar o end do primeiro clip quando há um único clip (vídeo recém-adicionado).
      // Com 2+ clipes (corte ou projeto carregado), start/end já estão corretos — não sobrescrever.
      if (prev.length === 1) {
        const next = [...prev];
        next[0] = { ...next[0], end: d };
        return next;
      }
      return prev;
    });
  };

  const loadVideoFile = useCallback((file: File, serverUrl?: string) => {
    if (!file.type.startsWith('video/') && !file.name.toLowerCase().endsWith('.mp4')) return;
    // salvar estado atual para permitir undo desta ação
    pushHistory();
    const url = URL.createObjectURL(file);
    const clipId = generateId();
    setClips((prev) => {
      const next = [...prev, { id: clipId, url, start: 0, end: 1, name: file.name, serverUrl, filterType: 'none' as FilterType, filterIntensity: 100 }];
      // if this is the first clip, load it into the video element
      if (prev.length === 0 && videoRef.current) {
        hasInitialDurationRef.current = false;
        currentClipIndexRef.current = 0;
        currentClipUrlRef.current = url;
        videoRef.current.src = url;
        videoRef.current.load();
      }
      return next;
    });

    // Create a transient video element to read metadata (duration) without affecting the player
    const tmp = document.createElement('video');
    tmp.preload = 'metadata';
    tmp.src = url;
    const onLoaded = () => {
      const d = tmp.duration || 1;
      setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, end: d } : c)));
      tmp.removeEventListener('loadedmetadata', onLoaded);
    };
    tmp.addEventListener('loadedmetadata', onLoaded);
    onDirty?.();
  }, [onDirty, pushHistory]);

  const addAudioFile = useCallback((file: File, serverUrl?: string) => {
    if (audioTracks.length >= 3) {
      alert('Máximo de 3 trilhas de áudio.');
      return;
    }
    const url = URL.createObjectURL(file);
    const id = generateId();
    const clipId = generateId();
    pushHistory();
    const initialClip: Clip = { id: clipId, url, start: 0, end: Math.max(1, totalDuration || 1), name: file.name, offset: 0, serverUrl };
    const newTrack = { id, name: file.name, clips: [initialClip], muted: false };
    const audioEl = new Audio(url);
    audioEl.preload = 'metadata';
    audioElsRef.current[id] = audioEl;
    const onLoaded = () => {
      const duration = audioEl.duration || initialClip.end;
      setAudioTracks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, clips: [{ ...t.clips[0], end: Math.max(duration, 0.001) }] } : t
        )
      );
      audioEl.removeEventListener('loadedmetadata', onLoaded);
    };
    audioEl.addEventListener('loadedmetadata', onLoaded);
    setAudioTracks((prev) => [...prev, newTrack]);
    setSelectedTrack(id);
  }, [audioTracks.length, totalDuration, pushHistory]);

  useImperativeHandle(ref, () => ({
    getProjectData: () => {
      const clean = (obj: Record<string, unknown>) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) out[k] = v;
        }
        return out;
      };
      const isBlobUrl = (u: string) => u.startsWith('blob:');
      const serializeClip = (c: Clip) => {
        const resolvedUrl = c.serverUrl || (isBlobUrl(c.url) ? '' : c.url) || '';
        return clean({
          id: c.id,
          url: resolvedUrl,
          start: c.start,
          end: c.end,
          name: c.name || '',
          offset: c.offset ?? 0,
          serverUrl: c.serverUrl || '',
          muted: c.muted ?? false,
          filterType: c.filterType || 'none',
          filterIntensity: typeof c.filterIntensity === 'number' ? c.filterIntensity : 100,
          captionStyle: c.captionStyle || 'none',
          captionText: c.captionText || '',
          captionSegments: Array.isArray(c.captionSegments) ? c.captionSegments : [],
        });
      };
      const currentClips = clipsRef.current;
      const currentTracks = audioTracksRef.current;
      return {
        clips: currentClips.map(serializeClip),
        audioTracks: currentTracks.map((t) => clean({
          id: t.id,
          name: t.name || '',
          muted: t.muted ?? false,
          clips: t.clips.map(serializeClip),
        })),
        filterType: filterType || 'none',
        filterIntensity: filterIntensity ?? 100,
      } as ProjectData;
    },
    loadProjectData: (data: ProjectData) => {
      const loadedClips = (data.clips || []).map((c) => ({
        ...c,
        url: c.serverUrl || c.url || '',
        filterType: (c as any).filterType ?? (data.filterType as FilterType) ?? 'none',
        filterIntensity: typeof (c as any).filterIntensity === 'number' ? (c as any).filterIntensity : (typeof data.filterIntensity === 'number' ? data.filterIntensity : 100),
        captionStyle: (c as any).captionStyle ?? 'none',
        captionText: (c as any).captionText ?? '',
        captionSegments: Array.isArray((c as any).captionSegments) ? (c as any).captionSegments : [],
      }));
      setClips(loadedClips);
      const loadedTracks = (data.audioTracks || []).map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, url: c.serverUrl || c.url || '' })),
      }));
      setAudioTracks(loadedTracks);
      // project-level defaults still kept but per-clip filters preferred
      if (data.filterType) setFilterType(data.filterType as FilterType);
      if (typeof data.filterIntensity === 'number') setFilterIntensity(data.filterIntensity);
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedClip({ track: null });
      setSelectedTrack('video');
      historyRef.current = [];
      if (loadedClips.length > 0 && videoRef.current) {
        hasInitialDurationRef.current = false;
        currentClipIndexRef.current = 0;
        currentClipUrlRef.current = loadedClips[0].url;
        videoRef.current.src = loadedClips[0].url;
        videoRef.current.load();
      }
      loadedTracks.forEach((track) => {
        if (track.clips.length > 0 && track.clips[0].url) {
          const audioEl = new Audio(track.clips[0].url);
          audioEl.preload = 'metadata';
          audioElsRef.current[track.id] = audioEl;
        }
      });
    },
    addVideoFile: loadVideoFile,
    addAudioFile,
    hasVideo: () => clipsRef.current.length > 0,
  }), [clips, audioTracks, filterType, filterIntensity, loadVideoFile, addAudioFile]);

  // Generate base thumbnails for video clips (data URLs) — one per BASE_THUMB_STEP (5s)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const MAX_THUMBS = 200; // guard cap (shouldn't hit)
      const BASE_THUMB_STEP = 5; // create one base thumbnail every 5 seconds
      for (const clip of clips) {
        if (!mounted) break;
        if (thumbnails[clip.id]) continue;
        try {
          const tmp = document.createElement('video');
          tmp.preload = 'metadata';
          tmp.src = clip.url;
          // only set crossOrigin for remote URLs (object URLs don't need it and may cause issues)
          try {
            if (typeof clip.url === 'string' && (clip.url.startsWith('http://') || clip.url.startsWith('https://'))) {
              tmp.crossOrigin = 'anonymous';
            } else {
              tmp.removeAttribute('crossOrigin');
            }
          } catch {}
          await new Promise<void>((res, rej) => {
            const onErr = () => rej(new Error('video load failed'));
            tmp.addEventListener('loadedmetadata', () => res(), { once: true });
            tmp.addEventListener('error', onErr, { once: true });
          });
          const duration = Math.max(0.001, clip.end - clip.start);
          // generate base thumbs at BASE_THUMB_STEP intervals across clip
          const baseCount = Math.max(1, Math.ceil(duration / BASE_THUMB_STEP));
          const imgs: string[] = [];
          const w = Math.min(160, tmp.videoWidth || 160);
          const h = Math.min(90, tmp.videoHeight || 90);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          for (let i = 0; i < baseCount; i++) {
            if (!mounted) break;
            const seekTime = Math.min(clip.start + i * BASE_THUMB_STEP, clip.end - 0.05);
            await new Promise<void>((res) => {
              const onSeek = () => res();
              tmp.currentTime = seekTime;
              tmp.addEventListener('seeked', onSeek, { once: true });
            });
            // small delay to allow decoder to settle (improves seek reliability)
            await new Promise((r) => setTimeout(r, 250));
            try {
              if (ctx) {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(tmp, 0, 0, w, h);
                imgs.push(c.toDataURL('image/jpeg', 0.7));
              }
            } catch {
              // ignore draw errors (CORS, etc.)
            }
            if (imgs.length >= MAX_THUMBS) break;
          }
          if (mounted) {
            if (imgs.length > 0) {
              setThumbnails((t) => ({ ...t, [clip.id]: imgs }));
            } else {
              // try one fallback capture at clip.start + 0.5s
              try {
                const fallbackTime = Math.min(clip.start + 0.5, clip.end - 0.05);
                await new Promise<void>((res) => {
                  const onSeek = () => res();
                  tmp.currentTime = fallbackTime;
                  tmp.addEventListener('seeked', onSeek, { once: true });
                });
                await new Promise((r) => setTimeout(r, 300));
                if (ctx) {
                  ctx.clearRect(0, 0, w, h);
                  ctx.drawImage(tmp, 0, 0, w, h);
                  const data = c.toDataURL('image/jpeg', 0.7);
                  setThumbnails((t) => ({ ...t, [clip.id]: [data] }));
                }
              } catch (err) {
                // still failed — don't set empty array, leave undefined
                // log for debugging
                // console.warn('thumbnail generation failed for clip', clip.id, err);
              }
            }
          }
        } catch {
          // ignore per-clip failures
        }
      }
    })();
    return () => { mounted = false; };
    // only regenerate when clips change
  }, [clips]);

  // timeline-wide frames removed; thumbnails rendered per-clip in front

  // Ensure audio element exists for track id
  const ensureAudioElement = useCallback((trackId: string, url: string) => {
    if (!audioElsRef.current[trackId]) {
      const audio = new Audio(url);
      audio.preload = 'metadata';
      audioElsRef.current[trackId] = audio;
      audio.addEventListener('error', () => {
        // ignore
      });
    } else {
      const existing = audioElsRef.current[trackId]!;
      if (existing.src !== url) {
        existing.src = url;
      }
    }
  }, []);

  // sync a single audio track to timeline time t
  const syncAudioTrackToTime = useCallback((trackId: string, t: number) => {
    const track = audioTracks.find((tr) => tr.id === trackId);
    if (!track) return false;
    // compute clip positions for this track
    const { positions } = computeTrackPositions(track.clips);
    // find clip covering timeline time t
    const pos = positions.find((p) => t >= p.start && t < p.end);
    if (!pos) {
      // pause any existing audio element for this track
      const maybeEl = audioElsRef.current[trackId];
      if (maybeEl) {
        try { maybeEl.pause(); } catch {}
      }
      return false;
    }
    const clip = pos.clip;
    const sourceTime = clip.start + Math.max(0, t - pos.start);
    let audioEl = audioElsRef.current[trackId];
    if (!audioEl) {
      audioEl = new Audio(clip.url);
      audioEl.preload = 'metadata';
      audioElsRef.current[trackId] = audioEl;
    }
    if (audioEl.src !== clip.url) {
      audioEl.src = clip.url;
    }
    const applyTime = () => {
      try {
        const target = Math.max(0, Math.min(audioEl!.duration || Infinity, sourceTime));
        if (Math.abs(audioEl!.currentTime - target) > 0.3) {
          audioEl!.currentTime = target;
        }
      } catch {
        // ignore
      }
    };
    if (isFinite(audioEl.duration) && audioEl.duration > 0) {
      applyTime();
    } else {
      const onloaded = () => {
        applyTime();
        audioEl!.removeEventListener('loadedmetadata', onloaded);
      };
      audioEl.addEventListener('loadedmetadata', onloaded);
    }
    return true;
  }, [audioTracks, computeTrackPositions]);

  // play or pause all audio tracks according to isPlaying
  const playAllAudioAtTime = useCallback((t: number, play: boolean) => {
    for (const track of audioTracks) {
      const hasClip = syncAudioTrackToTime(track.id, t);
      const audioEl = audioElsRef.current[track.id];
      if (!audioEl) continue;
      const { positions } = computeTrackPositions(track.clips);
      const activeClip = positions.find((p) => t >= p.start && t < p.end)?.clip;
      const clipMuted = !!activeClip?.muted;
      audioEl.muted = clipMuted;
      if (play && hasClip && !clipMuted) {
        audioEl.play().catch(() => {});
      } else {
        audioEl.pause();
      }
    }
  }, [audioTracks, syncAudioTrackToTime, computeTrackPositions]);

  playAllAudioAtTimeRef.current = playAllAudioAtTime;

  const syncAudioMuteState = useCallback((t: number) => {
    for (const track of audioTracks) {
      const audioEl = audioElsRef.current[track.id];
      if (!audioEl) continue;
      const { positions } = computeTrackPositions(track.clips);
      const activeClip = positions.find((p) => t >= p.start && t < p.end)?.clip;
      if (activeClip) {
        audioEl.muted = !!activeClip.muted;
        if (activeClip.muted && !audioEl.paused) {
          audioEl.pause();
        } else if (!activeClip.muted && audioEl.paused && isPlayingRef.current) {
          audioEl.play().catch(() => {});
        }
      }
    }
  }, [audioTracks, computeTrackPositions]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4'))) {
      loadVideoFile(file);
    }
  };

  const handleExport = useCallback(() => {
    if (clips.length === 0) {
      alert('Nenhum vídeo adicionado.');
      return;
    }
    if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    setExportModalOpen(true);
    setExportPhase('loading');

    (async () => {
      try {
        // 1) Se todos os vídeos são do servidor (http), exportar direto no servidor com ffmpeg — evita gravação no navegador que falha
        // (ao adicionar por upload, o clip tem url=blob e serverUrl=http; usamos serverUrl quando existir)
        const clipUrlForExport = (c: Clip) => (c.serverUrl || c.url || '') as string;
        const allFromServer = clips.every((c) => {
          const u = clipUrlForExport(c);
          return typeof u === 'string' && u.length > 0 && (u.startsWith('http://') || u.startsWith('https://'));
        });
        if (allFromServer) {
          try {
            const exportClips = clips.map((c) => ({
              url: clipUrlForExport(c),
              start: c.start,
              end: c.end,
              filterType: (c.filterType ?? 'none') as string,
              filterIntensity: typeof c.filterIntensity === 'number' ? c.filterIntensity : 100,
              muted: !!c.muted,
              captionText: c.captionText ?? '',
              captionStyle: (c.captionStyle ?? 'none') as string,
              captionSegments: Array.isArray(c.captionSegments) ? c.captionSegments : [],
            }));
            const exportAudioTracks = audioTracks.map((tr) => {
              const { positions } = computeTrackPositions(tr.clips);
              return {
                muted: !!tr.muted,
                clips: positions
                  .map((p) => ({
                    url: clipUrlForExport(p.clip),
                    start: p.clip.start,
                    end: p.clip.end,
                    offset: p.start,
                    muted: !!p.clip.muted,
                  }))
                  .filter((c) => typeof c.url === 'string' && c.url.length > 0 && (c.url.startsWith('http://') || c.url.startsWith('https://'))),
              };
            });
            const result = await exportVideoOnServer(exportClips, exportAudioTracks);
            let downloadUrl = result.url;
            if (typeof window !== 'undefined' && (window.location.hostname === 'vdyou.com' || window.location.hostname === 'www.vdyou.com')) {
              downloadUrl = downloadUrl.replace(/^http:\/\//i, 'https://');
              if (downloadUrl.includes('/files/') && !downloadUrl.includes('/api/files/')) {
                downloadUrl = downloadUrl.replace(/(https?:\/\/[^/]+)\/files\//, '$1/api/files/');
              }
            }
            const res = await fetch(downloadUrl);
            if (!res.ok) throw new Error(`Servidor retornou ${res.status}`);
            const mp4Blob = await res.blob();
            if (mp4Blob.size > 0) {
              const url = URL.createObjectURL(mp4Blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'vdyou-export.mp4';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              setExportPhase('done');
              exportTimeoutRef.current = null;
              return;
            }
          } catch (err: any) {
            setExportPhase('done');
            exportTimeoutRef.current = null;
            const msg = err?.message || String(err);
            alert('Exportação no servidor falhou: ' + msg + '\n\nVerifique: 1) Servidor rodando (npm run dev no server ou Docker). 2) ffmpeg instalado no servidor. 3) Vídeos adicionados por upload (não por link externo).');
            return;
          }
        }

        if (!('MediaRecorder' in window) || timelineDuration <= 0) {
          // fallback simulated export
          exportTimeoutRef.current = setTimeout(() => {
            setExportPhase('done');
            const cutTimes = clips.map((c, i) => ({
              clipIndex: i + 1,
              start: c.start.toFixed(2),
              end: c.end.toFixed(2),
              duration: (c.end - c.start).toFixed(2),
            }));
            console.log('[vdyou Export] Tempos de corte:', cutTimes);
            exportTimeoutRef.current = null;
          }, 1500);
          return;
        }

        // prepare canvas & video element for rendering
        const width = (videoRef.current?.videoWidth && videoRef.current?.videoHeight) ? videoRef.current.videoWidth : 1280;
        const height = (videoRef.current?.videoHeight && videoRef.current?.videoWidth) ? videoRef.current.videoHeight : 720;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        const exportVideo = document.createElement('video');
        exportVideo.muted = true;
        exportVideo.playsInline = true;
        exportVideo.style.display = 'none';
        document.body.appendChild(exportVideo);
        const setExportVideoSrc = (url: string) => {
          if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            exportVideo.crossOrigin = 'anonymous';
          } else {
            exportVideo.removeAttribute('crossOrigin');
          }
          exportVideo.src = url;
        };

        // prepare audio mixing via AudioContext + MediaStreamDestination
        const AudioCtx = window.OfflineAudioContext ? window.AudioContext || (window as any).webkitAudioContext : window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new (AudioCtx)();
        const dest = audioCtx.createMediaStreamDestination();

        // helper to load and decode audio buffers
        const decodeAudioBuffer = async (url: string) => {
          const res = await fetch(url);
          const ab = await res.arrayBuffer();
          return await audioCtx.decodeAudioData(ab);
        };

        // schedule audio buffers for all tracks based on computed positions
        const scheduledSources: AudioBufferSourceNode[] = [];
        for (const tr of audioTracks) {
          const { positions } = computeTrackPositions(tr.clips);
          for (const p of positions) {
            try {
              const buffer = await decodeAudioBuffer(p.clip.url);
              const src = audioCtx.createBufferSource();
              src.buffer = buffer;
              src.connect(dest);
              // schedule to start at audioCtx.currentTime + p.start
              src.start(audioCtx.currentTime + p.start, p.clip.start);
              scheduledSources.push(src);
            } catch (err) {
              console.warn('Failed to decode audio buffer for export', err);
            }
          }
        }

        // capture audio stream
        const audioStream = dest.stream;

        // capture video frames from exportVideo
        const videoStream = (canvas as HTMLCanvasElement).captureStream(30);

        // combine streams
        const combined = new MediaStream();
        for (const t of videoStream.getVideoTracks()) combined.addTrack(t);
        for (const t of audioStream.getAudioTracks()) combined.addTrack(t);

        // prepare MediaRecorder (fallback MIME se codec não suportado)
        const mimePreferred = 'video/webm;codecs=vp8,opus';
        const mime = MediaRecorder.isTypeSupported(mimePreferred) ? mimePreferred : 'video/webm';
        const recorder = new MediaRecorder(combined, { mimeType: mime });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };

        const startRecording = () => new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            resolve(blob);
          };
          recorder.onerror = (ev) => reject(ev);
          recorder.start(100);
        });

        // drawing loop
        let currentClipIndex = 0;
        const startTimesLocal = startTimes;

        const playNextClip = () => {
          if (currentClipIndex >= clips.length) return;
          const clip = clips[currentClipIndex];
          setExportVideoSrc(clip.url);
          exportVideo.load();
          exportVideo.addEventListener('loadeddata', function onLoad() {
            exportVideo.currentTime = clip.start;
            exportVideo.play().catch(() => {});
            exportVideo.removeEventListener('loadeddata', onLoad);
          }, { once: true });
        };

        let exporting = true;
        const rafLoop = () => {
          if (!exporting) return;
          try {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            if (!exportVideo.paused && exportVideo.readyState >= 2) {
              // apply per-clip filter (if any) when drawing to canvas so exported video includes effects
              const clipForFilter = clips[Math.max(0, Math.min(clips.length - 1, currentClipIndex))] || clips[0];
              const fType = (clipForFilter as any)?.filterType ?? filterType;
              const fIntensity = typeof (clipForFilter as any)?.filterIntensity === 'number' ? (clipForFilter as any).filterIntensity : filterIntensity;
              try {
                ctx.filter = buildFilter(fType as FilterType, fIntensity);
              } catch {
                ctx.filter = 'none';
              }
              ctx.drawImage(exportVideo, 0, 0, width, height);
              ctx.filter = 'none';
            }
          } catch {}
          requestAnimationFrame(rafLoop);
        };

        // start audio context (resume)
        if (audioCtx.state === 'suspended' && audioCtx.resume) await audioCtx.resume();

        // Iniciar gravação imediatamente (como antes); canvas desenha preto até o vídeo carregar, depois frames reais
        const recordingPromise = startRecording();
        rafLoop();
        playNextClip();

        const onTime = () => {
          const clip = clips[currentClipIndex];
          if (!clip) return;
          if (exportVideo.currentTime >= clip.end - 0.05) {
            exportVideo.pause();
            currentClipIndex++;
            if (currentClipIndex < clips.length) {
              const next = clips[currentClipIndex];
              setExportVideoSrc(next.url);
              exportVideo.load();
              exportVideo.addEventListener('loadeddata', function onL() {
                exportVideo.currentTime = next.start;
                exportVideo.play().catch(() => {});
                exportVideo.removeEventListener('loadeddata', onL);
              }, { once: true });
            } else {
              exporting = false;
              exportVideo.pause();
            }
          }
        };
        exportVideo.addEventListener('timeupdate', onTime);

        // stop recording when timeline duration reached (safety); mínimo 2s para o MediaRecorder gerar dados
        const recordDurationMs = Math.max(2000, Math.ceil(timelineDuration * 1000) + 500);
        setTimeout(() => {
          exporting = false;
          try { exportVideo.pause(); } catch {}
          try {
            for (const s of scheduledSources) s.stop();
          } catch {}
          try {
            if ('requestData' in recorder && typeof recorder.requestData === 'function') recorder.requestData();
          } catch {}
          recorder.stop();
        }, recordDurationMs);

        const blob = await recordingPromise;

        if (!blob || blob.size === 0) {
          exportVideo.removeEventListener('timeupdate', onTime);
          try { document.body.contains(exportVideo) && document.body.removeChild(exportVideo); } catch {}
          try { audioCtx.close(); } catch {}

          // Fallback: exportar no servidor com ffmpeg (trim + concat) — gera MP4 direto
          const canUseServer = clips.every((c) => typeof c.url === 'string' && (c.url.startsWith('http://') || c.url.startsWith('https://')));
          if (canUseServer) {
            try {
              const result = await exportVideoOnServer(clips.map((c) => ({ url: c.url, start: c.start, end: c.end })));
              const res = await fetch(result.url);
              const mp4Blob = await res.blob();
              if (mp4Blob.size > 0) {
                const url = URL.createObjectURL(mp4Blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vdyou-export.mp4';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setExportPhase('done');
                exportTimeoutRef.current = null;
                return;
              }
            } catch (err) {
              console.warn('Export no servidor falhou:', err);
            }
          }

          setExportPhase('done');
          exportTimeoutRef.current = null;
          alert('A gravação no navegador não gerou dados. Foi usada a exportação no servidor quando possível; se os vídeos forem do servidor (http), o MP4 deve ter sido baixado. Caso contrário, verifique se o servidor está rodando e se os vídeos foram enviados por upload.');
          return;
        }

        // cleanup
        exportVideo.removeEventListener('timeupdate', onTime);
        document.body.removeChild(exportVideo);
        try { audioCtx.close(); } catch {}

        // Try to transcode to MP4 using ffmpeg.wasm on the client; fallback to WebM download
        try {
          // dynamic import may expose different shapes depending on bundler/runtime.
          let createFFmpegFn: any = null;
          let fetchFileFn: any = null;

          try {
            const ffmpegModule: any = await import('@ffmpeg/ffmpeg');
            createFFmpegFn = ffmpegModule.createFFmpeg || (ffmpegModule.default && ffmpegModule.default.createFFmpeg);
            fetchFileFn = ffmpegModule.fetchFile || (ffmpegModule.default && ffmpegModule.default.fetchFile);
          } catch {
            // import failed; will use server-side conversion below
          }

          if (typeof createFFmpegFn !== 'function' || typeof fetchFileFn !== 'function') {
            throw new Error('ffmpeg-wasm-unavailable');
          }

          // point corePath to CDN so the wasm core can be fetched when running in browser
          const ffmpeg = createFFmpegFn({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
          });
          if (!ffmpeg.isLoaded()) await ffmpeg.load();
          const webmName = 'out.webm';
          const mp4Name = 'out.mp4';
          // write webm to FFmpeg FS
          ffmpeg.FS('writeFile', webmName, await fetchFileFn(blob));
          // run conversion (fast preset for speed) with flags to improve MP4 compatibility
          // -fflags +genpts helps with timestamp issues; -movflags faststart enables progressive playback
          await ffmpeg.run(
            '-fflags', '+genpts',
            '-i', webmName,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-movflags', 'faststart',
            '-c:a', 'aac',
            '-b:a', '192k',
            mp4Name
          );
          const data = ffmpeg.FS('readFile', mp4Name);
          const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
          try {
            await uploadFile(new File([mp4Blob], 'vdyou-export.mp4', { type: 'video/mp4' }));
          } catch (err) {
            // upload opcional; download segue com blob
          }
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'vdyou-export.mp4';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          } catch {
            // ffmpeg.wasm indisponível: converte no servidor (POST /convert) ou baixa WebM
            let downloadBlob: Blob = blob;
            let downloadName = 'vdyou-export.webm';
            const webmFile = new File([blob], 'vdyou-export.webm', { type: 'video/webm' });
            try {
              const converted = await convertWebmToMp4(webmFile);
              const res = await fetch(converted.url);
              downloadBlob = await res.blob();
              downloadName = 'vdyou-export.mp4';
            } catch (err2) {
              try {
                await uploadFile(webmFile);
              } catch (err3) {
                // ignore
              }
            }
            const url = URL.createObjectURL(downloadBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }

        setExportPhase('done');
        exportTimeoutRef.current = null;
      } catch (err) {
        console.error('Export failed', err);
        setExportPhase('done');
        exportTimeoutRef.current = null;
      }
    })();
  }, [clips, audioTracks, timelineDuration, startTimes, computeTrackPositions]);

  const closeExportModal = () => {
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
      exportTimeoutRef.current = null;
    }
    setExportModalOpen(false);
    setExportPhase('idle');
  };

  const performSwitchToNextClip = useCallback(() => {
    const video = videoRef.current;
    if (!video || isSwitchingRef.current) return;
    const i = currentClipIndexRef.current;
    const clipsArr = clipsRef.current;
    const startTimesArr = startTimesRef.current;
    if (i >= clipsArr.length || !startTimesArr?.length) return;
    const clip = clipsArr[i];
    const len = clip.end - clip.start;
    if (i + 1 < clipsArr.length) {
      const next = clipsArr[i + 1];
      const wasPlayingNow = !video.paused && !video.ended;
      if (currentClipUrlRef.current !== next.url) {
        isSwitchingRef.current = true;
        pendingSwitchRef.current = { clipIndex: i + 1, sourceTime: next.start, playAfterLoad: wasPlayingNow };
        video.src = next.url;
        currentClipUrlRef.current = next.url;
        video.load();
      } else {
        video.currentTime = next.start;
        currentClipIndexRef.current = i + 1;
        if (wasPlayingNow) {
          attemptPlay(video).catch(() => {
            setShowContinueOverlay(true);
            try { playAllAudioAtTime(startTimesArr[i + 1], true); } catch {}
          });
        }
      }
      setCurrentTime(startTimesArr[i + 1]);
    } else {
      setCurrentTime(startTimesArr[i] + len);
    }
  }, [attemptPlay, playAllAudioAtTime]);

  const clipSwitchRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || clips.length <= 1) return;
    const video = videoRef.current;
    if (!video) return;
    const loop = () => {
      if (isSwitchingRef.current) {
        clipSwitchRafRef.current = requestAnimationFrame(loop);
        return;
      }
      const i = currentClipIndexRef.current;
      const clipsArr = clipsRef.current;
      if (i >= clipsArr.length - 1) {
        clipSwitchRafRef.current = requestAnimationFrame(loop);
        return;
      }
      const clip = clipsArr[i];
      const ct = video.currentTime;
      if (ct >= clip.end - 0.15 && ct >= clip.end - 0.001) {
        performSwitchToNextClip();
      }
      clipSwitchRafRef.current = requestAnimationFrame(loop);
    };
    clipSwitchRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (clipSwitchRafRef.current != null) cancelAnimationFrame(clipSwitchRafRef.current);
      clipSwitchRafRef.current = null;
    };
  }, [isPlaying, clips.length, performSwitchToNextClip]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || clips.length === 0) return;
    if (isSwitchingRef.current) return;
    const i = currentClipIndexRef.current;
    if (i >= clips.length) return;
    const clip = clips[i];
    video.muted = !!clip.muted;
    if (video.currentTime >= clip.end - 0.001) {
      performSwitchToNextClip();
      return;
    }
    const timelineT = startTimes[i] + (video.currentTime - clip.start);
    setCurrentTime(timelineT);
    syncAudioMuteState(timelineT);
    // Sincronizar trilhas de áudio com o tempo atual: pausar em vãos, tocar no bloco correto
    playAllAudioAtTimeRef.current?.(timelineT, !video.paused);
  };

  const handleLoadedData = () => {
    const video = videoRef.current;
    const pending = pendingSwitchRef.current;
    if (video && pending) {
      video.currentTime = pending.sourceTime;
      currentClipIndexRef.current = pending.clipIndex;
      const newTimelineTime = startTimesRef.current[pending.clipIndex] ?? 0;
      setCurrentTime(newTimelineTime);
      const playAfter = !!pending.playAfterLoad;
      pendingSwitchRef.current = null;
      if (playAfter) {
        attemptPlay(video).catch(() => {
          setShowContinueOverlay(true);
          try { playAllAudioAtTime(newTimelineTime, true); } catch {}
        });
      }
      try { if (playAfter) playAllAudioAtTime(newTimelineTime, true); } catch {}
      isSwitchingRef.current = false;
    }
  };

  const [videoFinished, setVideoFinished] = useState(false);
  const videoFinishedRef = useRef(false);

  const handleEnded = () => {
    const i = currentClipIndexRef.current;
    if (i + 1 < clips.length) return;
    const videoEnd = startTimes[clips.length - 1] + (clips[clips.length - 1].end - clips[clips.length - 1].start);
    if (videoEnd < timelineDuration) {
      // Video finished but timeline still has audio: keep overall playback active
      videoFinishedRef.current = true;
      setVideoFinished(true);
      // Ensure audio playback and RAF continue
      setIsPlaying(true);
      try {
        playAllAudioAtTime(currentTime, true);
      } catch {
        // ignore
      }
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    const v = videoRef.current;
    // If currently playing -> pause all media
    if (isPlaying) {
      if (v && v.src) {
        try { v.pause(); } catch {}
      }
      setIsPlaying(false);
      playAllAudioAtTime(currentTime, false);
      return;
    }

    // Check if playhead is past the end of all video clips
    const videoEnd = clips.length > 0
      ? startTimes[clips.length - 1] + (clips[clips.length - 1].end - clips[clips.length - 1].start)
      : 0;

    if (clips.length > 0 && v && currentTime < videoEnd) {
      videoFinishedRef.current = false;
      setVideoFinished(false);
      attemptPlay(v)
        .then(() => {
          setIsPlaying(true);
          playAllAudioAtTime(currentTime, true);
        })
      .catch(() => {
          setShowContinueOverlay(true);
          try { playAllAudioAtTime(currentTime, true); } catch {}
        });
      return;
    }

    // Video ended but audio continues, or audio-only playback
    if (audioTracks.length > 0 && currentTime < timelineDuration) {
      if (clips.length > 0) { videoFinishedRef.current = true; setVideoFinished(true); }
      setIsPlaying(true);
      playAllAudioAtTime(currentTime, true);
      return;
    }

    // Fallback: try video play
    if (clips.length > 0 && v) {
      videoFinishedRef.current = false;
      setVideoFinished(false);
      attemptPlay(v)
        .then(() => {
          setIsPlaying(true);
          playAllAudioAtTime(currentTime, true);
        })
        .catch(() => {
          setIsPlaying(false);
          setShowContinueOverlay(true);
        });
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => {
    if (videoFinishedRef.current) return;
    setIsPlaying(false);
  };

  const currentTimeRef2 = useRef(currentTime);
  currentTimeRef2.current = currentTime;

  useEffect(() => {
    if (isPlaying) {
      playAllAudioAtTime(currentTimeRef2.current, true);
    } else {
      playAllAudioAtTime(currentTimeRef2.current, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // When video has no source OR video finished but audio continues, advance playhead via RAF
  useEffect(() => {
    if (!isPlaying) {
      if (audioRafRef.current) {
        cancelAnimationFrame(audioRafRef.current);
        audioRafRef.current = null;
      }
      lastTickRef.current = null;
      if (videoFinished) { videoFinishedRef.current = false; setVideoFinished(false); }
      return;
    }

    const v = videoRef.current;
    // consider video still playing only if it has a source, is not in the 'finished' state,
    // and is actually playing (not paused). If video is paused (e.g. autoplay blocked),
    // fall back to RAF so the playhead and audios continue.
    const videoStillPlaying = v && v.src && !videoFinished && !v.paused;
    if (videoStillPlaying) return;
    if (timelineDuration <= 0) return;

    lastTickRef.current = performance.now();
    const loop = (t: number) => {
      const last = lastTickRef.current ?? t;
      const dt = Math.max(0, (t - last) / 1000);
      lastTickRef.current = t;
      setCurrentTime((c) => {
        const next = Math.min(timelineDuration, c + dt);
        if (next >= timelineDuration) {
          setTimeout(() => {
            setIsPlaying(false);
            videoFinishedRef.current = false;
            setVideoFinished(false);
            playAllAudioAtTime(next, false);
          }, 0);
        } else {
          syncAudioMuteState(next);
          playAllAudioAtTimeRef.current?.(next, true);
        }
        return next;
      });
      audioRafRef.current = requestAnimationFrame(loop);
    };
    audioRafRef.current = requestAnimationFrame(loop);

    return () => {
      if (audioRafRef.current) {
        cancelAnimationFrame(audioRafRef.current);
        audioRafRef.current = null;
      }
      lastTickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, clips.length, timelineDuration, videoFinished]);

  const handleSplit = useCallback(() => {
    if (clips.length === 0 || timelineDuration <= 0) return;
    pushHistory();
    const t = Math.max(0, Math.min(timelineDuration, currentTime));
    const at = getClipAtTime(t);
    if (!at) return;
    const { clipIndex, clip, sourceTime } = at;
    const len = clip.end - clip.start;
    const offset = sourceTime - clip.start;
    if (offset <= 0.01 || offset >= len - 0.01) return;
    const newClips = [...clips];
    const left: Clip = { ...clip, id: generateId(), end: sourceTime };
    const right: Clip = { ...clip, id: generateId(), start: sourceTime };
    newClips.splice(clipIndex, 1, left, right);
    setClips(newClips);
    setCurrentTime(t);
    currentClipIndexRef.current = clipIndex + 1;
    if (videoRef.current) {
      videoRef.current.currentTime = sourceTime;
    }
  }, [clips, currentTime, totalDuration, timelineDuration, getClipAtTime, pushHistory]);
 
  // Split for a specific audio track (by track id)
  const splitAudioTrack = useCallback((trackId: string) => {
    if (timelineDuration <= 0) return;
    pushHistory();
    setAudioTracks((prev) => {
      const idx = prev.findIndex((tr) => tr.id === trackId);
      if (idx === -1) return prev;
      const track = prev[idx];
      const t = Math.max(0, Math.min(timelineDuration, currentTime));
      // compute startTimes for this track
      const st: number[] = [];
      let acc = 0;
      for (const c of track.clips) {
        st.push(acc);
        acc += c.end - c.start;
      }
      // find clip containing t
      let clipIndex = -1;
      for (let i = 0; i < track.clips.length; i++) {
        const len = track.clips[i].end - track.clips[i].start;
        if (t < st[i] + len) {
          clipIndex = i;
          break;
        }
      }
      if (clipIndex === -1) return prev;
      const clip = track.clips[clipIndex];
      const sourceTime = clip.start + (t - st[clipIndex]);
      const offset = sourceTime - clip.start;
      if (offset <= 0.01 || offset >= (clip.end - clip.start) - 0.01) return prev;
      const left: Clip = { ...clip, id: generateId(), end: sourceTime };
      const right: Clip = { ...clip, id: generateId(), start: sourceTime };
      const newClips = [...track.clips];
      newClips.splice(clipIndex, 1, left, right);
      const next = [...prev];
      next[idx] = { ...track, clips: newClips };
      return next;
    });
  }, [currentTime, timelineDuration, pushHistory]);

  // Split a specific video clip by id at current playhead position (if inside the clip)
  const splitSpecificVideoClip = useCallback((clipId: string) => {
    if (!clipId || timelineDuration <= 0) return;
    const idx = clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return;
    const clip = clips[idx];
    const clipStartTimeline = startTimes[idx];
    const clipEndTimeline = clipStartTimeline + (clip.end - clip.start);
    const t = Math.max(0, Math.min(timelineDuration, currentTime));
    if (t <= clipStartTimeline + 0.001 || t >= clipEndTimeline - 0.001) return;
    const sourceTime = clip.start + (t - clipStartTimeline);
    const left: Clip = { ...clip, id: generateId(), end: sourceTime };
    const right: Clip = { ...clip, id: generateId(), start: sourceTime };
    const next = [...clips];
    next.splice(idx, 1, left, right);
    setClips(next);
    setCurrentTime(t);
    currentClipIndexRef.current = idx + 1;
    if (videoRef.current) videoRef.current.currentTime = sourceTime;
  }, [clips, currentTime, timelineDuration, startTimes]);

  // Split a specific audio clip (by track id and clip id) at current playhead if within clip
  const splitSpecificAudioClip = useCallback((trackId: string | undefined, clipId: string) => {
    if (!trackId || !clipId || timelineDuration <= 0) return;
    setAudioTracks((prev) => {
      const tIdx = prev.findIndex((t) => t.id === trackId);
      if (tIdx === -1) return prev;
      const track = prev[tIdx];
      const { positions } = computeTrackPositions(track.clips);
      const posIdx = positions.findIndex((p) => p.clip.id === clipId);
      if (posIdx === -1) return prev;
      const pos = positions[posIdx];
      const t = Math.max(0, Math.min(timelineDuration, currentTime));
      if (t <= pos.start + 0.001 || t >= pos.end - 0.001) return prev;
      const sourceTime = pos.clip.start + (t - pos.start);
      const left: Clip = { ...pos.clip, id: generateId(), end: sourceTime, offset: pos.start };
      const right: Clip = { ...pos.clip, id: generateId(), start: sourceTime, offset: pos.start + (sourceTime - pos.clip.start) };
      const newClips = [...track.clips];
      const origIdx = newClips.findIndex((c) => c.id === clipId);
      if (origIdx === -1) return prev;
      newClips.splice(origIdx, 1, left, right);
      const next = [...prev];
      next[tIdx] = { ...track, clips: newClips };
      return next;
    });
  }, [computeTrackPositions, currentTime, timelineDuration]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        // só cortar se houver um bloco selecionado
        if (selectedClip && selectedClip.track === 'video' && selectedClip.clipId) {
          splitSpecificVideoClip(selectedClip.clipId);
        } else if (selectedClip && selectedClip.track === 'audio' && selectedClip.clipId) {
          splitSpecificAudioClip(selectedClip.trackId, selectedClip.clipId);
        } else {
          alert('Selecione um bloco de vídeo ou áudio para cortar.');
        }
      }
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedClip, splitSpecificVideoClip, splitSpecificAudioClip, undo]);

  // Usar sempre timelineRef para o rect (mesma referência para ruler e timeline) e ler no momento do clique,
  // para não perder a posição após restaurar/maximizar a janela (layout muda).
  const getTimeFromClientX = useCallback((clientX: number) => {
    if (!timelineRef.current || timelineDuration <= 0) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return pct * timelineDuration;
  }, [timelineDuration]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || timelineDuration <= 0) return;
    if ((e.target as HTMLElement).closest('[data-clip-block]')) return;
    setSelectedTrack('video');
    const time = getTimeFromClientX(e.clientX);
    seekToTime(time);
    setIsPlaying(false);
    videoRef.current?.pause();
    playAllAudioAtTimeRef.current?.(time, false);
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || timelineDuration <= 0) return;
    const time = getTimeFromClientX(e.clientX);
    seekToTime(time);
    setIsPlaying(false);
    videoRef.current?.pause();
    playAllAudioAtTimeRef.current?.(time, false);
  };

  const handleClipDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ index }));
  };

  const handleAudioClipDragStart = (e: React.DragEvent, fromTrackId: string, clipIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'audio-clip', fromTrackId, clipIndex }));
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'audio-clip', fromTrackId, clipIndex }));
    e.dataTransfer.effectAllowed = 'move';
    const trackIdx = audioTracks.findIndex((t) => t.id === fromTrackId);
    if (trackIdx === -1) return;
    const clip = audioTracks[trackIdx].clips[clipIndex];
    const duration = Math.max(0.001, clip.end - clip.start);
    const clipEl = e.currentTarget as HTMLElement;
    const clipRect = clipEl.getBoundingClientRect();
    const grabPx = e.clientX - clipRect.left;
    const grabFraction = Math.max(0, Math.min(1, grabPx / clipRect.width));
    const grabOffset = grabFraction * duration;
    setDraggingAudio({ clipId: clip.id, fromTrackId, duration, originalOffset: clip.offset, grabOffset });
  };

  const handleAudioClipDragEnd = () => {
    setDraggingAudio(null);
    setDragGhost(null);
  };

  const normalizeTrackOffsets = (clipsForTrack: Clip[]) => {
    // sort by offset if present, otherwise keep order
    const items = clipsForTrack.map((c) => ({ ...c, _offset: typeof c.offset === 'number' ? c.offset : undefined }));
    items.sort((a, b) => {
      const oa = typeof a._offset === 'number' ? a._offset : Infinity;
      const ob = typeof b._offset === 'number' ? b._offset : Infinity;
      if (oa === Infinity && ob === Infinity) return 0;
      return oa - ob;
    });
    let cursor = 0;
    const result: Clip[] = [];
    for (const it of items) {
      const dur = it.end - it.start;
      const desired = typeof it._offset === 'number' ? it._offset : cursor;
      const start = Math.max(cursor, desired);
      result.push({ ...it, offset: start });
      cursor = start + dur;
    }
    return result;
  };

  const handleAudioTrackDragOver = (e: React.DragEvent, toTrackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggingAudio) return;
    const el = e.currentTarget as HTMLElement | null;
    if (!el || timelineDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    const mouseTime = pct * timelineDuration;
    let desired = mouseTime - draggingAudio.grabOffset;
    desired = Math.round(desired / SNAP_SECONDS) * SNAP_SECONDS;
    desired = Math.max(0, Math.min(timelineDuration - draggingAudio.duration, desired));
    setDragGhost({ trackId: toTrackId, start: desired, duration: draggingAudio.duration });
  };

  const handleAudioTrackDragLeave = (e: React.DragEvent) => {
    setDragGhost(null);
  };

  const handleAudioDrop = (e: React.DragEvent, toTrackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    if (!raw) return;
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed || parsed.type !== 'audio-clip') return;
    const { fromTrackId, clipIndex } = parsed;
    if (!fromTrackId) return;
    const fromIdx = audioTracks.findIndex((t) => t.id === fromTrackId);
    const toIdx = audioTracks.findIndex((t) => t.id === toTrackId);
    if (fromIdx === -1 || toIdx === -1) return;
    const fromTrack = audioTracks[fromIdx];
    if (clipIndex < 0 || clipIndex >= fromTrack.clips.length) return;
    const clip = fromTrack.clips[clipIndex];
    let trackContainerEl: HTMLElement | null = e.currentTarget as HTMLElement;
    if (trackContainerEl && !trackContainerEl.matches('.audio-track-inner')) {
      trackContainerEl = trackContainerEl.closest('.audio-track-inner') as HTMLElement | null;
    }
    let desiredStart = typeof clip.offset === 'number' ? clip.offset : 0;
    if (trackContainerEl && timelineDuration > 0) {
      const rect = trackContainerEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const mouseTime = pct * timelineDuration;
      const grabOff = draggingAudio ? draggingAudio.grabOffset : 0;
      desiredStart = mouseTime - grabOff;
    }
    desiredStart = Math.round(desiredStart / SNAP_SECONDS) * SNAP_SECONDS;
    desiredStart = Math.max(0, desiredStart);
    const duration = clip.end - clip.start;
    const toTrack = audioTracks[toIdx];
    const chosenStart = findNonOverlappingStart(toTrack.clips, desiredStart, duration, Math.max(timelineDuration, desiredStart + duration + 1), clip.id);
    setAudioTracks((prev) => {
      const next = prev.map((t) => ({ ...t, clips: [...t.clips] }));
      const srcIdx = next[fromIdx].clips.findIndex((c) => c.id === clip.id);
      if (srcIdx !== -1) next[fromIdx].clips.splice(srcIdx, 1);
      next[toIdx].clips.push({ ...clip, offset: chosenStart });
      return next;
    });
    setDraggingAudio(null);
    setDragGhost(null);
    setSelectedTrack(toTrackId);
  };

  // find a non-overlapping start time in the target track for a clip of given duration.
  // Exclude an optional clip id (useful when moving within same track).
  const findNonOverlappingStart = useCallback(
    (clipsForTrack: Clip[], desiredStart: number, duration: number, maxTimeline: number, excludeClipId?: string) => {
      const { positions } = computeTrackPositions(clipsForTrack);
      // build occupied intervals excluding the clip being moved
      const intervals = positions
        .filter((p) => p.clip.id !== excludeClipId)
        .map((p) => ({ start: Math.max(0, p.start), end: Math.min(maxTimeline, p.end) }))
        .sort((a, b) => a.start - b.start);

      // build gaps between intervals
      const gaps: { start: number; end: number }[] = [];
      let cursor = 0;
      for (const it of intervals) {
        if (it.start > cursor) gaps.push({ start: cursor, end: it.start });
        cursor = Math.max(cursor, it.end);
      }
      if (cursor < maxTimeline) gaps.push({ start: cursor, end: maxTimeline });

      // helper to check fit in a gap
      const fitsInGap = (gap: { start: number; end: number }) => gap.end - gap.start >= duration;

      // clamp desiredStart into allowed range
      const clampedDesired = Math.max(0, Math.min(maxTimeline - duration, desiredStart));

      // prefer gap that contains clampedDesired
      for (const gap of gaps) {
        if (!fitsInGap(gap)) continue;
        if (clampedDesired >= gap.start && clampedDesired + duration <= gap.end) {
          // snap to SNAP_SECONDS
          const snapped = Math.round(clampedDesired / SNAP_SECONDS) * SNAP_SECONDS;
          return Number(Math.max(gap.start, Math.min(gap.end - duration, snapped)).toFixed(3));
        }
      }

      // find nearest gap by distance to clampedDesired
      let best: { start: number; distance: number } | null = null;
      for (const gap of gaps) {
        if (!fitsInGap(gap)) continue;
        // candidate start is clampedDesired clamped into gap
        const candidate = Math.max(gap.start, Math.min(gap.end - duration, clampedDesired));
        const dist = Math.abs(candidate - clampedDesired);
        if (!best || dist < best.distance) best = { start: candidate, distance: dist };
      }
      if (best) {
        const snapped = Math.round(best.start / SNAP_SECONDS) * SNAP_SECONDS;
        return Number(Math.max(0, Math.min(maxTimeline - duration, snapped)).toFixed(3));
      }

      // fallback: place at end if space
      if (maxTimeline >= duration) return Number(Math.max(0, maxTimeline - duration).toFixed(3));
      return 0;
    },
    [computeTrackPositions]
  );

  // Context menu handlers
  const openContextMenu = (e: React.MouseEvent, params: { track: 'video' | 'audio'; trackId?: string; clipId: string }) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, track: params.track, trackId: params.trackId, clipId: params.clipId });
  };

  useEffect(() => {
    const onWindowClick = () => setContextMenu((c) => (c.visible ? { ...c, visible: false } : c));
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setContextMenu((c) => ({ ...c, visible: false })); };
    window.addEventListener('click', onWindowClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onWindowClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const duplicateClipById = (track: 'video' | 'audio', trackId: string | undefined, clipId: string) => {
    pushHistory();
    if (track === 'video') {
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) return;
      const c = clips[idx];
      const copy = { ...c, id: generateId() };
      const next = [...clips];
      next.splice(idx + 1, 0, copy);
      setClips(next);
    } else {
      setAudioTracks((prev) => {
        const tIdx = prev.findIndex((t) => t.id === trackId);
        if (tIdx === -1) return prev;
        const trackObj = prev[tIdx];
        const cIdx = trackObj.clips.findIndex((c) => c.id === clipId);
        if (cIdx === -1) return prev;
        const c = trackObj.clips[cIdx];
        const copy = { ...c, id: generateId() };
        const newClips = [...trackObj.clips];
        newClips.splice(cIdx + 1, 0, copy);
        const next = [...prev];
        next[tIdx] = { ...trackObj, clips: newClips };
        return next;
      });
    }
    setContextMenu((c) => ({ ...c, visible: false }));
  };

  const deleteClipById = (track: 'video' | 'audio', trackId: string | undefined, clipId: string) => {
    pushHistory();
    if (track === 'video') {
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) return;
      const newClips = clips.filter((c) => c.id !== clipId);
      setClips(newClips);
      setCurrentTime((t) => Math.min(t, newClips.reduce((acc, cc) => acc + (cc.end - cc.start), 0)));
      if (newClips.length === 0 && videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
        currentClipUrlRef.current = '';
        currentClipIndexRef.current = 0;
        setIsPlaying(false);
      }
    } else {
      setAudioTracks((prev) => {
        const tIdx = prev.findIndex((t) => t.id === trackId);
        if (tIdx === -1) return prev;
        const trackObj = prev[tIdx];
        const newClips = trackObj.clips.filter((c) => c.id !== clipId);
        if (newClips.length === 0) {
          const el = audioElsRef.current[trackObj.id];
          if (el) {
            try { el.pause(); } catch {}
            el.src = '';
            delete audioElsRef.current[trackObj.id];
          }
          return prev.filter((_, i) => i !== tIdx);
        }
        const next = [...prev];
        next[tIdx] = { ...trackObj, clips: newClips };
        return next;
      });
    }
    setContextMenu((c) => ({ ...c, visible: false }));
  };

  const toggleMuteClip = useCallback((track: 'video' | 'audio', trackId?: string, clipId?: string) => {
    if (!clipId) return;
    if (track === 'video') {
      setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, muted: !c.muted } : c));
    } else if (trackId) {
      setAudioTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, muted: !c.muted } : c) }
            : t
        )
      );
    }
    setContextMenu((c) => ({ ...c, visible: false }));
  }, []);

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!timelineRef.current || clips.length <= 1) return;
    pushHistory();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(dragIndex) || dragIndex < 0 || dragIndex >= clips.length) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const dropSlot = Math.min(clips.length, Math.max(0, Math.floor(pct * (clips.length + 1))));
    const newClips = clips.filter((_, j) => j !== dragIndex);
    newClips.splice(dropSlot, 0, clips[dragIndex]);
    setClips(newClips);
  };

  const handleDeleteClip = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (clips.length <= 1) return;
    const newClips = clips.filter((_, i) => i !== index);
    const newDuration = newClips.reduce((acc, c) => acc + (c.end - c.start), 0);
    setClips(newClips);
    setCurrentTime((t) => Math.min(t, newDuration));
  };

  const progressPct = timelineDuration > 0 ? (currentTime / timelineDuration) * 100 : 0;
  // determine playing clip and control target separately:
  // - playingClipObj: the clip currently being shown/played (used to render the filter)
  // - controlClip: the clip that the sidebar controls target (selected clip if any, otherwise playing clip)
  const selectedClipObj = selectedClip.track === 'video' && selectedClip.clipId ? clips.find((c) => c.id === selectedClip.clipId) : null;
  const playingClipObj = getClipAtTime(currentTime)?.clip ?? (clips[currentClipIndexRef.current] ?? null);
  const controlClip = selectedClipObj ?? playingClipObj;
  const activeFilterType = controlClip?.filterType ?? filterType;
  const activeFilterIntensity = typeof controlClip?.filterIntensity === 'number' ? controlClip.filterIntensity : filterIntensity;
  const videoFilter = buildFilter(playingClipObj?.filterType ?? filterType, typeof playingClipObj?.filterIntensity === 'number' ? playingClipObj.filterIntensity! : filterIntensity);
  const blurBgBandActive = playingClipObj?.filterType != null && BLUR_BG_BAND_TYPES.includes(playingClipObj.filterType);
  const blurBgBandHorizontal = playingClipObj?.filterType === 'blur-bg-band-h';
  const blurBgBandVertical = playingClipObj?.filterType === 'blur-bg-band-v';
  const blurBgPx = blurBgBandActive ? blurBgBandBlurPx(typeof playingClipObj?.filterIntensity === 'number' ? playingClipObj.filterIntensity! : filterIntensity) : 0;
  // Determine actual playing state:
  // - if a video source is loaded in the player, use the video's real play state
  // - otherwise (no video) fall back to `isPlaying` which reflects audio-only playback
  const actualPlaying = videoFinished
    ? isPlaying
    : (videoRef.current && videoRef.current.src)
      ? (!videoRef.current.paused && !videoRef.current.ended)
      : isPlaying;

  return (
    <div className="flex flex-col h-full min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 min-w-0">
          <div
            className={`relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-xl border border-zinc-800 transition-all duration-200 ${isDragOver ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-zinc-950 border-rose-500/50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {blurBgBandActive && (
              <video
                ref={videoBgRef}
                src={atForBg?.clip?.url ?? clips[0]?.url ?? ''}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                style={{ filter: `blur(${blurBgPx}px)`, transform: 'scale(1.08)' }}
                muted
                playsInline
                aria-hidden
              />
            )}
            <div className={blurBgBandActive ? 'absolute inset-0 flex items-center justify-center' : 'w-full h-full'}>
              {blurBgBandHorizontal ? (
                <div className="w-full h-[70%] overflow-hidden rounded-xl border-2 border-zinc-600 shadow-2xl bg-zinc-900/50 shrink-0">
                  <video
                    ref={videoRef}
                    src={clips[0]?.url || undefined}
                    className="w-full h-full object-cover transition-[filter] duration-150"
                    style={{ filter: videoFilter }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onLoadedData={handleLoadedData}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    playsInline
                  />
                </div>
              ) : blurBgBandVertical ? (
                <div className="w-[70%] h-full overflow-hidden rounded-xl border-2 border-zinc-600 shadow-2xl bg-zinc-900/50 shrink-0">
                  <video
                    ref={videoRef}
                    src={clips[0]?.url || undefined}
                    className="w-full h-full object-cover transition-[filter] duration-150"
                    style={{ filter: videoFilter }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onLoadedData={handleLoadedData}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    playsInline
                  />
                </div>
              ) : (
              <video
                ref={videoRef}
                src={clips[0]?.url || undefined}
                className={`transition-[filter] duration-150 ${
                  blurBgBandActive
                    ? 'object-cover w-[85%] max-w-3xl h-full rounded-xl border-2 border-zinc-600 shadow-2xl bg-zinc-900/50'
                    : 'object-contain w-full h-full'
                }`}
                style={{ filter: videoFilter }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={handleLoadedData}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                playsInline
              />
              )}
            </div>
            {/* Overlay de legenda no player (sincronizado ao tempo real do vídeo para precisão) */}
            {(playingClipObj?.captionSegments?.length ||
              playingClipObj?.captionText?.trim()) && (
              <CaptionOverlay videoRef={videoRef} clip={playingClipObj} />
            )}
            <AnimatePresence>
              {isDragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-950/85 flex items-center justify-center border-2 border-dashed border-rose-500 rounded-xl"
                >
                  <span className="flex items-center gap-3 text-rose-300 font-semibold text-lg">
                    <Upload size={32} />
                    Solte o vídeo .mp4 aqui
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

            <div className="flex items-center justify-center gap-4 px-4 py-4 bg-zinc-900/90 border-t border-zinc-700/80 w-full max-w-4xl flex-wrap rounded-b-xl border-x border-b border-zinc-800">
            <button
              type="button"
              onClick={togglePlayPause}
              disabled={clips.length === 0 && audioTracks.length === 0}
              className={`flex items-center justify-center w-14 h-14 rounded-full border-2 text-zinc-50 font-medium shadow-lg transition-all duration-200 active:scale-95 ${
                clips.length === 0
                  ? 'bg-zinc-700 border-zinc-600 text-zinc-400 cursor-not-allowed opacity-70'
                  : actualPlaying
                    ? 'bg-amber-500 border-amber-400 text-zinc-900 hover:bg-amber-400 hover:border-amber-300 hover:shadow-xl'
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 hover:border-emerald-400 hover:shadow-xl'
              }`}
              aria-label={actualPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {actualPlaying ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                // prefer splitting selected clip if any
                if (selectedClip && selectedClip.track === 'video' && selectedClip.clipId) {
                  splitSpecificVideoClip(selectedClip.clipId);
                } else if (selectedClip && selectedClip.track === 'audio' && selectedClip.clipId) {
                  splitSpecificAudioClip(selectedClip.trackId, selectedClip.clipId);
                } else {
                  alert('Selecione um bloco de vídeo ou áudio para cortar.');
                }
              }}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-100 shadow-md hover:bg-zinc-700 hover:border-zinc-500 hover:shadow-lg active:scale-95 transition-all duration-200"
              aria-label="Cortar (Split) no playhead"
              title="Cortar no playhead (S)"
            >
              <Scissors size={22} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedClip?.track === 'video' && selectedClip?.clipId) setLegendaModalOpen(true);
                else alert('Selecione um bloco de vídeo para definir a legenda.');
              }}
              disabled={!selectedClip?.clipId || selectedClip?.track !== 'video'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-100 shadow-md hover:bg-zinc-700 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title="Estilo de legenda do bloco selecionado"
            >
              <Type size={18} />
              Legenda
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 border border-rose-500 text-white font-semibold shadow-lg hover:bg-rose-500 hover:border-rose-400 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
              title="Exportar (simulado)"
            >
              <Download size={20} />
              Exportar
            </button>
            {/* Upload de vídeo/áudio removido daqui — usar sidebar */}
            <span className="font-mono text-sm tabular-nums text-zinc-300">
              {formatTime(currentTime)} / {formatTime(timelineDuration)}
            </span>
          </div>

          <footer className="px-4 pb-4 pt-3 w-full max-w-4xl">
            <div
              ref={rulerRef}
              role="slider"
              aria-label="Régua de tempo: clique para posicionar"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={timelineDuration}
              tabIndex={0}
              onClick={handleRulerClick}
              className="flex justify-between text-xs font-mono mb-1.5 px-0.5 select-none cursor-pointer rounded py-1.5 -mx-0.5 hover:bg-zinc-800/60 active:bg-zinc-800 transition-colors min-h-[2rem] items-center"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <span
                  key={pct}
                  className="text-zinc-400 pointer-events-none text-[0.7rem]"
                >
                  {formatTime(pct * timelineDuration)}
                </span>
              ))}
            </div>
            <div ref={timelineAreaRef} className="relative">
            <motion.div
              ref={timelineRef}
              role="slider"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={timelineDuration}
              tabIndex={0}
              onClick={handleTimelineClick}
              onDragOver={handleTimelineDragOver}
              onDrop={handleTimelineDrop}
              className="relative h-14 bg-sky-950/50 rounded-xl border border-sky-800/40 cursor-pointer overflow-hidden shadow-inner"
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* per-clip thumbnails rendered inside each clip (no global background frames) */}

              {totalDuration > 0 && (
                <>
                  <AnimatePresence mode="sync">
                    {clips.map((clip, i) => {
                      const left = (startTimes[i] / timelineDuration) * 100;
                      const width = ((clip.end - clip.start) / timelineDuration) * 100;
                      return (
              <motion.div
                          key={clip.id}
                          data-clip-block
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                          draggable={clips.length > 1}
                          onDragStart={(e) => clips.length > 1 && handleClipDragStart(e, i)}
                          onClick={(e) => { e.stopPropagation(); setSelectedClip({ track: 'video', clipId: clip.id }); setSelectedTrack('video'); }}
                          onContextMenu={(e) => openContextMenu(e, { track: 'video', clipId: clip.id })}
                          className={`absolute inset-y-1 rounded-md bg-sky-800/60 hover:bg-sky-700/70 border border-sky-600/50 shadow-sm flex items-center justify-between gap-0.5 pr-0.5 group z-10 ${clips.length > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${selectedClip.track === 'video' && selectedClip.clipId === clip.id ? 'ring-2 ring-orange-500' : ''}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                          }}
                        >
                          {clips.length > 1 && (
                            <span className="flex items-center text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <GripVertical size={14} className="shrink-0" />
                            </span>
                          )}
                          <div className="flex-1 relative px-0">
                            {/* thumbnails fill the clip area (behind label) */}
                            {thumbnails[clip.id] && thumbnails[clip.id].length > 0 && (() => {
                              const thumbs = thumbnails[clip.id];
                              const duration = Math.max(0.001, clip.end - clip.start);
                              const displayCount = Math.min(Math.ceil(duration / DISPLAY_STEP), 200); // one image per DISPLAY_STEP, capped
                              const arr = Array.from({ length: displayCount }).map((_, k) => {
                                const displayTime = clip.start + k * DISPLAY_STEP;
                                const idx = thumbs.length > 0 ? Math.round((displayTime - clip.start) / BASE_THUMB_STEP) : 0;
                                const mapIndex = Math.max(0, Math.min(thumbs.length - 1, idx));
                                return thumbs[mapIndex];
                              });
                                return (
                                <div className="absolute inset-0 left-0 z-0 flex h-full">
                                  {arr.map((src, si) => (
                                    <div key={si} className="flex-none overflow-hidden" style={{ width: `${100 / Math.max(1, arr.length)}%` }}>
                                      {src ? <img src={src} alt="" className="w-full h-full object-cover block" /> : <div className="w-full h-full bg-zinc-800/60" />}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            {/* overlay label centered, transparent background */}
                            <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none text-xs text-zinc-100/90 bg-transparent">
                              {getClipName(clip, `Vídeo ${i + 1}`)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-rose-500/20 rounded-l-xl pointer-events-none z-[1]"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                  />
                  {/* playhead moved to cover full timeline area */}
                </>
              )}
            </motion.div>
            {/* Continue playback overlay (shows when autoplay blocked) */}
            <AnimatePresence>
              {showContinueOverlay && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="pointer-events-auto bg-zinc-900/95 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl">
                    <div className="text-sm text-zinc-100 mb-2">Clique para continuar reprodução</div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          const v = videoRef.current;
                          if (!v) return;
                          attemptPlay(v)
                            .then(() => {
                              playAllAudioAtTime(currentTime, true);
                              setShowContinueOverlay(false);
                            })
                            .catch(() => {
                              // still failed; keep overlay
                            });
                        }}
                        className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-500"
                      >
                        Continuar reprodução
                      </button>
                      <button
                        onClick={() => setShowContinueOverlay(false)}
                        className="px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Audio tracks area (stacked just below the main timeline) */}
            {audioTracks.length > 0 && (
              <div className="mt-1 space-y-2">
                {audioTracks.map((track) => {
                  const trackTotal = Math.max(totalDuration, 1);
                  const st: number[] = [];
                  let acc = 0;
                  for (const c of track.clips) {
                    st.push(acc);
                    acc += c.end - c.start;
                  }
                  return (
                    <div
                      key={track.id}
                      className="w-full rounded-md p-1"
                      onClick={() => setSelectedTrack(track.id)}
                      onDragOver={handleTimelineDragOver}
                      onDrop={(e) => handleAudioDrop(e, track.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                          {/* labels removed per request */}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* remove button intentionally removed from header */}
                        </div>
                      </div>
                      <div
                        className="audio-track-inner relative h-14 bg-emerald-950/50 rounded-xl border border-emerald-800/40 overflow-hidden shadow-inner"
                        onDragOver={(e) => handleAudioTrackDragOver(e, track.id)}
                        onDragLeave={handleAudioTrackDragLeave}
                        onDrop={(e) => handleAudioDrop(e, track.id)}
                      >
                        {/* render ghost preview when dragging */}
                        {dragGhost && dragGhost.trackId === track.id && timelineDuration > 0 && (
                          <div
                            className="absolute inset-y-1 bg-rose-500/40 border border-rose-400 pointer-events-none rounded"
                            style={{
                              left: `${(dragGhost.start / timelineDuration) * 100}%`,
                              width: `${(dragGhost.duration / timelineDuration) * 100}%`,
                            }}
                          />
                        )}
                        {track.clips.map((clip, i) => {
                          // compute positions using per-track positions (respect offsets)
                          const { positions } = computeTrackPositions(track.clips);
                          const left = (positions[i].start / timelineDuration) * 100;
                          const width = ((positions[i].end - positions[i].start) / timelineDuration) * 100;
                          return (
                            <div
                              key={clip.id}
                              className={`absolute inset-y-1 rounded-md bg-emerald-800/60 hover:bg-emerald-700/70 border border-emerald-600/50 flex items-center overflow-hidden ${selectedClip.track === 'audio' && selectedClip.clipId === clip.id ? 'ring-2 ring-orange-500' : ''}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                              onContextMenu={(e) => openContextMenu(e, { track: 'audio', trackId: track.id, clipId: clip.id })}
                              draggable
                              onDragStart={(e) => handleAudioClipDragStart(e, track.id, i)}
                              onDragEnd={handleAudioClipDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleAudioDrop(e, track.id)}
                              onClick={(e) => { e.stopPropagation(); setSelectedClip({ track: 'audio', trackId: track.id, clipId: clip.id }); setSelectedTrack(track.id); }}
                            >
                              <div className="flex-1 relative px-2">
                                <span className={`absolute inset-0 flex items-center justify-center pointer-events-none text-xs ${selectedClip.track === 'audio' && selectedClip.clipId === clip.id ? 'text-zinc-100' : 'text-zinc-100/90'}`}>
                                  {getClipName(clip, track.name)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Playhead spanning entire timeline area (video + audio tracks) */}
            <motion.div
              key={playheadKey}
              className="absolute top-0 bottom-0 w-1 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.6)] z-20 cursor-ew-resize touch-none select-none"
              style={{ left: `${progressPct}%` }}
              initial={false}
              animate={{ left: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              drag="x"
              dragConstraints={timelineRef}
              dragElastic={0}
              dragMomentum={false}
              onDragStart={() => {
                playheadDragStartPctRef.current = progressPct;
                wasPlayingBeforePlayheadDragRef.current = isPlaying;
                if (videoRef.current && isPlaying) {
                  videoRef.current.pause();
                  setIsPlaying(false);
                }
              }}
              onDragEnd={(e) => {
                if (!timelineRef.current || timelineDuration <= 0) return;
                const playheadEl = e.target as HTMLElement;
                const playheadRect = playheadEl.getBoundingClientRect();
                const timelineRect = timelineRef.current.getBoundingClientRect();
                const playheadLeftEdge = playheadRect.left - timelineRect.left;
                const relativeX = playheadLeftEdge;
                const pct = Math.max(0, Math.min(1, relativeX / timelineRect.width));
                const time = pct * timelineDuration;
                seekToTime(time);
                setPlayheadKey((k) => k + 1);
                if (wasPlayingBeforePlayheadDragRef.current && videoRef.current) {
                  videoRef.current.play().catch(() => {});
                  setIsPlaying(true);
                }
              }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-rose-500 rounded-full border-2 border-zinc-900 pointer-events-none" />
            </motion.div>
            </div>
          </footer>
        </main>

        {/* Barra lateral Efeitos */}
        <aside className="w-full lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-700/80 bg-zinc-900/90 flex flex-col p-4 gap-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={18} className="text-rose-400/80" />
            Efeitos
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { type: 'none' as const, label: 'Nenhum', icon: CircleOff },
                { type: 'grayscale' as const, label: 'P&B', icon: Image },
                { type: 'sepia' as const, label: 'Sépia', icon: Palette },
                { type: 'invert' as const, label: 'Inverter', icon: Contrast },
                { type: 'blur' as const, label: 'Blur', icon: Sparkles },
                { type: 'blur-bg-band-h' as const, label: 'Fundo blur + faixa horizontal', icon: Layout },
                { type: 'blur-bg-band-v' as const, label: 'Fundo blur + faixa vertical', icon: Layout },
              ] as const
            ).map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  // apply filter to selected clip if available, otherwise to the currently active clip
                  let targetId: string | undefined;
                  if (selectedClip.track === 'video' && selectedClip.clipId) targetId = selectedClip.clipId;
                  const at = getClipAtTime(currentTime);
                  if (!targetId && at) targetId = at.clip.id;
                  if (!targetId) {
                    alert('Selecione um bloco de vídeo para aplicar efeitos.');
                    return;
                  }
                  pushHistory();
                  setClips((prev) => prev.map((c) => (c.id === targetId ? { ...c, filterType: type } : c)));
                  onDirty?.();
                }}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                  activeFilterType === type
                    ? 'bg-rose-600 border-rose-500 text-white shadow-md'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-500'
                }`}
                title={type === 'none' ? 'Remover filtro' : label}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <label className="block text-xs text-zinc-400 mb-2 font-medium">
              Intensidade {activeFilterType !== 'none' && <span className="text-rose-400/90">({activeFilterIntensity}%)</span>}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={activeFilterIntensity}
              onChange={(e) => {
                const val = Number(e.target.value);
                // apply to selected or active clip
                let targetId: string | undefined;
                if (selectedClip.track === 'video' && selectedClip.clipId) targetId = selectedClip.clipId;
                const at = getClipAtTime(currentTime);
                if (!targetId && at) targetId = at.clip.id;
                if (!targetId) {
                  alert('Selecione um bloco de vídeo para ajustar intensidade.');
                  return;
                }
                pushHistory();
                setClips((prev) => prev.map((c) => (c.id === targetId ? { ...c, filterIntensity: val } : c)));
                onDirty?.();
              }}
              disabled={activeFilterType === 'none'}
              className="w-full h-2.5 rounded-full appearance-none bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed accent-rose-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-800 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              aria-label="Intensidade do filtro"
            />
          </div>
        </aside>
      </div>

      {/* Modal Exportar (simulado) */}
      {/* Context menu for clips */}
      {contextMenu.visible && (
        <div
          className="fixed z-60"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
            <button
              type="button"
              onClick={() => {
                duplicateClipById(contextMenu.track, contextMenu.trackId, contextMenu.clipId!);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              Duplicar
            </button>
            {contextMenu.clipId && (() => {
              let isMuted = false;
              if (contextMenu.track === 'video') {
                isMuted = !!clips.find((c) => c.id === contextMenu.clipId)?.muted;
              } else {
                const t = audioTracks.find((t) => t.id === contextMenu.trackId);
                isMuted = !!t?.clips.find((c) => c.id === contextMenu.clipId)?.muted;
              }
              return (
                <button
                  type="button"
                  onClick={() => toggleMuteClip(contextMenu.track, contextMenu.trackId, contextMenu.clipId)}
                  className="block w-full text-left px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  {isMuted ? 'Desilenciar' : 'Silenciar'}
                </button>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                deleteClipById(contextMenu.track, contextMenu.trackId, contextMenu.clipId!);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-zinc-100 hover:bg-rose-600 hover:text-white"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
      <LegendaModal
        open={legendaModalOpen}
        onClose={() => setLegendaModalOpen(false)}
        initialText={selectedClip?.track === 'video' && selectedClip?.clipId ? (clips.find((c) => c.id === selectedClip.clipId)?.captionText ?? '') : ''}
        selectedStyle={(selectedClip?.track === 'video' && selectedClip?.clipId ? clips.find((c) => c.id === selectedClip.clipId)?.captionStyle : undefined) ?? 'none'}
        clipUrl={selectedClip?.track === 'video' && selectedClip?.clipId ? (() => {
          const c = clips.find((x) => x.id === selectedClip.clipId);
          const u = (c?.serverUrl || c?.url) as string | undefined;
          if (!u || (!u.startsWith('http://') && !u.startsWith('https://'))) return undefined;
          try {
            if (typeof window !== 'undefined' && new URL(u).origin !== window.location.origin) return undefined;
            return u;
          } catch {
            return u;
          }
        })() : undefined}
        clipStart={selectedClip?.track === 'video' && selectedClip?.clipId ? clips.find((c) => c.id === selectedClip.clipId)?.start : undefined}
        clipEnd={selectedClip?.track === 'video' && selectedClip?.clipId ? clips.find((c) => c.id === selectedClip.clipId)?.end : undefined}
        initialSegments={selectedClip?.track === 'video' && selectedClip?.clipId ? (clips.find((c) => c.id === selectedClip.clipId)?.captionSegments ?? []) : []}
        onSave={(captionText, captionStyle, captionSegments) => {
          if (selectedClip?.track !== 'video' || !selectedClip?.clipId) return;
          pushHistory();
          setClips((prev) => prev.map((c) => (c.id === selectedClip.clipId
            ? { ...c, captionText: captionSegments?.length ? '' : captionText, captionStyle, captionSegments: captionSegments ?? [] }
            : c)));
          onDirty?.();
        }}
      />
      <AnimatePresence>
        {exportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && closeExportModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="bg-zinc-900 border-2 border-zinc-600 rounded-2xl shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                  {exportPhase === 'loading' ? 'Exportando...' : 'Exportação concluída'}
                </h3>
                <button
                  type="button"
                  onClick={closeExportModal}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-transparent hover:border-zinc-600 transition-all duration-200"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
              {exportPhase === 'loading' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Loader2 size={40} className="text-rose-500" />
                  </motion.div>
                  <p className="text-sm text-zinc-300">processamento do vídeo...</p>
                </div>
              )}
              {exportPhase === 'done' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <CheckCircle size={48} className="text-emerald-500" />
                  <p className="text-sm text-zinc-300 text-center">
                    Os tempos de corte foram registrados no console (F12).
                  </p>
                  <button
                    type="button"
                    onClick={closeExportModal}
                    className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const VideoEditorComponent = forwardRef(VideoEditorInner) as React.ForwardRefExoticComponent<
  VideoEditorProps & React.RefAttributes<VideoEditorHandle>
>;

export const VideoEditor = VideoEditorComponent;
