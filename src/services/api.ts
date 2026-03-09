function getApiUrl(): string {
  const env = import.meta.env.VITE_API_URL || '';
  if (typeof window !== 'undefined' && (window.location.hostname === 'vdyou.com' || window.location.hostname === 'www.vdyou.com')) {
    return `${window.location.origin}/api`;
  }
  return env || 'http://localhost:4000';
}
const API_URL = getApiUrl();

export interface UploadResult {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
    throw new Error(err.error || `Upload falhou (${res.status})`);
  }
  return res.json();
}

export async function deleteFile(filename: string): Promise<void> {
  await fetch(`${API_URL}/files/${filename}`, { method: 'DELETE' });
}
/** Segmento de legenda (tempo relativo ao início do clipe, em segundos). */
export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}
/** Extrai legendas do áudio do vídeo (transcrição via Whisper no servidor). */
export async function transcribeVideo(url: string, start?: number, end?: number): Promise<{ segments: CaptionSegment[] }> {
  const res = await fetch(`${API_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, start, end }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = [data.error, data.detail].filter(Boolean).join(' — ') || `Transcrição falhou (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export function getFileUrl(filename: string): string {
  return `${API_URL}/files/${filename}`;
}

export interface TtsVoice {
  name: string;
  lang: string;
  gender: string;
  label: string;
}

export async function getTtsVoices(lang: string): Promise<TtsVoice[]> {
  const res = await fetch(`${API_URL}/tts/voices?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error('Erro ao carregar vozes.');
  return res.json();
}

export async function generateTts(text: string, voice: string): Promise<{ url: string; filename: string }> {
  const res = await fetch(`${API_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro TTS' }));
    throw new Error(err.error || `TTS falhou (${res.status})`);
  }
  return res.json();
}

export async function convertWebmToMp4(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/convert`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro na conversão' }));
    throw new Error(err.error || `Conversão falhou (${res.status})`);
  }
  return res.json();
}

/** Exporta vídeo no servidor (trim + concat + filtros + áudio). */
export interface ExportClipSpec {
  url: string;
  start: number;
  end: number;
  filterType?: string;
  filterIntensity?: number;
  muted?: boolean;
  captionText?: string;
  captionStyle?: string;
  captionSegments?: CaptionSegment[];
}

export interface ExportAudioClipSpec {
  url: string;
  start: number;
  end: number;
  offset: number; // posição na timeline em segundos
  muted?: boolean;
}

export interface ExportAudioTrackSpec {
  muted: boolean;
  clips: ExportAudioClipSpec[];
}

export async function exportVideoOnServer(
  clips: ExportClipSpec[],
  audioTracks?: ExportAudioTrackSpec[]
): Promise<UploadResult> {
  const res = await fetch(`${API_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clips, audioTracks: audioTracks || [] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Exportação falhou' }));
    const msg = [err.error, err.detail].filter(Boolean).join(' — ') || `Export falhou (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}
