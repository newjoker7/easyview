import { useMemo } from 'react';
import type { EditorTextOverlay } from '../types/editorText';

export const TEXT_FONT_OPTIONS: { id: string; label: string; family: string }[] = [
  { id: 'inter', label: 'Inter', family: '"Inter", system-ui, sans-serif' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { id: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { id: 'playfair', label: 'Playfair', family: '"Playfair Display", serif' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { id: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { id: 'roboto-mono', label: 'Mono', family: '"Roboto Mono", monospace' },
];

const PRESET_BLOCKS = [
  {
    id: 'heading',
    label: 'Adicionar cabeçalho',
    desc: 'Texto em destaque',
    patch: {
      text: 'Título',
      fontFamily: '"Bebas Neue", sans-serif',
      fontSize: 48,
      fontWeight: 400 as const,
      color: '#ffffff',
    },
  },
  {
    id: 'body',
    label: 'Adicionar corpo de texto',
    desc: 'Texto padrão',
    patch: {
      text: 'Escreva aqui o seu texto',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: 22,
      fontWeight: 400 as const,
      color: '#e4e4e7',
    },
  },
];

const STYLE_PRESETS = [
  {
    id: 'neon',
    label: 'Neon',
    patch: {
      fontFamily: '"Montserrat", sans-serif',
      fontSize: 28,
      fontWeight: 700 as const,
      color: '#f472b6',
    },
  },
  {
    id: 'classic',
    label: 'Clássico',
    patch: {
      fontFamily: '"Playfair Display", serif',
      fontSize: 26,
      fontWeight: 700 as const,
      color: '#fafafa',
    },
  },
  {
    id: 'bold-bar',
    label: 'Trend',
    patch: {
      fontFamily: '"Oswald", sans-serif',
      fontSize: 32,
      fontWeight: 700 as const,
      color: '#22c55e',
    },
  },
  {
    id: 'code',
    label: 'Código',
    patch: {
      fontFamily: '"Roboto Mono", monospace',
      fontSize: 18,
      fontWeight: 400 as const,
      color: '#a1a1aa',
    },
  },
];

interface TextEditorPanelProps {
  timelineDuration: number;
  overlays: EditorTextOverlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (partial: Omit<EditorTextOverlay, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<EditorTextOverlay>) => void;
  onDelete: (id: string) => void;
}

export function TextEditorPanel({
  timelineDuration,
  overlays,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: TextEditorPanelProps) {
  const selected = useMemo(
    () => overlays.find((o) => o.id === selectedId) ?? null,
    [overlays, selectedId]
  );

  const dur = Math.max(0.1, timelineDuration);

  const applyPreset = (patch: Partial<EditorTextOverlay>) => {
    const start = 0;
    const end = Math.min(dur, Math.max(1, dur));
    onAdd({
      text: patch.text ?? 'Texto',
      xPercent: 50,
      yPercent: 50,
      fontFamily: patch.fontFamily ?? '"Inter", system-ui, sans-serif',
      fontSize: patch.fontSize ?? 24,
      color: patch.color ?? '#ffffff',
      fontWeight: patch.fontWeight ?? 400,
      timelineStart: start,
      timelineEnd: end,
    });
  };

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex rounded-lg bg-zinc-800/80 p-0.5 text-xs font-medium">
        <span className="flex-1 rounded-md bg-zinc-700 px-2 py-1.5 text-center text-zinc-100">
          Todos
        </span>
        <span className="flex-1 px-2 py-1.5 text-center text-zinc-500">Comercial</span>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Básico
        </h3>
        <div className="flex flex-col gap-2">
          {PRESET_BLOCKS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.patch)}
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 py-3 text-left transition hover:border-rose-500/50 hover:bg-zinc-800"
            >
              <div className="text-sm font-medium text-zinc-100">{p.label}</div>
              <div className="text-xs text-zinc-500">{p.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Populares
          </h3>
          <span className="text-xs text-zinc-600">Estilos</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applyPreset(s.patch)}
              className="min-w-[100px] shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-4 text-center text-xs font-semibold text-zinc-200 transition hover:border-rose-500/40"
              style={{ fontFamily: s.patch.fontFamily }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Camadas de texto
        </h3>
        {overlays.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhum texto ainda. Use Básico ou Populares.</p>
        ) : (
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
            {overlays.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onSelect(o.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left ${
                    selectedId === o.id ? 'bg-rose-600/25 text-rose-100' : 'bg-zinc-800/60 text-zinc-300'
                  }`}
                >
                  <span className="truncate">{o.text || '(vazio)'}</span>
                  <span className="shrink-0 text-zinc-500">
                    {o.timelineStart.toFixed(1)}s–{o.timelineEnd.toFixed(1)}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Editar selecionado</span>
            <button
              type="button"
              onClick={() => onDelete(selected.id)}
              className="text-xs text-red-400 hover:underline"
            >
              Apagar
            </button>
          </div>
          <label className="block text-xs text-zinc-500">
            Conteúdo
            <textarea
              value={selected.text}
              onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Cor
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={selected.color.match(/^#/) ? selected.color : '#ffffff'}
                onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded border border-zinc-600 bg-zinc-800"
              />
              <input
                type="text"
                value={selected.color}
                onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 font-mono text-xs text-zinc-100"
              />
            </div>
          </label>
          <label className="block text-xs text-zinc-500">
            Fonte
            <select
              value={TEXT_FONT_OPTIONS.find((f) => f.family === selected.fontFamily)?.id ?? 'inter'}
              onChange={(e) => {
                const opt = TEXT_FONT_OPTIONS.find((f) => f.id === e.target.value);
                if (opt) onUpdate(selected.id, { fontFamily: opt.family });
              }}
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-2 text-sm text-zinc-100"
            >
              {TEXT_FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">
              Tamanho ({selected.fontSize}px)
              <input
                type="range"
                min={12}
                max={72}
                value={selected.fontSize}
                onChange={(e) => onUpdate(selected.id, { fontSize: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Peso
              <select
                value={selected.fontWeight}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    fontWeight: Number(e.target.value) as 400 | 700,
                  })
                }
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-2 text-sm text-zinc-100"
              >
                <option value={400}>Normal</option>
                <option value={700}>Negrito</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">
              Início (s)
              <input
                type="number"
                min={0}
                max={dur}
                step={0.1}
                value={selected.timelineStart}
                onChange={(e) =>
                  onUpdate(selected.id, { timelineStart: Math.max(0, Number(e.target.value)) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Fim (s)
              <input
                type="number"
                min={0}
                max={dur + 60}
                step={0.1}
                value={selected.timelineEnd}
                onChange={(e) =>
                  onUpdate(selected.id, { timelineEnd: Math.max(0, Number(e.target.value)) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
          </div>
          <p className="text-[10px] text-zinc-600">
            Selecione o texto no vídeo e arraste para mover. Clique fora do texto para desmarcar.
          </p>
        </section>
      )}
    </div>
  );
}
