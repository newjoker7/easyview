# Opções gratuitas para extração de legendas (transcrição)

O servidor tenta primeiro **faster-whisper** (Python); se não estiver instalado ou falhar, usa **nodejs-whisper**. Todas as opções são **gratuitas**.

---

## 1. faster-whisper (recomendado, usado primeiro)

- **O quê:** Whisper em Python, em geral com timestamps mais estáveis.
- **Ficheiros:** `server/transcribe_faster_whisper.py`, `server/requirements-transcribe.txt`.
- **Instalação no servidor:**
  - Se `pip` não existir, instale primeiro (Linux/Debian/Ubuntu):
    ```bash
    sudo apt update
    sudo apt install python3-pip
    ```
  - Depois, na pasta do servidor:
    ```bash
    cd server
    pip3 install -r requirements-transcribe.txt
    ```
    (Se `pip3` falhar, tente: `python3 -m pip install -r requirements-transcribe.txt`.)
  - Na primeira execução o modelo "tiny" é descarregado.
- **Requisito:** Python 3.8+ e `python` ou `python3` no PATH. O Node chama o script após extrair o WAV com ffmpeg.
- Se o script devolver segmentos, a resposta usa-os e o nodejs-whisper não é chamado.

---

## 2. nodejs-whisper (fallback)

- **O quê:** Bindings Node para o Whisper (OpenAI).
- **Instalação:** `npm i nodejs-whisper` (no servidor) e `npx nodejs-whisper download` para o modelo.
- **Vantagens:** Já integrado, gera JSON e SRT.
- **Desvantagens:** Timestamps (sobretudo o início dos segmentos) podem vir incorretos ou “colados” ao fim do anterior.

---

## 3. Usar apenas o SRT do nodejs-whisper

O próprio Whisper gera um ficheiro `.srt`. Por vezes os limites no SRT são mais estáveis que no JSON.

- **Como testar:** No servidor, defina a variável de ambiente `TRANSCRIBE_USE_SRT_ONLY=1` e reinicie. A rota `/transcribe` passará a usar **só** o SRT (ignora o JSON).
- **Limitação:** O SRT não tem palavras; cada bloco é uma frase com um único start/end.

---

## 4. Vosk (alternativa local, gratuita)

- **O quê:** Motor de reconhecimento de voz offline (Kaldi), com bindings Node.
- **npm:** `vosk`
- **Modelos:** Download em https://alphacephei.com/vosk/models (ex.: `vosk-model-small-pt-0.3` para português).
- **Vantagens:** Offline, vários idiomas, timestamps por palavra; pode dar resultados diferentes do Whisper.
- **Desvantagens:** Requer instalação do pacote, do modelo e integração no servidor (novo caminho na rota `/transcribe`).

---

## 5. APIs (limite de uso)

- **Whisper API (OpenAI):** Pago por uso; não é gratuita.
- **Google Speech-to-Text:** Free tier limitado (minutos por mês).
- **Outras (e.g. Azure, AWS):** Free tier com limites.

Para manter **100% gratuito e sob seu controlo**, use **faster-whisper** (instale Python + `pip install faster-whisper`) ou, em alternativa, **nodejs-whisper**, **SRT apenas** ou **Vosk**.

---

## Resumo

| Opção                    | Custo   | Onde corre | Integração atual      |
|--------------------------|--------|------------|------------------------|
| faster-whisper (Python) | Grátis | Servidor   | Sim (tentado primeiro) |
| nodejs-whisper           | Grátis | Servidor   | Sim (fallback)         |
| SRT apenas               | Grátis | Servidor   | Sim (`TRANSCRIBE_USE_SRT_ONLY=1`) |
| Vosk                     | Grátis | Servidor   | Não (a adicionar)      |
