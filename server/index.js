import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const TTS_VOICES = [
  { name: 'pt-BR-FranciscaNeural', lang: 'pt-BR', gender: 'Female', label: 'Francisca' },
  { name: 'pt-BR-AntonioNeural', lang: 'pt-BR', gender: 'Male', label: 'Antonio' },
  { name: 'pt-BR-BrendaNeural', lang: 'pt-BR', gender: 'Female', label: 'Brenda' },
  { name: 'pt-BR-DonatoNeural', lang: 'pt-BR', gender: 'Male', label: 'Donato' },
  { name: 'pt-BR-ElzaNeural', lang: 'pt-BR', gender: 'Female', label: 'Elza' },
  { name: 'pt-BR-FabioNeural', lang: 'pt-BR', gender: 'Male', label: 'Fabio' },
  { name: 'pt-BR-GiovannaNeural', lang: 'pt-BR', gender: 'Female', label: 'Giovanna' },
  { name: 'pt-BR-HumbertoNeural', lang: 'pt-BR', gender: 'Male', label: 'Humberto' },
  { name: 'pt-BR-JulioNeural', lang: 'pt-BR', gender: 'Male', label: 'Julio' },
  { name: 'pt-BR-LeilaNeural', lang: 'pt-BR', gender: 'Female', label: 'Leila' },
  { name: 'pt-BR-LeticiaNeural', lang: 'pt-BR', gender: 'Female', label: 'Leticia' },
  { name: 'pt-BR-ManuelaNeural', lang: 'pt-BR', gender: 'Female', label: 'Manuela' },
  { name: 'pt-BR-NicolauNeural', lang: 'pt-BR', gender: 'Male', label: 'Nicolau' },
  { name: 'pt-BR-ThalitaNeural', lang: 'pt-BR', gender: 'Female', label: 'Thalita' },
  { name: 'pt-BR-ValerioNeural', lang: 'pt-BR', gender: 'Male', label: 'Valerio' },
  { name: 'pt-BR-YaraNeural', lang: 'pt-BR', gender: 'Female', label: 'Yara' },

  { name: 'en-US-AriaNeural', lang: 'en-US', gender: 'Female', label: 'Aria' },
  { name: 'en-US-GuyNeural', lang: 'en-US', gender: 'Male', label: 'Guy' },
  { name: 'en-US-JennyNeural', lang: 'en-US', gender: 'Female', label: 'Jenny' },
  { name: 'en-US-ChristopherNeural', lang: 'en-US', gender: 'Male', label: 'Christopher' },
  { name: 'en-US-EricNeural', lang: 'en-US', gender: 'Male', label: 'Eric' },
  { name: 'en-US-MichelleNeural', lang: 'en-US', gender: 'Female', label: 'Michelle' },
  { name: 'en-US-RogerNeural', lang: 'en-US', gender: 'Male', label: 'Roger' },
  { name: 'en-US-SteffanNeural', lang: 'en-US', gender: 'Male', label: 'Steffan' },
  { name: 'en-US-AmberNeural', lang: 'en-US', gender: 'Female', label: 'Amber' },
  { name: 'en-US-AnaNeural', lang: 'en-US', gender: 'Female', label: 'Ana' },
  { name: 'en-US-BrandonNeural', lang: 'en-US', gender: 'Male', label: 'Brandon' },
  { name: 'en-US-CoraNeural', lang: 'en-US', gender: 'Female', label: 'Cora' },
  { name: 'en-US-DavisNeural', lang: 'en-US', gender: 'Male', label: 'Davis' },
  { name: 'en-US-ElizabethNeural', lang: 'en-US', gender: 'Female', label: 'Elizabeth' },
  { name: 'en-US-JacobNeural', lang: 'en-US', gender: 'Male', label: 'Jacob' },
  { name: 'en-US-JasonNeural', lang: 'en-US', gender: 'Male', label: 'Jason' },
  { name: 'en-US-MonicaNeural', lang: 'en-US', gender: 'Female', label: 'Monica' },
  { name: 'en-US-NancyNeural', lang: 'en-US', gender: 'Female', label: 'Nancy' },
  { name: 'en-US-SaraNeural', lang: 'en-US', gender: 'Female', label: 'Sara' },
  { name: 'en-US-TonyNeural', lang: 'en-US', gender: 'Male', label: 'Tony' },

  { name: 'es-ES-ElviraNeural', lang: 'es-ES', gender: 'Female', label: 'Elvira' },
  { name: 'es-ES-AlvaroNeural', lang: 'es-ES', gender: 'Male', label: 'Alvaro' },
  { name: 'es-ES-AbrilNeural', lang: 'es-ES', gender: 'Female', label: 'Abril' },
  { name: 'es-ES-ArnauNeural', lang: 'es-ES', gender: 'Male', label: 'Arnau' },
  { name: 'es-ES-DarioNeural', lang: 'es-ES', gender: 'Male', label: 'Dario' },
  { name: 'es-ES-EliasNeural', lang: 'es-ES', gender: 'Male', label: 'Elias' },
  { name: 'es-ES-EstrellaNeural', lang: 'es-ES', gender: 'Female', label: 'Estrella' },
  { name: 'es-ES-IreneNeural', lang: 'es-ES', gender: 'Female', label: 'Irene' },
  { name: 'es-MX-DaliaNeural', lang: 'es-MX', gender: 'Female', label: 'Dalia (MX)' },
  { name: 'es-MX-JorgeNeural', lang: 'es-MX', gender: 'Male', label: 'Jorge (MX)' },
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${randomUUID()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de vídeo ou áudio são permitidos.'));
    }
  },
});

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

function fileBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').toLowerCase();
  const host = req.get('host') || 'localhost:4000';
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}

// Upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  const root = fileBaseUrl(req);
  const fileUrl = `${root}/files/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// Serve files
app.use('/files', express.static(UPLOADS_DIR, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      res.setHeader('Content-Type', `video/${ext.slice(1)}`);
    } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
      res.setHeader('Content-Type', `audio/${ext.slice(1)}`);
    }
    res.setHeader('Accept-Ranges', 'bytes');
  },
}));

// Delete file
app.delete('/files/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// Convert uploaded WebM to MP4 (requires ffmpeg installed on server)
app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado para conversão.' });
  }
  const inputPath = path.join(UPLOADS_DIR, req.file.filename);
  const outName = `${randomUUID()}.mp4`;
  const outputPath = path.join(UPLOADS_DIR, outName);

  // Build ffmpeg args for compatibility
  const args = [
    '-y',
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-movflags', 'faststart',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath
  ];

  const ff = spawn('ffmpeg', args);
  let stderr = '';
  ff.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  ff.on('error', (err) => {
    console.error('ffmpeg spawn error:', err);
    // clean uploaded file
    try { fs.unlinkSync(inputPath); } catch {}
    return res.status(500).json({ error: 'Erro ao iniciar ffmpeg.', detail: String(err) });
  });

  ff.on('close', (code) => {
    // remove input file
    try { fs.unlinkSync(inputPath); } catch {}
    if (code !== 0) {
      console.error('ffmpeg failed:', code, stderr);
      return res.status(500).json({ error: 'Conversão falhou.', detail: stderr });
    }
    const root = fileBaseUrl(req);
    const fileUrl = `${root}/files/${outName}`;
    return res.json({ url: fileUrl, filename: outName });
  });
});

// --- Transcrição de áudio (extração de legenda do vídeo) via Whisper ---
/** Converte tempo para segundos: número ou string "HH:MM:SS.mmm" / "MM:SS.mmm" / "SS.mmm". */
function parseTimeToSeconds(val) {
  if (val == null) return NaN;
  const n = Number(val);
  if (Number.isFinite(n)) return n;
  const s = String(val).trim();
  if (!s) return NaN;
  const parts = s.replace(',', '.').split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const sec = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + sec;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const sec = parseFloat(parts[1]) || 0;
    return m * 60 + sec;
  }
  return parseFloat(parts[0]) || NaN;
}

function parseSrtToSegments(srtContent) {
  const segments = [];
  const blocks = srtContent.split(/\n\s*\n/).filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block.trim().split(/\n/);
    if (lines.length < 2) continue;
    const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d+)\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d+)/);
    if (!match) continue;
    const toSec = (h, m, s, ms) => parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms.slice(0, 3), 10) / 1000;
    const start = toSec(match[1], match[2], match[3], match[4]);
    const end = toSec(match[5], match[6], match[7], match[8]);
    const text = lines.slice(2).join(' ').trim();
    if (text) segments.push({ start, end, text });
  }
  return segments;
}

function tryBuildSegmentsFromWhisperJson(jsonObj) {
  if (!jsonObj) return null;
  const rawSegments = Array.isArray(jsonObj) ? jsonObj : (Array.isArray(jsonObj?.segments) ? jsonObj.segments : null);
  const words = [];
  if (rawSegments) {
    for (const s of rawSegments) {
      const segStart = parseTimeToSeconds(s?.start);
      const segEnd = parseTimeToSeconds(s?.end);
      const useSegStart = Number.isFinite(segStart);
      const useSegEnd = Number.isFinite(segEnd);
      const w = Array.isArray(s?.words) ? s.words : null;
      if (w?.length) {
        for (const wi of w) {
          const start = parseTimeToSeconds(wi?.start);
          const end = parseTimeToSeconds(wi?.end);
          const text = String(wi?.word ?? wi?.text ?? '').trim();
          if (!Number.isFinite(start) || !Number.isFinite(end) || !text) continue;
          words.push({
            start,
            end: Math.max(end, start),
            text,
            segmentStart: useSegStart ? segStart : start,
            segmentEnd: useSegEnd ? segEnd : end,
          });
        }
      } else {
        const segText = String(s?.text ?? s?.speech ?? '').trim();
        if (segText && useSegStart && useSegEnd && segStart < segEnd) {
          words.push({
            start: segStart,
            end: segEnd,
            text: segText,
            segmentStart: segStart,
            segmentEnd: segEnd,
          });
        }
      }
    }
  }

  if (words.length === 0) return null;
  words.sort((a, b) => a.start - b.start);

  // Agrupar palavras em blocos, quebrando em silêncios reais.
  const GAP_BREAK_SEC = 1.2; // gaps maiores que ~1.2s viram “pausa” (sem legenda)
  const out = [];
  let cur = null;
  for (const w of words) {
    if (!cur) {
      cur = { start: w.segmentStart ?? w.start, end: w.end, parts: [w.text] };
      continue;
    }
    const gap = Math.max(0, w.start - cur.end);
    if (gap >= GAP_BREAK_SEC) {
      out.push({ start: cur.start, end: cur.end, text: cur.parts.join(' ').trim() });
      cur = { start: w.segmentStart ?? w.start, end: w.end, parts: [w.text] };
    } else {
      cur.parts.push(w.text);
      cur.end = Math.max(cur.end, w.end);
    }
  }
  if (cur) out.push({ start: cur.start, end: cur.end, text: cur.parts.join(' ').trim() });

  const filtered = out.filter((s) => s.text);
  if (!filtered.length) return null;

  const MAX_SEGMENT_DURATION_SEC = 3.2;
  const shifted = filtered.map((s) => ({
    start: s.start,
    end: Math.min(s.end, s.start + MAX_SEGMENT_DURATION_SEC),
    text: s.text,
  }));
  return shifted;
}

app.post('/transcribe', express.json(), async (req, res) => {
  const url = req.body?.url;
  const start = Number(req.body?.start) ?? 0;
  const end = Number(req.body?.end);
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Envie { url } do vídeo (mesmo formato usado no editor).' });
  }
  const filename = filenameFromClipUrl(url);
  if (!filename) return res.status(400).json({ error: 'URL do vídeo inválida.' });
  const inputPath = path.resolve(UPLOADS_DIR, filename);
  const uploadsResolved = path.resolve(UPLOADS_DIR);
  const exists = fs.existsSync(inputPath);
  if (!inputPath.startsWith(uploadsResolved) || !exists) {
    console.warn('[transcribe] 404: procurando', inputPath, '| exists:', exists, '| uploadsDir:', uploadsResolved);
    return res.status(404).json({
      error: 'Arquivo de vídeo não encontrado no servidor.',
      detail: 'Use um vídeo que foi enviado por upload neste site (não use link externo). Ficheiro esperado: ' + filename,
    });
  }
  const startSec = Math.max(0, start);
  const durationSec = end != null && end > startSec ? end - startSec : undefined;
  const MAX_TRANSCRIBE_SEC = 180;
  const effectiveDuration = durationSec != null ? Math.min(durationSec, MAX_TRANSCRIBE_SEC) : MAX_TRANSCRIBE_SEC;
  if (durationSec != null && durationSec > MAX_TRANSCRIBE_SEC) {
    return res.status(400).json({
      error: 'Trecho demasiado longo para transcrição.',
      detail: `Use um trecho de até ${MAX_TRANSCRIBE_SEC / 60} minutos. O seu trecho tem ${(durationSec / 60).toFixed(1)} min. Corte o vídeo ou selecione uma parte mais curta.`,
    });
  }

  const runId = randomUUID();
  const audioPath = path.join(UPLOADS_DIR, `transcribe_${runId}.wav`);
  const toRemove = [audioPath];

  try {
    const ffArgs = ['-y', '-i', inputPath];
    if (startSec > 0) ffArgs.push('-ss', String(startSec));
    ffArgs.push('-t', String(effectiveDuration));
    ffArgs.push('-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', audioPath);
    await runFfmpeg(ffArgs);

    let nodewhisper;
    try {
      const mod = await import('nodejs-whisper');
      nodewhisper = mod.nodewhisper;
    } catch (e) {
      return res.status(503).json({
        error: 'Transcrição não disponível.',
        detail: 'Instale o pacote nodejs-whisper e baixe um modelo: npm i nodejs-whisper && npx nodejs-whisper download',
      });
    }

    const modelName = 'tiny';
    await nodewhisper(audioPath, {
      modelName,
      autoDownloadModelName: modelName,
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        outputInSrt: true,
        outputInJson: true,
        outputInJsonFull: true,
        wordTimestamps: false,
        wordTimestamps: true,
        timestamps_length: 5,
        splitOnWord: true,
      },
    });

    // Preferir JSON com timestamps por palavra (mais preciso) e derivar segmentos respeitando silêncios
    const jsonCandidates = [
      path.join(UPLOADS_DIR, path.basename(audioPath, '.wav') + '.json'),
      audioPath + '.json',
    ];
    for (const jp of jsonCandidates) {
      if (fs.existsSync(jp)) {
        toRemove.push(jp);
        try {
          const obj = JSON.parse(fs.readFileSync(jp, 'utf8'));
          const segs = tryBuildSegmentsFromWhisperJson(obj);
          if (segs && segs.length) {
            for (const p of toRemove) try { fs.unlinkSync(p); } catch {}
            return res.json({ segments: segs });
          }
        } catch {
          // fallback abaixo
        }
      }
    }

    let srtPath = path.join(UPLOADS_DIR, path.basename(audioPath, '.wav') + '.srt');
    if (!fs.existsSync(srtPath)) srtPath = audioPath + '.srt';
    if (!fs.existsSync(srtPath)) {
      for (const p of toRemove) try { fs.unlinkSync(p); } catch {}
      return res.status(500).json({ error: 'Whisper não gerou arquivo de legendas.' });
    }
    toRemove.push(srtPath);
    const srtContent = fs.readFileSync(srtPath, 'utf8');
    let segments = parseSrtToSegments(srtContent);
    // Fallback SRT: não aplicamos offset global aqui para não invadir silêncios.
    for (const p of toRemove) try { fs.unlinkSync(p); } catch {}
    return res.json({ segments });
  } catch (err) {
    for (const p of toRemove) try { fs.unlinkSync(p); } catch {}
    const msg = err?.message || String(err);
    return res.status(500).json({ error: 'Falha na transcrição.', detail: msg });
  }
});

// Export video from clips (trim + concat + filters + audio mix)
function filenameFromClipUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return path.basename(new URL(url).pathname);
    }
    return path.basename(url);
  } catch {
    return null;
  }
}

function runFfmpeg(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, opts);
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    ff.on('error', (e) => reject(e));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `exit ${code}`))));
  });
}

function buildVideoFilter(filterType, filterIntensity) {
  const type = String(filterType || 'none').toLowerCase();
  const pct = Math.max(0, Math.min(100, Number(filterIntensity) || 100)) / 100;
  if (type === 'none' || pct <= 0) return null;
  switch (type) {
    case 'grayscale':
      return 'format=gray';
    case 'sepia':
      return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
    case 'invert':
      return 'negate';
    case 'blur': {
      const r = Math.max(1, Math.round(pct * 8));
      return `boxblur=${r}:${r}`;
    }
    case 'blur-bg-band':
    case 'blur-bg-band-h':
    case 'blur-bg-band-v':
      return null;
    default:
      return null;
  }
}

// Mapa estilo de legenda -> opções para FFmpeg drawtext (fontcolor, fontsize, borderw, bordercolor)
const CAPTION_DRAWTEXT = {
  karaoke: { fontcolor: '0x22c55e', fontsize: 28, borderw: 2, bordercolor: 'white' },
  'deep-diver': { fontcolor: '0x9ca3af', fontsize: 22, borderw: 0, bordercolor: 'black' },
  popline: { fontcolor: 'white', fontsize: 26, borderw: 0, bordercolor: 'black' },
  'seamless-bounce': { fontcolor: '0x22c55e', fontsize: 28, borderw: 0, bordercolor: 'black' },
  beasty: { fontcolor: 'white', fontsize: 26, borderw: 2, bordercolor: 'black' },
  youshaei: { fontcolor: '0x22c55e', fontsize: 26, borderw: 0, bordercolor: 'black' },
  mozi: { fontcolor: 'white', fontsize: 26, borderw: 2, bordercolor: '0x22c55e' },
  glitch: { fontcolor: '0xea580c', fontsize: 26, borderw: 0, bordercolor: 'black' },
  'baby-earthquake': { fontcolor: '0xe5e7eb', fontsize: 22, borderw: 0, bordercolor: 'black' },
};

function escapeDrawtext(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

function buildDrawtextFilter(captionText, captionStyle) {
  const text = String(captionText || '').trim();
  if (!text) return null;
  const styleId = String(captionStyle || 'none').toLowerCase();
  if (styleId === 'none') return null;
  const opts = CAPTION_DRAWTEXT[styleId] || CAPTION_DRAWTEXT.beasty;
  const escaped = escapeDrawtext(text);
  const parts = [
    `text='${escaped}'`,
    `fontsize=${opts.fontsize}`,
    `fontcolor=${opts.fontcolor}`,
    `x=(w-text_w)/2`,
    `y=h-th-40`,
  ];
  if (opts.borderw > 0) {
    parts.push(`borderw=${opts.borderw}`, `bordercolor=${opts.bordercolor}`);
  }
  return 'drawtext=' + parts.join(':');
}

function buildDrawtextFilterWithEnable(captionText, captionStyle, startSec, endSec) {
  const base = buildDrawtextFilter(captionText, captionStyle);
  if (!base) return null;
  return `${base}:enable='between(t,${Number(startSec).toFixed(2)},${Number(endSec).toFixed(2)})'`;
}

app.post('/export', express.json(), async (req, res) => {
  const clips = req.body?.clips;
  const audioTracks = Array.isArray(req.body?.audioTracks) ? req.body.audioTracks : [];
  if (!Array.isArray(clips) || clips.length === 0) {
    return res.status(400).json({ error: 'Envie um array clips com { url, start, end }.' });
  }

  const toRemove = [];
  const runId = randomUUID();

  try {
    // 1) Video segments (with optional filter, no audio for now)
    const segmentPaths = [];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const url = c?.url;
      const start = Number(c?.start);
      const end = Number(c?.end);
      const duration = Math.max(0.001, end - start);
      const filename = filenameFromClipUrl(url);
      if (!filename) {
        return res.status(400).json({ error: `Clip vídeo ${i + 1}: URL inválida.` });
      }
      const inputPath = path.join(UPLOADS_DIR, filename);
      if (!inputPath.startsWith(UPLOADS_DIR) || !fs.existsSync(inputPath)) {
        return res.status(404).json({ error: `Arquivo não encontrado: ${filename}` });
      }
      const segName = `vseg_${runId}_${i}.mp4`;
      const segPath = path.join(UPLOADS_DIR, segName);
      toRemove.push(segPath);

      let vf = buildVideoFilter(c?.filterType, c?.filterIntensity);
      const captionStyle = String(c?.captionStyle || 'none').toLowerCase();
      const captionSegments = Array.isArray(c?.captionSegments) ? c.captionSegments : [];
      if (captionSegments.length > 0 && captionStyle !== 'none') {
        const drawtexts = captionSegments
          .filter((s) => s?.text && typeof s.start === 'number' && typeof s.end === 'number')
          .map((s) => buildDrawtextFilterWithEnable(s.text, captionStyle, s.start, s.end))
          .filter(Boolean);
        if (drawtexts.length > 0) {
          const dt = drawtexts.join(',');
          vf = vf ? `${vf},${dt}` : dt;
        }
      } else {
        const captionText = (c?.captionText || '').trim();
        if (captionText && captionStyle !== 'none') {
          const dt = buildDrawtextFilter(captionText, captionStyle);
          if (dt) vf = vf ? `${vf},${dt}` : dt;
        }
      }
      const args = ['-y', '-ss', String(start), '-t', String(duration), '-i', inputPath];
      if (vf) args.push('-vf', vf);
      args.push('-an', segPath);
      await runFfmpeg(args);
      segmentPaths.push(segPath);
    }

    // 2) Concat video segments
    const listPath = path.join(UPLOADS_DIR, `concat_${runId}.txt`);
    toRemove.push(listPath);
    const listContent = segmentPaths
      .map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');
    const videoOnlyPath = path.join(UPLOADS_DIR, `video_only_${runId}.mp4`);
    toRemove.push(videoOnlyPath);
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', videoOnlyPath]);

    const timelineDuration = clips.reduce((acc, c) => acc + Math.max(0, Number(c?.end) - Number(c?.start)), 0);

    // 3) Build audio mix: video clip audios (or silence if muted) + audio track clips
    const audioSegments = []; // { path, delayMs }
    let vidAcc = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const duration = Math.max(0.001, Number(c?.end) - Number(c?.start));
      const delayMs = Math.round(vidAcc * 1000);
      vidAcc += duration;
      if (c?.muted) {
        const silencePath = path.join(UPLOADS_DIR, `silence_${runId}_${i}.wav`);
        toRemove.push(silencePath);
        await runFfmpeg([
          '-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
          '-t', String(duration), '-acodec', 'pcm_s16le', silencePath
        ]);
        audioSegments.push({ path: silencePath, delayMs });
      } else {
        const filename = filenameFromClipUrl(c?.url);
        if (filename) {
          const inputPath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(inputPath)) {
            const segPath = path.join(UPLOADS_DIR, `aseg_v_${runId}_${i}.wav`);
            toRemove.push(segPath);
            await runFfmpeg([
              '-y', '-ss', String(c.start), '-t', String(duration), '-i', inputPath,
              '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', segPath
            ]);
            audioSegments.push({ path: segPath, delayMs });
          }
        }
      }
    }
    for (const tr of audioTracks) {
      if (tr?.muted) continue;
      for (const cl of tr?.clips || []) {
        if (cl?.muted) continue;
        const filename = filenameFromClipUrl(cl?.url);
        if (!filename) continue;
        const inputPath = path.join(UPLOADS_DIR, filename);
        if (!fs.existsSync(inputPath)) continue;
        const duration = Math.max(0.001, Number(cl.end) - Number(cl.start));
        const delayMs = Math.round(Number(cl.offset || 0) * 1000);
        const segPath = path.join(UPLOADS_DIR, `aseg_a_${runId}_${randomUUID()}.wav`);
        toRemove.push(segPath);
        await runFfmpeg([
          '-y', '-ss', String(cl.start), '-t', String(duration), '-i', inputPath,
          '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', segPath
        ]);
        audioSegments.push({ path: segPath, delayMs });
      }
    }

    // 4) Mix all audio with adelay + amix
    let mixedAudioPath = null;
    if (audioSegments.length > 0) {
      mixedAudioPath = path.join(UPLOADS_DIR, `mixed_${runId}.aac`);
      toRemove.push(mixedAudioPath);
      const inputs = audioSegments.flatMap((s) => ['-i', s.path]);
      const filterParts = audioSegments.map((s, i) => `[${i}:a]adelay=${s.delayMs}|${s.delayMs}[a${i}]`);
      const mixInputs = audioSegments.map((_, i) => `[a${i}]`).join('');
      const filterComplex = filterParts.join(';') + ';' + mixInputs + `amix=inputs=${audioSegments.length}:duration=longest:dropout_transition=0[aout]`;
      await runFfmpeg(['-y', ...inputs, '-filter_complex', filterComplex, '-map', '[aout]', '-acodec', 'aac', '-b:a', '192k', mixedAudioPath]);
    }

    // 5) Mux video + audio (or video only)
    const outName = `export_${randomUUID()}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outName);
    if (mixedAudioPath && fs.existsSync(mixedAudioPath)) {
      await runFfmpeg([
        '-y', '-i', videoOnlyPath, '-i', mixedAudioPath,
        '-c:v', 'copy', '-c:a', 'aac', '-shortest', outputPath
      ]);
    } else {
      await runFfmpeg(['-y', '-i', videoOnlyPath, '-c', 'copy', outputPath]);
    }

    for (const p of toRemove) {
      try { fs.unlinkSync(p); } catch {}
    }

    const root = fileBaseUrl(req);
    const fileUrl = `${root}/files/${outName}`;
    return res.json({ url: fileUrl, filename: outName });
  } catch (err) {
    for (const p of toRemove) {
      try { fs.unlinkSync(p); } catch {}
    }
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Exportação no servidor falhou.', detail: String(err.message || err) });
  }
});

