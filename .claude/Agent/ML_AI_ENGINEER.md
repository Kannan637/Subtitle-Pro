# 🤖 ML / AI Engineer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** ML / AI Engineer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [AI Stack & Models](#ai-stack--models)
3. [Environment Setup](#environment-setup)
4. [Transcription Pipeline](#transcription-pipeline)
5. [Translation Pipeline](#translation-pipeline)
6. [Speaker Diarization](#speaker-diarization)
7. [Model Quality Benchmarking](#model-quality-benchmarking)
8. [Prompt Engineering Standards](#prompt-engineering-standards)
9. [Cost Optimization](#cost-optimization)
10. [Model Fallback Strategy](#model-fallback-strategy)
11. [Fine-tuning Roadmap](#fine-tuning-roadmap)
12. [Monitoring & Drift Detection](#monitoring--drift-detection)
13. [Definition of Done](#definition-of-done)

---

## Role Overview

You own the **intelligence layer** of SubtitleAI Pro — every AI/ML model, API integration, prompt, and quality metric. You are responsible for transcription accuracy, translation quality, cost per minute processed, and model reliability.

**You own:**
- Whisper transcription pipeline (API + self-hosted evaluation)
- Speaker diarization (pyannote.audio)
- DeepL + GPT-4o translation pipeline
- Language auto-detection
- Prompt engineering for GPT-4o translation
- Quality benchmarking (WER, BLEU, COMET)
- AI cost tracking and optimization
- Model fallback logic
- Fine-tuning research and roadmap

---

## AI Stack & Models

| Task | Primary Model | Fallback Model | Notes |
|------|--------------|----------------|-------|
| Speech-to-Text | OpenAI Whisper large-v3 (API) | Deepgram Nova-2 | Whisper: 98 languages; Nova-2: real-time capable |
| Translation (EU langs) | DeepL API v2 | GPT-4o | DeepL: higher BLEU for EU langs |
| Translation (rare langs) | GPT-4o | Google Translate API | Rare = < 5% of DeepL coverage |
| Translation (context-heavy) | GPT-4o with context prompt | DeepL | For film/drama dialogue |
| Speaker Diarization | pyannote/speaker-diarization-3.1 | Simple energy-based VAD | HuggingFace hosted |
| Language Detection | Whisper detect (first 30s) | langdetect (Python) | Whisper is more accurate on audio |
| Profanity Detection | OpenAI Moderation API | Custom wordlist | Applied to transcript output |

---

## Environment Setup

```bash
# Python environment for ML experimentation
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-ml.txt

# Node.js for service integration
cd backend && pnpm install

# Environment variables needed
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
DEEPL_API_KEY=...
HUGGINGFACE_TOKEN=hf_...    # for pyannote diarization
GOOGLE_TRANSLATE_KEY=...     # fallback only

# Run accuracy benchmarks locally
python scripts/benchmark_wer.py --corpus ./test-corpus/
python scripts/benchmark_bleu.py --corpus ./test-corpus/translations/
```

### Key Python Libraries

```
openai>=1.30.0
deepgram-sdk>=3.0.0
deepl>=1.18.0
pyannote.audio>=3.1.0
jiwer>=3.0.0          # WER computation
sacrebleu>=2.4.0      # BLEU score
comet-ml>=2.3.0       # COMET MT evaluation
librosa>=0.10.0       # Audio analysis
pydub>=0.25.0         # Audio manipulation
langdetect>=1.0.9
```

---

## Transcription Pipeline

### Architecture

```
Audio file (S3 URL)
      │
      ▼
Language Detection (Whisper first 30s)
      │
      ▼
Audio Chunking (if > 25MB → split into 10-min chunks)
      │
      ▼
Whisper API (verbose_json + word timestamps)
      │
      ▼
Post-processing:
  - Merge chunks → unified transcript
  - Remove hallucinations (detect repetitive loops)
  - Normalize punctuation
  - Apply profanity filter (if enabled)
      │
      ▼
Cue segmentation:
  - Max 7 seconds per cue
  - Max 42 characters per line
  - Max 2 lines per cue
  - Split at natural pause points (>500ms silence)
      │
      ▼
Store cues in PostgreSQL (bulk insert)
```

### Whisper API Call

```python
# services/transcription/whisper_service.py

async def transcribe(audio_path: str, source_lang: Optional[str] = None) -> TranscriptResult:
    with open(audio_path, 'rb') as audio_file:
        response = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"],
            language=source_lang,  # None = auto-detect
        )

    return TranscriptResult(
        text=response.text,
        language=response.language,
        words=[
            Word(word=w.word, start=w.start, end=w.end, confidence=1.0)
            for w in response.words
        ],
        segments=response.segments,
        duration=response.duration,
    )
```

### Cue Segmentation Algorithm

```python
def segment_to_cues(words: List[Word], max_duration=7.0, max_chars=42) -> List[Cue]:
    cues = []
    current_words = []
    current_start = None

    for word in words:
        if current_start is None:
            current_start = word.start

        # Check if adding this word would exceed limits
        proposed_text = ' '.join([w.word for w in current_words] + [word.word])
        duration = word.end - current_start

        if (duration > max_duration or len(proposed_text) > max_chars) and current_words:
            # Finalize current cue
            cues.append(Cue(
                start_ms=int(current_start * 1000),
                end_ms=int(current_words[-1].end * 1000),
                text=' '.join(w.word for w in current_words)
            ))
            current_words = [word]
            current_start = word.start
        else:
            current_words.append(word)

    # Don't forget last cue
    if current_words:
        cues.append(Cue(
            start_ms=int(current_start * 1000),
            end_ms=int(current_words[-1].end * 1000),
            text=' '.join(w.word for w in current_words)
        ))

    return cues
```

### Hallucination Detection

Whisper is known to hallucinate on silent sections. Detect and remove:

```python
HALLUCINATION_PATTERNS = [
    r'(Thank you\.?\s*){3,}',           # "Thank you. Thank you. Thank you."
    r'(Subtitles by .+\s*){2,}',       # Subtitle credits loop
    r'(.{10,})\1{2,}',                  # Any text repeated 3+ times
    r'^\s*\[.*\]\s*$',                  # Solo [Music] or [Applause] longer than 2s
]

def remove_hallucinations(cues: List[Cue]) -> List[Cue]:
    return [
        cue for cue in cues
        if not any(re.search(p, cue.text, re.IGNORECASE) for p in HALLUCINATION_PATTERNS)
    ]
```

---

## Translation Pipeline

### Model Selection Logic

```python
def select_translation_model(source_lang: str, target_lang: str, context: str = "general") -> str:
    DEEPL_SUPPORTED = {'EN', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'PL', 'RU', 'JA', 'ZH', 'KO'}

    if target_lang.upper() in DEEPL_SUPPORTED and context != "cinematic":
        return "deepl"

    # Rare languages or cinematic context → GPT-4o
    return "gpt-4o"
```

### GPT-4o Translation Prompt

```python
TRANSLATION_SYSTEM_PROMPT = """
You are a professional subtitle translator. Translate the provided subtitle cues from {source_lang} to {target_lang}.

CRITICAL RULES:
1. Return ONLY a JSON array of translated strings, in the same order as input
2. Match the register and tone of the original (formal/casual/technical)
3. Keep translations CONCISE — subtitles have reading speed limits (max 20 chars/sec)
4. Preserve speaker nuances, emotions, and cultural references
5. For proper nouns, brand names, and technical terms: keep original unless a standard translation exists
6. Do NOT add or remove cues — translate exactly N inputs to N outputs
7. Tone: {tone}

Custom glossary terms to always use:
{glossary_terms}
"""

async def translate_with_gpt4o(cues: List[str], source_lang: str, target_lang: str,
                                 tone: str = "neutral", glossary: dict = {}) -> List[str]:
    glossary_str = "\n".join([f"- {k} → {v}" for k, v in glossary.items()]) or "None"

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": TRANSLATION_SYSTEM_PROMPT.format(
                source_lang=source_lang, target_lang=target_lang,
                tone=tone, glossary_terms=glossary_str
            )},
            {"role": "user", "content": json.dumps(cues)}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,  # Low temperature for consistency
    )

    result = json.loads(response.choices[0].message.content)
    return result["translations"]
```

### Batching Strategy

```python
# DeepL: max 128KB per request, max 50 texts
# GPT-4o: max ~200 cues per call (token limit)

def batch_cues(cues: List[str], model: str) -> List[List[str]]:
    batch_size = 50 if model == "deepl" else 100
    return [cues[i:i+batch_size] for i in range(0, len(cues), batch_size)]
```

---

## Speaker Diarization

```python
# services/diarization/diarize.py
from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=os.environ["HUGGINGFACE_TOKEN"]
)
pipeline.to(torch.device("cuda" if torch.cuda.is_available() else "cpu"))

def diarize(audio_path: str, max_speakers: int = 8) -> List[SpeakerSegment]:
    diarization = pipeline(
        audio_path,
        max_speakers=max_speakers,
        min_speakers=1
    )

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append(SpeakerSegment(
            start=turn.start,
            end=turn.end,
            speaker_id=speaker  # "SPEAKER_00", "SPEAKER_01", etc.
        ))

    return segments

def assign_speakers_to_cues(cues: List[Cue], segments: List[SpeakerSegment]) -> List[Cue]:
    """Assign speaker label to each cue based on overlap with diarization segments."""
    for cue in cues:
        cue_start = cue.start_ms / 1000
        cue_end = cue.end_ms / 1000

        # Find speaker with most overlap in this cue's time range
        speaker_overlaps = defaultdict(float)
        for seg in segments:
            overlap = min(cue_end, seg.end) - max(cue_start, seg.start)
            if overlap > 0:
                speaker_overlaps[seg.speaker_id] += overlap

        if speaker_overlaps:
            cue.speaker_id = max(speaker_overlaps, key=speaker_overlaps.get)

    return cues
```

---

## Model Quality Benchmarking

### WER Benchmark Script

```python
# scripts/benchmark_wer.py
from jiwer import wer, cer
import json, os

def run_wer_benchmark(corpus_dir: str) -> dict:
    results = {}

    for test_file in os.listdir(corpus_dir):
        if not test_file.endswith('.json'):
            continue

        with open(f"{corpus_dir}/{test_file}") as f:
            data = json.load(f)

        reference = data['reference_transcript']
        hypothesis = transcribe_file(data['audio_url'])  # calls Whisper

        results[test_file] = {
            'wer': wer(reference, hypothesis),
            'cer': cer(reference, hypothesis),
            'language': data['language'],
            'duration_min': data['duration_seconds'] / 60,
        }

    return results

# Run: python scripts/benchmark_wer.py --corpus ./test-corpus/
# Output saved to: reports/wer-YYYY-MM-DD.json
```

### BLEU / COMET Score Benchmark

```python
# scripts/benchmark_bleu.py
import sacrebleu
from comet import download_model, load_from_checkpoint

def run_bleu_benchmark(corpus_dir: str, lang_pairs: List[tuple]) -> dict:
    results = {}

    for src_lang, tgt_lang in lang_pairs:
        test_data = load_translation_corpus(corpus_dir, src_lang, tgt_lang)

        hypotheses = translate_batch(test_data['sources'], src_lang, tgt_lang)

        bleu = sacrebleu.corpus_bleu(hypotheses, [test_data['references']])
        results[f"{src_lang}-{tgt_lang}"] = {
            'bleu': bleu.score,
            'sample_count': len(test_data['sources'])
        }

    return results
```

### Benchmark Schedule

| Benchmark | Frequency | Alert Condition |
|-----------|-----------|-----------------|
| WER (English clear audio) | Weekly (CI) | > 8% |
| WER (noisy/accented audio) | Monthly | > 15% |
| BLEU (EN→ES, EN→FR) | Monthly | < 0.78 |
| BLEU (EN→HI, EN→AR) | Monthly | < 0.70 |
| Cost per minute transcribed | Weekly | > $0.006/min |
| Translation cost per 1K chars | Weekly | > $0.02/1K chars |

---

## Prompt Engineering Standards

### Rules for All GPT-4o Prompts

1. **Always specify output format** — use `response_format: json_object` or explicit schema
2. **Temperature:** 0.1–0.3 for translation (deterministic); 0 for classification
3. **Seed:** Use fixed seed for benchmark reproducibility: `seed=42`
4. **Max tokens:** Always set to avoid runaway costs
5. **Version prompts:** Store in `prompts/v1/translation_system.txt` (not hardcoded)
6. **Test before deploy:** Any prompt change requires BLEU re-benchmark

### Prompt Version Control

```
prompts/
├── v1/
│   ├── translation_system.txt
│   ├── translation_user.txt
│   └── CHANGELOG.md
└── v2/               ← under development
    └── translation_system.txt
```

---

## Cost Optimization

### Current Cost Per Minute of Video (Target: < $0.01/min)

| Operation | Model | Cost per min | Notes |
|-----------|-------|-------------|-------|
| Transcription | Whisper API | $0.006/min | ($0.006 per minute) |
| Translation (DeepL) | DeepL | ~$0.0003/min | ~400 chars/min subtitle text |
| Translation (GPT-4o) | GPT-4o | ~$0.003/min | Only for rare/cinematic |
| Diarization | pyannote (self-hosted GPU) | ~$0.002/min | EC2 g4dn.xlarge = $0.526/hr |
| **Total (typical)** | — | **~$0.009/min** | |

### Optimization Strategies

1. **Cache transcriptions:** Store transcript JSON in S3. Never re-transcribe same file hash.
2. **DeepL > GPT-4o for EU languages:** DeepL is 10× cheaper and 5–10% better BLEU for EU pairs.
3. **Batch translations:** Group cues into max-size batches to minimize API round trips.
4. **Self-host Whisper for Studio+ users:** At scale, self-hosted Whisper on GPU is ~60% cheaper.
5. **Compress audio before sending:** Downsample to 16kHz mono before Whisper (same accuracy, 4× smaller).

```python
# Compress audio before Whisper (saves 70% on file transfer + API costs)
def compress_for_whisper(input_path: str, output_path: str) -> str:
    AudioSegment.from_file(input_path) \
        .set_channels(1) \
        .set_frame_rate(16000) \
        .export(output_path, format='mp3', bitrate='32k')
    return output_path
```

---

## Model Fallback Strategy

```python
# services/transcription/transcription_service.py

async def transcribe_with_fallback(audio_url: str, lang: str = None) -> TranscriptResult:
    try:
        result = await whisper_service.transcribe(audio_url, lang)
        metrics.increment('transcription.whisper.success')
        return result

    except (OpenAIRateLimitError, OpenAIAPIError) as e:
        logger.warning(f"Whisper failed: {e}. Falling back to Deepgram.")
        metrics.increment('transcription.whisper.fallback')

        try:
            return await deepgram_service.transcribe(audio_url, lang)
        except DeepgramError as e2:
            logger.error(f"Both STT providers failed: {e2}")
            metrics.increment('transcription.all_failed')
            raise TranscriptionError("All transcription providers unavailable")
```

### Fallback Decision Matrix

| Error Type | Action |
|------------|--------|
| Rate limit (429) | Exponential backoff (3 retries), then Deepgram |
| API timeout (>60s) | Retry once, then Deepgram |
| Server error (5xx) | Immediate Deepgram fallback |
| File format unsupported | FFmpeg convert + retry |
| Audio too short (<1s) | Return empty transcript |
| Audio silent | Flag as [SILENCE], return empty |

---

## Fine-tuning Roadmap

### Phase 1 (Month 6–9): Domain Vocabulary
- Fine-tune Whisper on domain-specific datasets:
  - Medical: clinical trial recordings
  - Legal: court transcript recordings
  - Tech: developer conference talks
- Expected WER improvement: 15–25% in domain

### Phase 2 (Month 9–12): Custom Translation Models
- Fine-tune NLLB-200 on subtitle-specific parallel corpus
- Subtitle data has different requirements: shorter sentences, timing constraints, colloquial language
- Source: OpenSubtitles corpus (62GB) + proprietary user corrections

### Phase 3 (Month 12+): Quality AI
- Train classifier to auto-detect cue quality issues
- Auto-suggest fixes for: reading speed, line length, timing overlap
- Dataset: user editor corrections on SubtitleAI Pro platform

---

## Monitoring & Drift Detection

### Real-time AI Metrics (Datadog)

Track per job:
- `ai.transcription.wer_estimate` — (approximated from confidence scores)
- `ai.transcription.duration_ratio` — processing time / audio duration
- `ai.translation.bleu_estimate`
- `ai.whisper.confidence_avg` — average word confidence
- `ai.cost.per_minute` — actual API cost per video minute

### Drift Alert

```python
# If WER estimate degrades week-over-week by > 5%, alert ML team
if current_week_avg_wer > previous_week_avg_wer * 1.05:
    alert("ML_ACCURACY_DRIFT", severity="P2",
          message=f"WER degraded from {previous_week_avg_wer:.2%} to {current_week_avg_wer:.2%}")
```

---

## Definition of Done

An ML/AI task is **done** when:
- [ ] New model/prompt tested on full benchmark corpus
- [ ] WER / BLEU scores meet or exceed baseline
- [ ] Cost per minute of video processed documented
- [ ] Fallback logic implemented and tested
- [ ] Changes deployed to staging and verified
- [ ] Cost impact reported to Tech Lead
- [ ] Benchmark results committed to `reports/` directory
- [ ] Prompt changes versioned under `prompts/vN/`

---

> 📌 Questions? Ping `#ml-ai` on Slack or tag `@ml-lead`.
> 📊 Benchmark reports: `s3://subtitleai-qa/benchmarks/`
> 🤗 Models: `huggingface.co/subtitleai`
> 💰 AI cost tracker: [Datadog dashboard link]
