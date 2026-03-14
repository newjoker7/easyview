# Contexto do projeto Easy View Editor

## Visão geral

Editor de vídeo em React + TypeScript + Vite. Principais funcionalidades: timeline com clipes de vídeo e trilhas de áudio, zoom na timeline, régua de tempo (clique para posicionar o playhead), play/pause, cortes (split), legendas por clipe, exportação.

## Componente principal: VideoEditor

- **Arquivo:** `src/components/VideoEditor.tsx`
- Timeline com zoom (1x–8x); régua e faixas compartilham o mesmo container de scroll.
- **Posição na timeline:** sempre usar `getTimeFromClientX(clientX)` para converter posição do mouse em tempo (considera scroll e zoom). Não usar apenas `getBoundingClientRect()` da régua.
- **Play após seek (ex.: clique na régua):** usar `attemptPlayWhenReady(v)` em vez de `attemptPlay(v)` direto, para evitar botão play travado (cinza). Estado “tentando play”: `startAttemptingPlay()` / `clearAttemptingPlay()`; sempre usar o timeout de segurança e limpar em todos os caminhos (finally, catch, listener de erro).

## Regras Cursor

- `.cursor/rules/video-editor-timeline.mdc` — convenções para timeline, régua, zoom e botão play no VideoEditor.

## Deploy

- Ver `DEPLOY.md` para deploy com Docker no VPS.