// ── TTS ──

let cachedVoices = null;

async function loadEdgeVoices() {
  if (cachedVoices) return cachedVoices;
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-US-AriaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const raw = await tts.getVoices();
    tts.close();
    cachedVoices = raw.map((v) => ({
      name: v.ShortName,
      lang: v.Locale,
      gender: v.Gender,
      label: v.FriendlyName.replace(/Microsoft\s+/i, '').replace(/\s+Online.*$/i, ''),
    }));
  } catch {
    cachedVoices = TTS_VOICES;
  }
  return cachedVoices;
}

app.get('/tts/voices', async (req, res) => {
  const voices = await loadEdgeVoices();
  const lang = req.query.lang;
  if (lang) {
    const prefix = String(lang).split('-')[0];
    const filtered = voices.filter(
      (v) => v.lang === String(lang) || v.lang.startsWith(prefix),
    );
    return res.json(filtered);
  }
  res.json(voices);
});

app.post('/tts', async (req, res) => {
  const { text, voice } = req.body;
  if (!text?.trim() || !voice) {
    return res.status(400).json({ error: 'text e voice são obrigatórios.' });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const escaped = escapeXml(text);
    const { audioFilePath } = await tts.toFile(UPLOADS_DIR, escaped);

    const filename = `${randomUUID()}.mp3`;
    const finalPath = path.join(UPLOADS_DIR, filename);
    fs.renameSync(audioFilePath, finalPath);

    const root = fileBaseUrl(req);
    const fileUrl = `${root}/files/${filename}`;
    res.json({ url: fileUrl, filename });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Erro ao gerar áudio TTS.' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uploads: fs.readdirSync(UPLOADS_DIR).length });
});

app.listen(PORT, () => {
  console.log(`EasyView Server rodando em http://localhost:${PORT}`);
});
