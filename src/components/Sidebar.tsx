import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  Film,
  FolderOpen,
  Plus,
  Video,
  Music,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  User,
  MessageSquare,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  currentProjectName: string | null;
  hasProject: boolean;
  saving: boolean;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onAddVideo: () => void;
  onAddAudio: () => void;
  onSave: () => void;
  onLogout: () => void;
  onTts: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  currentProjectName,
  hasProject,
  saving,
  onNewProject,
  onOpenProjects,
  onAddVideo,
  onAddAudio,
  onSave,
  onLogout,
  onTts,
  onOpenSettings,
}: SidebarProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { icon: Plus, label: 'Novo Projeto', onClick: onNewProject, always: true, color: 'text-emerald-400' },
    { icon: FolderOpen, label: 'Meus Projetos', onClick: onOpenProjects, always: true, color: 'text-sky-400' },
  ];

  const projectItems = [
    { icon: Video, label: 'Vídeo', onClick: onAddVideo, color: 'text-rose-400' },
    { icon: Music, label: 'Áudio', onClick: onAddAudio, color: 'text-violet-400' },
    { icon: MessageSquare, label: 'Text to Speech', onClick: onTts, color: 'text-cyan-400' },
    { icon: Save, label: saving ? 'Salvando...' : 'Salvar', onClick: onSave, color: 'text-amber-400', disabled: saving },
  ];

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className="h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-zinc-800/60">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-start"
            >
              <div className="w-60 h-20 rounded-2xl bg-zinc-900  flex items-center justify-center shadow-md overflow-hidden">
                <img
                  src="/logo.png"
                  alt="vdyou"
                  className="w-66 h-40 object-contain"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            title={collapsed ? item.label : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-xl transition-all duration-150"
          >
            <item.icon className={`w-[18px] h-[18px] shrink-0 ${item.color}`} />
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}

        {/* Project section */}
        {hasProject && (
          <>
            <div className="pt-3 pb-1 px-3">
              {!collapsed && (
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Projeto Atual
                </p>
              )}
              {!collapsed && currentProjectName && (
                <p className="text-xs text-zinc-400 mt-1 truncate">{currentProjectName}</p>
              )}
            </div>
            {projectItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                disabled={item.disabled}
                title={collapsed ? item.label : undefined}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-xl transition-all duration-150 disabled:opacity-50"
              >
                {item.label === 'Salvando...' ? (
                  <Loader2 className={`w-[18px] h-[18px] shrink-0 ${item.color} animate-spin`} />
                ) : (
                  <item.icon className={`w-[18px] h-[18px] shrink-0 ${item.color}`} />
                )}
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* User / Settings / Logout */}
      <div className="px-2 py-3 border-t border-zinc-800/60 space-y-1">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate">
                {user.displayName || user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={onOpenSettings}
          title={collapsed ? 'Configurações' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-xl transition-all duration-150"
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </button>
        <button
          onClick={onLogout}
          title={collapsed ? 'Sair' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-150"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </motion.aside>
  );
}
