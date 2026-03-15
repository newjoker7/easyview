#!/usr/bin/env python3
"""
Transcrição com faster-whisper. Uso: python transcribe_faster_whisper.py <caminho.wav>
Escreve para stdout um JSON: {"segments": [{"start": float, "end": float, "text": str}, ...]}
Requer: pip install faster-whisper
"""
import json
import os
import sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: transcribe_faster_whisper.py <audio.wav>"}), file=sys.stderr)
        sys.exit(1)
    wav_path = sys.argv[1]
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "Instale: pip install faster-whisper"}), file=sys.stderr)
        sys.exit(2)
    try:
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        language = os.environ.get("TRANSCRIBE_LANG") or "pt"
        segments_iter, _ = model.transcribe(wav_path, language=language, word_timestamps=False)
        segments = []
        for s in segments_iter:
            text = (s.text or "").strip()
            if text and s.start is not None and s.end is not None:
                segments.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": text})
        print(json.dumps({"segments": segments}))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(3)

if __name__ == "__main__":
    main()
