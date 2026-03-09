import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Film, Music, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadFile } from '../services/api';

interface UploadModalProps {
  type: 'video' | 'audio';
  open: boolean;
  onClose: () => void;
  onFileUploaded: (file: File, serverUrl: string) => void;
}

export function UploadModal({ type, open, onClose, onFileUploaded }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = type === 'video' ? 'video/mp4,video/webm,video/mov' : 'audio/mpeg,audio/wav,audio/ogg,audio/mp3';
  const Icon = type === 'video' ? Film : Music;
  const label = type === 'video' ? 'Vídeo' : 'Áudio';
  const extensions = type === 'video' ? '.mp4, .webm, .mov' : '.mp3, .wav, .ogg';

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setError('');
  };

  const handleConfirm = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    setProgress('Enviando arquivo para o servidor...');
    try {
      const result = await uploadFile(selectedFile);
      setProgress('Concluído!');
      onFileUploaded(selectedFile, result.url);
      setTimeout(() => {
        setLoading(false);
        setSelectedFile(null);
        setProgress('');
        onClose();
      }, 400);
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar arquivo.');
      setLoading(false);
      setProgress('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setSelectedFile(null);
    setLoading(false);
    setError('');
    setProgress('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={reset}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  type === 'video' ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">Adicionar {label}</h2>
              </div>
              <button
                onClick={reset}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <span className="text-sm text-rose-300">{error}</span>
              </div>
            )}

            {/* Drop zone */}
            {!selectedFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? 'border-rose-500 bg-rose-500/5'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/40 hover:bg-zinc-800/60'
                }`}
              >
                <Upload className={`w-10 h-10 ${dragOver ? 'text-rose-400' : 'text-zinc-500'}`} />
                <p className="text-sm text-zinc-300 text-center">
                  Arraste um arquivo ou <span className="text-rose-400 font-medium">clique para selecionar</span>
                </p>
                <p className="text-xs text-zinc-500">{extensions}</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  type === 'video' ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'
                }`}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    {progress && <span className="ml-2 text-rose-400">{progress}</span>}
                  </p>
                </div>
                {!loading && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            {selectedFile && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 mt-5"
              >
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl border border-zinc-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 py-2.5 font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                    type === 'video'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-500/20'
                      : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-violet-500/20'
                  }`}
                >
                  Enviar {label}
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
