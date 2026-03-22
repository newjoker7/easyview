# Contexto do projeto Easy View Editor

## Visão geral

Editor de vídeo em React + TypeScript + Vite. Principais funcionalidades: timeline com clipes de vídeo e trilhas de áudio, zoom na timeline, régua de tempo (clique para posicionar o playhead), play/pause, cortes (split), legendas por clipe, exportação.

## Componente principal: VideoEditor

- **Arquivo:** `src/components/VideoEditor.tsx`
- Timeline com zoom (1x–8x); régua e faixas compartilham o mesmo container de scroll.
- **Posição na timeline:** sempre usar `getTimeFromClientX(clientX)` para converter posição do mouse em tempo (considera scroll e zoom). Não usar apenas `getBoundingClientRect()` da régua.
- **Play após seek (ex.: clique na régua):** usar `attemptPlayWhenReady(v)` em vez de `attemptPlay(v)` direto, para evitar botão play travado (cinza). Estado “tentando play”: `startAttemptingPlay()` / `clearAttemptingPlay()`; sempre usar o timeout de segurança e limpar em todos os caminhos (finally, catch, listener de erro).

## Legendas (captions)

- **Extração:** `LegendaModal` chama `transcribeVideo(clipUrl, clipStart, clipEnd)`; o servidor extrai o áudio do trecho e tenta primeiro **faster-whisper** (Python). Se não estiver disponível, usa **nodejs-whisper** (JSON ou SRT). A resposta `{ segments }` é normalizada para **tempo relativo ao clipe** (0 = início do clipe) antes de guardar.
- **Exibição:** `CaptionOverlay` (`src/components/CaptionOverlay.tsx`) usa um loop com `requestAnimationFrame` para ler `video.currentTime`, calcula `timeInClip = video.currentTime - clip.start` e mostra texto **apenas** quando `timeInClip` está dentro de um segmento `[seg.start, seg.end)`. Fora de qualquer segmento (pausas) não mostra nada.
- **Contrato:** `captionSegments` guardados sempre em tempo relativo ao clipe. Ver `CaptionSegment` em `src/services/api.ts` e `normalizeToClipRelative` em `src/services/captionSegments.ts`.

## Deploy

- Ver `DEPLOY.md` para deploy com Docker no VPS.
