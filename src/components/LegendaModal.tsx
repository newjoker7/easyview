import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { CaptionStyleId } from './VideoEditor';
import type { CaptionSegment } from '../services/api';
import { transcribeVideo } from '../services/api';

const EXAMPLE_TEXT = 'Text';

export const CAPTION_PRESETS: { id: CaptionStyleId; name: string; previewStyle: React.CSSProperties }[] = [
  { id: 'karaoke', name: 'Karaoke', previewStyle: { color: '#22c55e', fontWeight: 700, textTransform: 'uppercase' as const, WebkitTextStroke: '2px white', textShadow: '0 0 4px rgba(255,255,255,0.8)' } },
  { id: 'deep-diver', name: 'Deep Diver', previewStyle: { color: '#9ca3af', backgroundColor: '#4b5563', padding: '4px 8px', fontSize: '0.9em', borderRadius: 4 } },
  { id: 'popline', name: 'Popline', previewStyle: { color: '#fff', fontWeight: 700, textTransform: 'uppercase' as const, borderBottom: '3px solid #a855f7' } },
  { id: 'seamless-bounce', name: 'Seamless Bounce', previewStyle: { color: '#22c55e', fontWeight: 700, textShadow: '0 0 12px rgba(34,197,94,0.8)' } },
  { id: 'beasty', name: 'Beasty', previewStyle: { color: '#fff', fontWeight: 700, textTransform: 'uppercase' as const, WebkitTextStroke: '1px #000' } },
  { id: 'youshaei', name: 'Youshaei', previewStyle: { color: '#22c55e', fontWeight: 700, textTransform: 'uppercase' as const } },
  { id: 'mozi', name: 'Mozi', previewStyle: { color: '#fff', fontWeight: 700, textTransform: 'uppercase' as const, WebkitTextStroke: '2px #22c55e', textShadow: '0 0 6px #22c55e' } },
  { id: 'glitch', name: 'Glitch Infinite', previewStyle: { color: '#ea580c', fontWeight: 700, textShadow: '2px 0 #0ff, -2px 0 #f0f' } },
  { id: 'baby-earthquake', name: 'Baby Earthquake', previewStyle: { color: '#e5e7eb', textTransform: 'lowercase' as const, fontSize: '0.95em' } },
];

export function getCaptionStyleProps(styleId: CaptionStyleId): React.CSSProperties | null {
  if (styleId === 'none') return null;
  const p = CAPTION_PRESETS.find((x) => x.id === styleId);
  return p?.previewStyle ?? null;
}

interface LegendaModalProps {
  open: boolean;
  onClose: () => void;
  initialText: string;
  selectedStyle: CaptionStyleId;
  /** URL do vídeo no servidor para extrair legenda (transcrição). */
  clipUrl?: string;
  clipStart?: number;
  clipEnd?: number;
  initialSegments?: CaptionSegment[];
  onSave: (text: string, style: CaptionStyleId, segments?: CaptionSegment[]) => void;
}

