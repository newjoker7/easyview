import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { VideoEditor, type VideoEditorHandle } from './VideoEditor';
import { UploadModal } from './UploadModal';
import { ProjectsList } from './ProjectsList';
import {
  createProject,
  getUserProjects,
  getProject,
  updateProjectData,
  deleteProject,
  type Project,
} from '../services/projects';
import { deleteFile } from '../services/api';
import { TtsModal } from './TtsModal';
import { Plus, FolderOpen, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Dashboard() {
  const { user, logout } = useAuth();

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [uploadModal, setUploadModal] = useState<'video' | 'audio' | null>(null);
  const [showTts, setShowTts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedModal, setUnsavedModal] = useState<{ action: () => void } | null>(null);

  const editorRef = useRef<VideoEditorHandle | null>(null);
  const hasUnsavedRef = useRef(false);
  hasUnsavedRef.current = hasUnsavedChanges;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const confirmOrProceed = useCallback((action: () => void) => {
    if (hasUnsavedRef.current) {
      setUnsavedModal({ action });
    } else {
      action();
    }
  }, []);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setProjectsLoading(true);
    try {
      const list = await getUserProjects(user.uid);
      setProjects(list);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  }, [user]);

  const handleNewProject = useCallback(async () => {
    if (!user) return;
    const doCreate = async () => {
      const name = prompt('Nome do projeto:');
      if (!name?.trim()) return;
      try {
        const id = await createProject(user.uid, name.trim());
        const proj = await getProject(id);
        if (proj) {
          setCurrentProject(proj);
          setHasUnsavedChanges(false);
          editorRef.current?.loadProjectData({ clips: [], audioTracks: [] });
        }
      } catch (err) {
        console.error('Error creating project:', err);
      }
    };
    confirmOrProceed(doCreate);
  }, [user, confirmOrProceed]);

  const handleOpenProjects = useCallback(async () => {
    const doOpen = async () => {
      await loadProjects();
      setShowProjects(true);
    };
    confirmOrProceed(doOpen);
  }, [loadProjects, confirmOrProceed]);

  const handleSelectProject = useCallback(async (project: Project) => {
    setShowProjects(false);
    setCurrentProject(project);
    setHasUnsavedChanges(false);
    if (project.data) {
      editorRef.current?.loadProjectData(project.data);
    }
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      const proj = projects.find((p) => p.id === projectId);
      if (proj?.data) {
        const urls: string[] = [];
        proj.data.clips?.forEach((c) => { if (c.serverUrl) urls.push(c.serverUrl); });
        proj.data.audioTracks?.forEach((t) => t.clips?.forEach((c) => { if (c.serverUrl) urls.push(c.serverUrl); }));
        for (const url of urls) {
          try {
            const filename = url.split('/').pop();
            if (filename) await deleteFile(filename);
          } catch { /* best effort */ }
        }
      }
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setHasUnsavedChanges(false);
        editorRef.current?.loadProjectData({ clips: [], audioTracks: [] });
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  }, [currentProject, projects]);

  const handleSave = useCallback(async () => {
    if (!currentProject || !editorRef.current) return;
    setSaving(true);
    try {
      const data = editorRef.current.getProjectData();
      await updateProjectData(currentProject.id, data);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setSaving(false);
    }
  }, [currentProject]);

  const handleFileUploaded = useCallback((type: 'video' | 'audio', file: File, serverUrl: string) => {
    if (type === 'video') {
      editorRef.current?.addVideoFile(file, serverUrl);
    } else {
      editorRef.current?.addAudioFile(file, serverUrl);
    }
    setHasUnsavedChanges(true);
  }, []);

  const handleTtsGenerated = useCallback((file: File, serverUrl: string) => {
    editorRef.current?.addAudioFile(file, serverUrl);
    setHasUnsavedChanges(true);
  }, []);

  const handleLogout = useCallback(() => {
    confirmOrProceed(() => logout());
  }, [confirmOrProceed, logout]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar
        currentProjectName={currentProject?.name ?? null}
        hasProject={!!currentProject}
        saving={saving}
        onNewProject={handleNewProject}
        onOpenProjects={handleOpenProjects}
        onAddVideo={() => setUploadModal('video')}
        onAddAudio={() => {
          if (!editorRef.current?.hasVideo()) {
            alert('Nenhum vídeo adicionado.');
            return;
          }
          setUploadModal('audio');
        }}
        onSave={handleSave}
        onLogout={handleLogout}
        onTts={() => {
          if (!editorRef.current?.hasVideo()) {
            alert('Nenhum vídeo adicionado.');
            return;
          }
          setShowTts(true);
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentProject ? (
          <VideoEditor
            key={currentProject.id}
            ref={editorRef}
            projectId={currentProject.id}
            initialData={currentProject.data}
            onDirty={markDirty}
          />
        ) : (
          <EmptyState onNewProject={handleNewProject} onOpenProjects={handleOpenProjects} />
        )}
      </div>

      {/* Upload modals */}
      <UploadModal
        type="video"
        open={uploadModal === 'video'}
        onClose={() => setUploadModal(null)}
        onFileUploaded={(f, url) => handleFileUploaded('video', f, url)}
      />
      <UploadModal
        type="audio"
        open={uploadModal === 'audio'}
        onClose={() => setUploadModal(null)}
        onFileUploaded={(f, url) => handleFileUploaded('audio', f, url)}
      />

      {/* TTS modal */}
      <TtsModal
        open={showTts}
        onClose={() => setShowTts(false)}
        onAudioGenerated={handleTtsGenerated}
      />

      {/* Projects list */}
      <ProjectsList
        open={showProjects}
        projects={projects}
        loading={projectsLoading}
        onSelect={handleSelectProject}
        onDelete={handleDeleteProject}
        onClose={() => setShowProjects(false)}
      />

      {/* Unsaved changes modal */}
      <AnimatePresence>
        {unsavedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setUnsavedModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">Alterações não salvas</h2>
              </div>
              <p className="text-sm text-zinc-400 mb-6">
                Você tem alterações que não foram salvas. Deseja continuar sem salvar?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUnsavedModal(null)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl border border-zinc-700 transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={async () => {
                    await handleSave();
                    unsavedModal.action();
                    setUnsavedModal(null);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl shadow-lg transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setHasUnsavedChanges(false);
                    unsavedModal.action();
                    setUnsavedModal(null);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold rounded-xl shadow-lg transition-all"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onNewProject, onOpenProjects }: { onNewProject: () => void; onOpenProjects: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="flex items-center justify-center">
        <img src="/logo.png" alt="vdyou" className="object-contain" style={{ width: '100%', height: '200px' }} />
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Bem-vindo</h2>
        <p className="text-sm text-zinc-500 mb-8">Crie um novo projeto ou abra um existente para começar a editar</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onNewProject}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </button>
          <button
            onClick={onOpenProjects}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700 transition-all flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Meus Projetos
          </button>
        </div>
      </motion.div>
    </div>
  );
}
