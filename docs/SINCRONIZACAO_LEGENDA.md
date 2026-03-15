# Rotina chave: sincronização da legenda

## 1. Onde a decisão “mostrar / não mostrar” é tomada

**Ficheiro:** `src/components/CaptionOverlay.tsx`  
**Rotina:** o `useEffect` que regista o loop (linhas 33–64) e, dentro dele, a função **`tick`** (linhas 45–56).

A lógica que decide o texto a exibir está aqui:

```ts
// Linha 46: tempo atual do elemento <video> (em segundos no ficheiro)
const vt = video.currentTime;

// Linhas 47–50: se estivermos fora do intervalo do clipe, não mostrar nada
if (!Number.isFinite(vt) || vt < clipStart - 0.02 || vt > clipEnd + 0.02) {
  setActiveText('');
  ...
}

// Linha 52: tempo relativo ao início do clipe (0 = início do clipe)
const timeInClip = vt - clipStart;

// Linhas 53–55: procurar um segmento que contenha timeInClip e mostrar o seu texto
const list = segsRef.current ?? [];
const segment = list.find((s) => timeInClip >= s.start && timeInClip < s.end);
setActiveText(segment?.text?.trim() ?? '');
```

Ou seja, a **rotina chave** é: **`timeInClip = video.currentTime - clip.start`** e a condição **`timeInClip >= s.start && timeInClip < s.end`** para cada segmento em `clip.captionSegments`.

---

## 2. Contrato de tempo (o que tem de bater)

| Conceito | Significado |
|----------|-------------|
| **clip.start / clip.end** | Início e fim do clipe **no ficheiro** (em segundos). Ex.: 10 e 25 = o clipe usa os segundos 10–25 do vídeo. |
| **video.currentTime** | Tempo actual de reprodução **no ficheiro** (segundos). Quando o clipe está a tocar, varia entre `clip.start` e `clip.end`. |
| **timeInClip** | `video.currentTime - clip.start`. Deve estar entre 0 e `(clip.end - clip.start)`. |
| **Segmentos (captionSegments)** | Cada um tem `start`, `end`, `text`. **Têm de estar em tempo relativo ao clipe:** 0 = primeiro segundo do clipe, 1 = 1 s depois do início do clipe, etc. |

Para a legenda estar certa:

- Os segmentos que o overlay recebe em `clip.captionSegments` têm de ter `start`/`end` **relativos ao início do clipe** (0 = início do clipe).
- A comparação é sempre: `timeInClip` (derivado de `video.currentTime - clip.start`) dentro de `[s.start, s.end)`.

Se a API ou a normalização devolverem segmentos em **tempo do ficheiro** (ex.: 10.5–11.2 em vez de 0.5–1.2), a legenda fica deslocada.

---

## 3. Onde os segmentos são preparados

- **Backend** (`server/index.js`):  
  - Rota `POST /transcribe`.  
  - O áudio extraído vai de 0 até `duration` do trecho. O Whisper devolve segmentos nessa janela (0-based).  
  - `tryBuildSegmentsFromWhisperJson` (JSON) e `parseSrtToSegments` (SRT) devolvem segmentos em **tempo relativo ao trecho pedido** (0 = início do trecho).

- **Frontend – normalização** (`src/services/captionSegments.ts`):  
  - **`normalizeToClipRelative(segments, clipStart, clipEnd)`**  
  - Se os segmentos vierem em tempo de ficheiro (ex.: 10.5–11.0 para um clipe 10–20), converte para relativo (0.5–1.0).  
  - É chamada no **LegendaModal** ao receber a resposta da API e ao carregar `initialSegments`.

- **Quem passa o clip ao overlay** (`src/components/VideoEditor.tsx`):  
  - `playingClipObj = getClipAtTime(currentTime)?.clip` (por volta da linha 2092).  
  - O overlay recebe esse mesmo objeto: `clip={playingClipObj}` (linhas 2187–2189).  
  - Ou seja, usa o `clip` que tem `start`/`end` no ficheiro e `captionSegments` já guardados no projeto (que devem estar normalizados para tempo relativo ao clipe).

---

## 4. Resumo: o que verificar para “concertar” a sincronização

1. **No overlay (`CaptionOverlay.tsx`)**  
   - Confirmar que `clipStart` e `clipEnd` são os do clipe que está a tocar (já são, vêm do `clip`).  
   - Confirmar que `timeInClip = video.currentTime - clipStart` e que a condição é `timeInClip >= s.start && timeInClip < s.end`.  
   - Se quiseres atrasar/avançar a legenda, podes ajustar aqui (ex.: usar `timeInClip - 0.2` para comparar com `s.start`/`s.end`, ou alterar a condição).

2. **Na normalização (`captionSegments.ts`)**  
   - Garantir que todos os segmentos que vão para o projeto estão em **tempo relativo ao clipe** (0 = início do clipe).  
   - A função `normalizeToClipRelative` é o sítio certo para converter tempo de ficheiro → tempo relativo ao clipe.

3. **No backend (`server/index.js`)**  
   - O áudio enviado ao Whisper é o trecho `[start, end]` do ficheiro, começando em 0 no WAV.  
   - Os segmentos devolvidos pelo servidor devem ser 0-based nessa janela (já são, no fluxo actual).  
   - Se o Whisper estiver a dar inícios de frase “adiantados”, podes atrasar só o `start` de cada segmento antes de responder (ex.: `start: s.start + 0.2`), mantendo o `end`.

4. **Debug rápido**  
   - No `tick` do `CaptionOverlay`, podes fazer `console.log({ vt: video.currentTime, clipStart, clipEnd, timeInClip, segment: segment?.text })` para ver se `timeInClip` e os `s.start`/`s.end` estão na mesma base e se o segmento escolhido é o esperado.

---

## 5. Ficheiros envolvidos (por ordem do fluxo)

| Ficheiro | O que faz |
|----------|-----------|
| `server/index.js` | `/transcribe` → extrai áudio do trecho, Whisper devolve segmentos (0-based no trecho). |
| `src/services/api.ts` | `transcribeVideo()` chama a API. |
| `src/components/LegendaModal.tsx` | Chama `transcribeVideo`, depois `normalizeToClipRelative(rawSegs, clipStart, clipEnd)` e guarda no projeto. |
| `src/services/captionSegments.ts` | `normalizeToClipRelative()` — converte/normaliza para tempo relativo ao clipe. |
| `src/components/VideoEditor.tsx` | Obtém `playingClipObj` (clip em reprodução) e passa-o ao overlay. |
| **`src/components/CaptionOverlay.tsx`** | **Rotina chave:** em cada frame, `timeInClip = video.currentTime - clip.start` e `segment = list.find(s => timeInClip >= s.start && timeInClip < s.end)`; mostra `segment.text` ou nada. |

A sincronização “certa” depende de: (1) `clip.start`/`clip.end` e `video.currentTime` serem na mesma base (ficheiro), e (2) `captionSegments` estarem em tempo relativo ao clipe (0 = `clip.start`). A rotina que efectivamente sincroniza é o `tick` em `CaptionOverlay.tsx` com essa comparação.
