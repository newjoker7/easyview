# Opções gratuitas para extração de legendas (transcrição)

O projeto usa atualmente **nodejs-whisper** para transcrever o áudio e obter segmentos com start/end. Todas as alternativas abaixo são **gratuitas** (open source ou free tier).

---

## 1. nodejs-whisper (atual)

- **O quê:** Bindings Node para o Whisper (OpenAI).
- **Instalação:** `npm i nodejs-whisper` (no servidor) e `npx nodejs-whisper download` para o modelo.
- **Vantagens:** Já integrado, gera JSON e SRT.
- **Desvantagens:** Timestamps (sobretudo o início dos segmentos) podem vir incorretos ou “colados” ao fim do anterior.

---

## 2. Usar apenas o SRT do nodejs-whisper

O próprio Whisper gera um ficheiro `.srt`. Por vezes os limites no SRT são mais estáveis que no JSON.

- **Como testar:** No servidor, defina a variável de ambiente `TRANSCRIBE_USE_SRT_ONLY=1` e reinicie. A rota `/transcribe` passará a usar **só** o SRT (ignora o JSON).
- **Limitação:** O SRT não tem palavras; cada bloco é uma frase com um único start/end.

---

## 3. Vosk (alternativa local, gratuita)

- **O quê:** Motor de reconhecimento de voz offline (Kaldi), com bindings Node.
- **npm:** `vosk`
- **Modelos:** Download em https://alphacephei.com/vosk/models (ex.: `vosk-model-small-pt-0.3` para português).
- **Vantagens:** Offline, vários idiomas, timestamps por palavra; pode dar resultados diferentes do Whisper.
- **Desvantagens:** Requer instalação do pacote, do modelo e integração no servidor (novo caminho na rota `/transcribe`).

---

## 4. faster-whisper (Python)

- **O quê:** Implementação do Whisper em Python, em geral mais rápida e por vezes com timestamps melhores.
- **Instalação:** `pip install faster-whisper`.
- **Uso:** Script Python que recebe o WAV e devolve JSON com segmentos (start/end/text). O servidor Node chama o script (ex.: `child_process.spawn`) e lê o resultado.
- **Vantagens:** Gratuito, local, costuma ter timestamps de segmento mais consistentes.
- **Desvantagens:** Depende de Python no servidor e de um pequeno script de integração.

---

## 5. APIs gratuitas (limite de uso)

- **Whisper API (OpenAI):** Pago por uso; não é gratuita.
- **Google Speech-to-Text:** Free tier limitado (minutos por mês).
- **Outras (e.g. Azure, AWS):** Free tier com limites.

Para manter **100% gratuito e sob seu controlo**, as opções práticas são: **nodejs-whisper** (atual), **usar só SRT** (variável acima), **Vosk** ou **faster-whisper** via script.

---

## Resumo

| Opção                    | Custo   | Onde corre | Integração atual      |
|--------------------------|--------|------------|------------------------|
| nodejs-whisper           | Grátis | Servidor   | Sim (JSON + SRT)       |
| SRT apenas (mesmo Whisper)| Grátis | Servidor   | Sim (`TRANSCRIBE_USE_SRT_ONLY=1`) |
| Vosk                     | Grátis | Servidor   | Não (a adicionar)      |
| faster-whisper (Python)  | Grátis | Servidor   | Não (script externo)   |
