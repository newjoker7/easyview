import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Trash2, Clock, Loader2, Film, X } from 'lucide-react';
import type { Project } from '../services/projects';

interface ProjectsListProps {
  open: boolean;
  projects: Project[];
  loading: boolean;
  onSelect: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onClose: () => void;
}

export function ProjectsList({ open, projects, loading, onSelect, onDelete, onClose }: ProjectsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {open && (
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
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-sky-400" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">Meus Projetos</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                  <Film className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">Nenhum projeto encontrado</p>
                  <p className="text-xs mt-1">Crie um novo projeto para começar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <motion.div
                      key={project.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelect(project)}
                      className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                        <Film className="w-5 h-5 text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{project.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-zinc-600" />
                          <p className="text-xs text-zinc-500">{formatDate(project.updatedAt || project.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-zinc-600">
                            {project.data?.clips?.length || 0} vídeo(s)
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {project.data?.audioTracks?.length || 0} trilha(s)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, project.id)}
                        className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
