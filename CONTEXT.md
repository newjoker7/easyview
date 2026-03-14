# Contexto do projeto Easy View Editor

## Visão geral

Editor de vídeo em React + TypeScript + Vite. Principais funcionalidades: timeline com clipes de vídeo e trilhas de áudio, zoom na timeline, régua de tempo (clique para posicionar o playhead), play/pause, cortes (split), legendas por clipe, exportação.

## Componente principal: VideoEditor

- **Arquivo:** `src/components/VideoEditor.tsx`
- Timeline com zoom (1x–8x); régua e faixas compartilham o mesmo container de scroll.
- **Posição na timeline:** sempre usar `getTimeFromClientX(clientX)` para converter posição do mouse em tempo (considera scroll e zoom). Não usar apenas `getBoundingClientRect()` da régua.
- **Play após seek (ex.: clique na régua):** usar `attemptPlayWhenReady(v)` em vez de `attemptPlay(v)` direto, para evitar botão play travado (cinza). Estado “tentando play”: `startAttemptingPlay()` / `clearAttemptingPlay()`; sempre usar o timeout de segurança e limpar em todos os caminhos (finally, catch, listener de erro).

## Legendas (captions)

- **Extração:** `LegendaModal` chama `transcribeVideo(clipUrl, clipStart, clipEnd)`; os segmentos são normalizados para **tempo relativo ao clipe** (0 = início do clipe) antes de guardar.
- **Exibição:** `CaptionOverlay` (`src/components/CaptionOverlay.tsx`) usa a API nativa **TextTrack + VTTCue**: cria um track no vídeo, adiciona cues com `clip.start + seg.start` / `clip.start + seg.end` (tempo no ficheiro), e subscreve o evento `cuechange` para mostrar o texto. A sincronização é feita pelo browser, não por RAF.
- **Contrato:** `captionSegments` guardados sempre em tempo relativo ao clipe. Ver `CaptionSegment` em `src/services/api.ts`.

## Deploy

- Ver `DEPLOY.md` para deploy com Docker no VPS.
