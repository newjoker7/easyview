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
