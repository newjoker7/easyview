/**
 * Contrato único para segmentos de legenda:
 * - Sempre em tempo relativo ao clipe: 0 = início do clipe, end = fim do segmento dentro do clipe.
 * - Usado na extração (normalizar resposta da API) e na exibição (comparar com video.currentTime - clip.start).
 */

export interface ClipRelativeSegment {
  start: number;
  end: number;
  text: string;
}

/** Offset em segundos aplicado ao início de cada segmento para exibição (evita legenda antes da fala). */
export const CAPTION_DISPLAY_START_OFFSET_SEC = 0.2;

/**
 * Converte segmentos para "tempo de exibição": atrasa o início em que a legenda aparece.
 * Só mostra quando timeInClip >= seg.start + offset, para não exibir antes da fala.
 * Segmentos que ficariam com displayStart >= end são omitidos.
 */
export function toDisplaySegments(
  segments: { start: number; end: number; text: string }[],
  startOffsetSec: number = CAPTION_DISPLAY_START_OFFSET_SEC
): { start: number; end: number; text: string }[] {
  if (!segments?.length || startOffsetSec <= 0) return segments ?? [];
  const result: { start: number; end: number; text: string }[] = [];
  for (const s of segments) {
    const displayStart = s.start + startOffsetSec;
    if (displayStart >= s.end) continue;
    result.push({ start: displayStart, end: s.end, text: s.text });
  }
  return result;
}

/**
 * Converte segmentos da API para tempo relativo ao clipe (0 = início do clipe).
 * A API pode devolver:
 * - Tempo no ficheiro (ex.: clip 10–20s → segmentos 10.5–11.0) → subtrai clipStart.
 * - Tempo relativo à janela (ex.: 0.5–1.0 para o mesmo trecho) → mantém e apenas ordena/valida.
 */
export function normalizeToClipRelative(
  segments: { start: number; end: number; text: string }[],
  clipStart: number,
  clipEnd: number
): ClipRelativeSegment[] {
  if (!segments?.length) return [];
  const duration = Math.max(0, clipEnd - clipStart);
  const result: ClipRelativeSegment[] = [];

  for (const s of segments) {
    let start: number;
    let end: number;
    const inFileTime =
      s.start >= clipStart - 0.01 &&
      s.end <= clipEnd + 0.01 &&
      s.start <= s.end;

    if (inFileTime) {
      start = s.start - clipStart;
      end = s.end - clipStart;
    } else {
      start = s.start;
      end = s.end;
    }

    start = Math.max(0, Math.min(duration, start));
    end = Math.max(start, Math.min(duration, end));
    if (end <= start || !String(s.text).trim()) continue;
    result.push({ start, end, text: String(s.text).trim() });
  }

  result.sort((a, b) => a.start - b.start);
  return result;
}
