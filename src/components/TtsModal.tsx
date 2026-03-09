import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Square, Plus, Loader2 } from 'lucide-react';
import { getTtsVoices, generateTts, type TtsVoice } from '../services/api';

function normalizeFileUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  const host = window.location.hostname;
  if (host !== 'vdyou.com' && host !== 'www.vdyou.com') return url;
  let u = url.replace(/^http:\/\//i, 'https://');
  if (u.includes('/files/') && !u.includes('/api/files/')) {
    u = u.replace(/(https?:\/\/[^/]+)\/files\//, '$1/api/files/');
  }
  return u;
}

interface TtsModalProps {
  open: boolean;
  onClose: () => void;
  onAudioGenerated: (file: File, serverUrl: string) => void;
}

const LANGUAGES = [
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'en-US', label: 'Inglês (US)' },
  { code: 'es-ES', label: 'Espanhol (ES)' },
];

export function TtsModal({ open, onClose, onAudioGenerated }: TtsModalProps) {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('pt-BR');
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTtsVoices(lang)
      .then((list) => {
        if (cancelled) return;
        setVoices(list);
        setSelectedVoice((prev) => {
          if (list.find((v) => v.name === prev)) return prev;
          return list[0]?.name || '';
        });
      })
      .catch(() => {
        if (!cancelled) setVoices([]);
      });
    return () => { cancelled = true; };
  }, [lang, open]);

  useEffect(() => {
    if (!open) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewing(false);
    }
  }, [open]);

  const handlePreview = async () => {
    if (!text.trim() || previewing || generating) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewing(true);
    setError('');

    try {
      const data = await generateTts(text, selectedVoice);
      const audio = new Audio(normalizeFileUrl(data.url));
      previewAudioRef.current = audio;
      audio.onended = () => { setPreviewing(false); previewAudioRef.current = null; };
      audio.onerror = () => { setPreviewing(false); previewAudioRef.current = null; };
      audio.play();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Erro ao gerar prévia.');
      setPreviewing(false);
    }
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewing(false);
  };

  const handleAdd = async () => {
    if (!text.trim() || generating || !selectedVoice) return;
    setGenerating(true);
    setError('');

    try {
      const data = await generateTts(text, selectedVoice);
      const audioRes = await fetch(normalizeFileUrl(data.url));
      const blob = await audioRes.blob();
      const file = new File([blob], `tts-${Date.now()}.mp3`, { type: 'audio/mpeg' });
      onAudioGenerated(file, data.url);
      setText('');
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Erro ao gerar áudio TTS.');
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
                  <path d="M9 11v2" /><path d="M15 11v2" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">Text to Speech</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Texto</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Digite o texto para converter em áudio..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Idioma</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Voz</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                >
                  {voices.length === 0 && <option value="">Carregando vozes...</option>}
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.label} ({v.gender === 'Female' ? 'Feminina' : 'Masculina'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
            <button
              onClick={previewing ? stopPreview : handlePreview}
              disabled={!text.trim() || generating || !selectedVoice}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl border border-zinc-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewing ? (
                <>
                  <Square className="w-4 h-4" />
                  Parar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Ouvir Prévia
                </>
              )}
            </button>
            <button
              onClick={handleAdd}
              disabled={!text.trim() || generating || !selectedVoice}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