export function LegendaModal({ open, onClose, initialText, selectedStyle, clipUrl, clipStart, clipEnd, initialSegments = [], onSave }: LegendaModalProps) {
  const [text, setText] = useState(initialText);
  const [style, setStyle] = useState<CaptionStyleId>(selectedStyle);
  const [segments, setSegments] = useState<CaptionSegment[]>(initialSegments);
  const [hoverId, setHoverId] = useState<CaptionStyleId | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setStyle(selectedStyle);
      setSegments(initialSegments || []);
      setExtractError(null);
    }
  }, [open, initialText, selectedStyle, initialSegments]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const previewId = hoverId ?? style;
  const previewPreset = previewId === 'none' ? null : CAPTION_PRESETS.find((p) => p.id === previewId) ?? CAPTION_PRESETS[0];
  const hasSegments = segments.length > 0;
  const displayText = hasSegments ? segments[0]?.text ?? EXAMPLE_TEXT : (text && text.trim()) ? text.trim() : EXAMPLE_TEXT;

  if (!open) return null;

  const handleExtract = async () => {
    if (!clipUrl) return;
    setExtracting(true);
    setExtractError(null);
    setExtractProgress(0);

    const durationSec = clipEnd != null && clipStart != null && clipEnd > clipStart
      ? clipEnd - clipStart
      : 60;
    const estimatedMs = Math.max(15000, Math.min(600000, durationSec * 3000));
    const stepMs = 500;
    const stepPct = (stepMs / estimatedMs) * 90;

    progressIntervalRef.current = setInterval(() => {
      setExtractProgress((p) => Math.min(90, p + stepPct));
    }, stepMs);

    try {
      const { segments: segs } = await transcribeVideo(clipUrl, clipStart, clipEnd);
      const startRef = clipStart ?? 0;
      const endRef = clipEnd ?? startRef + 1;
      // Normalizar para tempo relativo ao clipe (0 = início do clipe), para sincronizar com o overlay.
      const normalized =
        segs?.map((s) => {
          const inClipRange =
            s.start >= startRef - 0.01 && s.end <= endRef + 0.01;
          return {
            ...s,
            start: inClipRange ? s.start - startRef : s.start,
            end: inClipRange ? s.end - startRef : s.end,
          };
        }) ?? [];
      setSegments(normalized);
      if (!normalized.length) setExtractError('Nenhuma fala detectada no trecho.');
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'Falha ao extrair legenda.');
      setSegments([]);
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setExtractProgress(100);
      setExtracting(false);
      setTimeout(() => setExtractProgress(0), 400);
    }
  };

  const handleApply = () => {
    onSave(text.trim(), style, hasSegments ? segments : undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="bg-zinc-900 border-2 border-zinc-600 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-700">
            <h3 className="text-lg font-semibold text-zinc-100">Legenda</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Extrair legenda do áudio do vídeo (transcrição no servidor) */}
          {clipUrl && (
            <div className="p-4 border-b border-zinc-700/80 space-y-2">
              <p className="text-xs text-zinc-400">Legenda extraída do vídeo (reconhecimento de fala)</p>
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-800/80 border border-emerald-600/60 text-emerald-100 font-medium hover:bg-emerald-700/80 disabled:opacity-60 transition-all"
              >
                {extracting ? <Loader2 size={18} className="animate-spin shrink-0" /> : null}
                {extracting ? `A extrair… ${Math.round(extractProgress)}%` : 'Extrair legenda do vídeo'}
              </button>
              {extracting && (
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${extractProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
              {extractError && <p className="text-sm text-rose-400">{extractError}</p>}
              {hasSegments && !extractError && <p className="text-sm text-zinc-300">{segments.length} trecho(s) extraído(s). Escolha o estilo e clique em Aplicar.</p>}
            </div>
          )}

          <div className="p-4 border-b border-zinc-700/80">
            <label className="block text-xs text-zinc-400 mb-2">Ou digite o texto da legenda (para todo o clipe)</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite o texto que aparecerá no vídeo"
              className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all"
            />
          </div>

          <div className="p-4 border-b border-zinc-700/80 bg-zinc-800/50">
            <p className="text-xs text-zinc-400 mb-2">Exemplo (como ficará no vídeo)</p>
            <div className="min-h-[52px] flex items-center justify-center rounded-lg bg-zinc-800/80 px-4 py-2">
              <span
                className="text-xl font-medium transition-all duration-150 text-zinc-200 break-words text-center max-w-full"
                style={previewPreset?.previewStyle ?? {}}
              >
                {displayText}
              </span>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-xs text-zinc-400 mb-3">Estilo da legenda</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CAPTION_PRESETS.map((preset) => {
                const isSelected = style === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setStyle(preset.id)}
                    onMouseEnter={() => setHoverId(preset.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`rounded-xl border-2 p-3 bg-zinc-800/80 hover:bg-zinc-700/80 transition-all text-left ${
                      isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-zinc-600 hover:border-zinc-500'
                    }`}
                  >
                    <div className="h-10 flex items-center justify-center mb-2 rounded bg-zinc-900/80">
                      <span
                        className="text-sm font-medium truncate max-w-full px-1"
                        style={preset.previewStyle}
                      >
                        {displayText}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-300 font-medium">{preset.name}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setStyle('none')}
              className={`mt-3 w-full rounded-xl border-2 p-3 bg-zinc-800/80 hover:bg-zinc-700/80 transition-all text-left ${
                style === 'none' ? 'border-rose-500' : 'border-zinc-600'
              }`}
            >
              <span className="text-sm text-zinc-400">Nenhum (remover legenda)</span>
            </button>
          </div>

          <div className="p-4 border-t border-zinc-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-500 transition-all"
            >
              Aplicar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
