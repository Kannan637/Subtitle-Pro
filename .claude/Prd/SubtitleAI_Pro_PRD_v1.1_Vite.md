# SubtitleAI Pro

**AI-Powered Multilingual Subtitle Platform**

---

> **MVP Blueprint · Go-to-Market Plan · Product Requirements Document**

| Version | Date | Status | Audience |
|---------|------|--------|----------|
| 1.1 — Vite Edition | June 2025 | Draft → Review | Internal / Investors |

> ⚡ **TECHNOLOGY UPDATE:** Frontend migrated from **Next.js 14 → Vite 5 + React 18 (SPA)**. See [§1.3](#13-mvp-technical-architecture) for full rationale and comparison.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Part 1 — Minimum Viable Product (MVP)](#part-1--minimum-viable-product-mvp)
  - [1.1 MVP Philosophy](#11-mvp-philosophy)
  - [1.2 MVP Feature Set](#12-mvp-feature-set)
  - [1.3 MVP Technical Architecture](#13-mvp-technical-architecture)
  - [1.4 MVP User Flow](#14-mvp-user-flow)
  - [1.5 MVP Success Metrics](#15-mvp-success-metrics)
  - [1.6 MVP Timeline](#16-mvp-timeline)
- [Part 2 — Go-to-Market Plan](#part-2--go-to-market-plan)
  - [2.1 Target Segments](#21-target-segments)
  - [2.2 Pricing Architecture](#22-pricing-architecture)
  - [2.3 Acquisition Channels](#23-acquisition-channels)
  - [2.4 Competitive Landscape](#24-competitive-landscape)
  - [2.5 Financial Projections](#25-financial-projections-18-months)
- [Part 3 — Product Requirements Document](#part-3--product-requirements-document-prd)
  - [3.1 Product Vision & Goals](#31-product-vision--goals)
  - [3.2 User Personas](#32-user-personas)
  - [3.3 Functional Requirements](#33-functional-requirements)
  - [3.4 Non-Functional Requirements](#34-non-functional-requirements)
  - [3.5 API Specification](#35-api-specification-v1)
  - [3.6 Data Models](#36-data-models)
  - [3.7 QA & Testing Requirements](#37-quality-assurance--testing-requirements)
  - [3.8 Security & Compliance](#38-security--compliance-requirements)
  - [3.9 Engineering Team Structure](#39-engineering-team-structure)
  - [3.10 Post-MVP Roadmap](#310-roadmap--post-mvp-phases)
- [Appendix](#appendix)

---

## Executive Summary

SubtitleAI Pro is a web-based, AI-powered platform that converts any audio or video content into professional, multilingual subtitles in minutes. It targets the entire content spectrum — from individual YouTube creators to major film studios — making broadcast-grade subtitle production accessible, fast, and affordable.

- 🌍 **Market Opportunity:** $1.68B global subtitle/captioning market (2024), growing at 14.3% CAGR
- 🎯 **Primary Target:** Content creators, streaming platforms, media studios, corporates, eLearning
- 🚀 **GTM Strategy:** Freemium → SaaS tiers → Enterprise contracts
- 💡 **Differentiator:** One platform for upload-to-publish, from YouTube Shorts to 4K feature films

| Dimension | Problem Today | SubtitleAI Pro Solution |
|-----------|--------------|------------------------|
| **Speed** | Days to weeks for professional subs | Minutes via AI transcription + translation |
| **Cost** | $5–$20 per minute of video | Subscription from $19/month |
| **Languages** | Limited by human translator availability | 100+ languages via LLM + neural MT |
| **Accuracy** | Human error, inconsistency | 98%+ WER accuracy with AI QA |
| **Scale** | Bottleneck at agency capacity | Unlimited parallel processing |
| **Formats** | Manual export per platform | Auto-export SRT, VTT, ASS, TTML, EBU-STL |

---

## Part 1 — Minimum Viable Product (MVP)

*Build fast. Validate assumptions. Ship value.*

---

### 1.1 MVP Philosophy

The MVP focuses on one core job: **upload a video/audio file, get back accurate subtitles in your chosen language(s), review and edit inline, and download in a standard format.**

The **Vite + React SPA** architecture ensures the editor experience is fast, fluid, and immediately responsive without server round-trips. Everything else is post-MVP.

---

### 1.2 MVP Feature Set

| Feature | MVP Scope | Priority | Status |
|---------|-----------|----------|--------|
| File Upload (MP4/MP3/WAV/MOV/MKV/AVI/WebM) | Up to 2 GB per file | P0 | ✅ IN |
| YouTube URL Import | Paste URL → auto-download via yt-dlp | P0 | ✅ IN |
| AI Transcription (Speech-to-Text) | Whisper large-v3 / Deepgram Nova-2 | P0 | ✅ IN |
| Speaker Diarization | Up to 8 speakers | P0 | ✅ IN |
| Auto Language Detection | Source language auto-detect + confidence score | P0 | ✅ IN |
| Translation to 50+ Languages | Neural MT (DeepL / GPT-4o) | P0 | ✅ IN |
| Inline Subtitle Editor | Timeline + text edit, sync adjust, waveform | P0 | ✅ IN |
| Export: SRT, VTT, TXT | Standard formats | P0 | ✅ IN |
| User Auth (Email + Google) | JWT + Supabase Auth | P0 | ✅ IN |
| Credit-based Free Tier | 60 mins/month free | P0 | ✅ IN |
| Stripe Payment Integration | Monthly & yearly plans | P0 | ✅ IN |
| Export: ASS/SSA, TTML | Advanced formats | P1 | ✅ IN |
| Batch Upload (up to 10 files) | Queue processing | P1 | ✅ IN |
| Project Folders | Organize subtitles by project | P1 | ✅ IN |
| Burn-in Subtitles (hardcode) | Download MP4 with baked subs | P2 | 🔜 POST-MVP |
| Real-time Collaboration | Multi-user editing | P2 | 🔜 POST-MVP |
| Custom Vocabulary / Glossary | Domain-specific terms (Studio+) | P2 | 🔜 POST-MVP |
| API Access | Programmatic integration | P2 | 🔜 POST-MVP |
| Mobile App | iOS/Android | P3 | 🔜 POST-MVP |
| EBU-STL / Broadcast Formats | TV broadcast grade | P3 | 🔜 POST-MVP |

---

### 1.3 MVP Technical Architecture

The MVP uses a modern, scalable cloud-native architecture. The **key change** from the original spec is the replacement of Next.js with **Vite 5 + React 18** as a pure SPA.

SubtitleAI Pro is a highly interactive, client-side editor that gains no meaningful benefit from SSR/SSG, but gains significantly from Vite's build speed, simplicity, and developer experience.

#### 1.3.1 Why Vite over Next.js

| Dimension | Next.js (Previous) | Vite + React (New) | Rationale |
|-----------|-------------------|-------------------|-----------|
| **Build Speed** | 15–60s cold builds | <3s cold, <50ms HMR | ~10× faster developer iteration |
| **Bundle Size** | SSR runtime overhead included | Tree-shaken SPA bundle only | Smaller payload, faster Time-to-Interactive |
| **Complexity** | SSR/SSG config overhead | Simple SPA — no server rendering needed | Subtitle app is fully client-interactive |
| **Deployment** | Vercel-optimized serverless | Any static host (Cloudflare Pages, S3+CDN) | Lower hosting cost, no vendor lock-in |
| **API Separation** | Mixed frontend/backend in one repo | Clean SPA + dedicated tRPC API server | Clearer boundary, easier backend scaling |
| **DX Tooling** | Webpack under the hood (slower) | ESBuild + Rollup (native speed) | TypeScript/hot reload near-instant |

#### 1.3.2 Full Technology Stack

| Layer | Technology / Service | Change Notes |
|-------|---------------------|-------------|
| **Frontend** | Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui | ⚡ CHANGED from Next.js 14 |
| **Routing** | React Router v6 (client-side SPA routing) | ⚡ CHANGED from App Router |
| **Build Tooling** | Vite 5 (ESBuild + Rollup) — lightning-fast HMR & builds | ⚡ CHANGED from Next.js bundler |
| **Backend API** | Node.js / Express + tRPC for type-safe API layer | Unchanged |
| **AI Transcription** | OpenAI Whisper large-v3 (primary) + Deepgram Nova-2 (fallback) | Unchanged |
| **AI Translation** | DeepL API (EU compliance) + GPT-4o for context-aware translation | Unchanged |
| **Job Queue** | BullMQ + Redis — async processing with retry logic | Unchanged |
| **File Storage** | AWS S3 with pre-signed URLs + CloudFront CDN | Unchanged |
| **Database** | PostgreSQL (Supabase) — users, projects, subtitle data | Unchanged |
| **Auth** | Supabase Auth — email/password + OAuth (Google, GitHub) | Unchanged |
| **Payments** | Stripe Billing — subscriptions + usage-based overages | Unchanged |
| **Video Processing** | FFmpeg on AWS Lambda — extract audio, burn-in subs | Unchanged |
| **Deployment** | Cloudflare Pages (frontend SPA) + AWS ECS Fargate (backend) | ⚡ CHANGED: Vercel → Cloudflare Pages |
| **Monitoring** | Sentry (errors) + PostHog (analytics) + Datadog (infra) | Unchanged |

---

### 1.4 MVP User Flow

| Step | User Action & System Response |
|------|------------------------------|
| **1. Onboard** | Sign up free → 60 min credit granted → Dashboard opens (SPA instant load) |
| **2. Upload** | Upload file or paste YouTube URL → system extracts audio via FFmpeg |
| **3. Transcribe** | Select source language (or auto-detect) → Whisper processes → raw transcript ready |
| **4. Translate** | Choose 1 or more target languages → DeepL/GPT-4o translates segment by segment |
| **5. Review** | Inline editor shows timeline + waveform + text → adjust timing, fix errors, merge/split cues |
| **6. Export** | Choose format (SRT/VTT/ASS/TTML) → instant download → optionally share link |
| **7. Upgrade** | Credit exhausted → Stripe checkout → plan unlocked → continue |

---

### 1.5 MVP Success Metrics

| Metric | Target (End of Month 3) | Measurement Method |
|--------|------------------------|--------------------|
| Registered Users | 5,000+ | Database count |
| Free → Paid Conversion | ≥ 6% | Stripe events / total signups |
| Transcription Accuracy (WER) | ≤ 8% Word Error Rate | Monthly sample QA tests |
| Processing Speed | 1 min video processed < 90 sec | Job queue timestamps |
| User Retention (Week 2) | ≥ 35% | PostHog cohort analysis |
| NPS Score | ≥ 45 | In-app survey (Typeform) |
| Churn Rate (MoM) | ≤ 5% | Stripe MRR tracking |
| Frontend Build Time | < 3 sec (Vite HMR < 50ms) | CI/CD pipeline metrics |

---

### 1.6 MVP Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 0 — Setup** | Week 1–2 | Repo, CI/CD (Vite build), cloud infra, auth skeleton, Tailwind design system |
| **Phase 1 — Core Pipeline** | Week 3–6 | Upload, Whisper transcription, basic SPA editor, SRT export |
| **Phase 2 — Translation** | Week 7–9 | DeepL integration, multi-language output, VTT/ASS export |
| **Phase 3 — Monetisation** | Week 10–11 | Stripe subscriptions, credit system, upgrade flows |
| **Phase 4 — Polish + Launch** | Week 12 | Bug bash, performance tuning, landing page, Product Hunt |
| **Phase 5 — Iterate** | Month 4+ | Batch upload, project folders, API v1, enterprise pilots |

---

## Part 2 — Go-to-Market Plan

*Acquisition, pricing, channels, and growth levers.*

---

### 2.1 Target Segments

| Segment | Profile | Use Case | Willingness to Pay |
|---------|---------|----------|--------------------|
| **Indie Creators** | YouTubers, podcasters, TikTok | Accessibility + global reach | Low–Medium ($9–29/mo) |
| **SMB Media Teams** | Agencies, PR firms, studios | Client deliverables at scale | Medium ($49–149/mo) |
| **eLearning Platforms** | Udemy instructors, LMS admins | Course accessibility compliance | Medium–High ($99–299/mo) |
| **Corporate L&D** | HR, training departments | Employee training compliance | High ($299–999/mo) |
| **Streaming / OTT** | SVOD platforms, broadcasters | Localization pipeline | Enterprise ($3k–50k/mo) |
| **Film / Post Production** | Indie films to studios | DCP, broadcast delivery | Enterprise ($5k+/mo) |

---

### 2.2 Pricing Architecture

Credit-based freemium with flat subscription tiers for predictability, plus usage overages and enterprise custom contracts.

| Plan | **Free** | **Creator $19/mo** | **Studio $79/mo** | **Enterprise** |
|------|---------|-------------------|------------------|---------------|
| Minutes/month | 60 min | 300 min | 1,500 min | Unlimited |
| Languages | 3 | 20 | 100+ | 100+ |
| File size | 500 MB | 2 GB | 10 GB | 50 GB+ |
| Export formats | SRT, VTT | SRT, VTT, ASS, TXT | All + TTML | All + EBU-STL |
| Speakers | 2 | 8 | Unlimited | Unlimited |
| Batch upload | — | 5 files | 50 files | Unlimited |
| API access | — | — | Read-only | Full API |
| Team seats | 1 | 1 | 5 | Custom SSO |
| Support | Community | Email 48h | Priority 12h | Dedicated CSM |
| Overage rate | — | $0.10/min | $0.07/min | Custom SLA |

---

### 2.3 Acquisition Channels

| Channel | Tactics | Expected CAC |
|---------|---------|-------------|
| **SEO / Content** | Subtitle guides, language comparison articles, how-to videos targeting 'how to add subtitles' (200K/mo searches) | $8–15 |
| **Product Hunt Launch** | Day-1 hunt with video demo, AppSumo LTD deal for early traction + reviews | $5–12 |
| **YouTube Influencers** | Sponsor 20–50 mid-tier tech/creator channels; tutorial integrations | $18–35 |
| **Community Marketing** | Reddit r/NewTubers, r/videography, Discord creator servers | $5–10 |
| **Partnership / Integration** | Zapier, Make.com, Notion, CapCut, DaVinci Resolve plugin | $0–5 |
| **Cold Outbound (B2B)** | LinkedIn Sales Nav targeting post-production supervisors, L&D managers | $60–150 |
| **Google Ads (Brand)** | Protect brand terms; competitor comparison keywords | $20–40 |
| **Referral Program** | Give 15 min per referral, get 15 min — viral loop incentive | $3–8 |

---

### 2.4 Competitive Landscape

| Competitor | Strength | Weakness | SubtitleAI Edge |
|-----------|---------|---------|----------------|
| **Rev.com** | Human accuracy, brand trust | Expensive ($1.50/min), slow | 10× cheaper, 60× faster |
| **Kapwing** | All-in-one editor, creator focus | Subtitle quality inconsistent | Dedicated subtitle QA + 100 languages |
| **Subly** | Clean UX, subtitle-first | No enterprise / broadcast formats | EBU-STL, TTML, API, studio-grade |
| **Otter.ai** | Real-time transcription | Translation weak, no video | Video-native, full translation pipeline |
| **Adobe Premiere** | Industry standard NLE | No AI subtitles natively | Deep integration via plugin |
| **Google Video AI** | Accuracy, scale | No editor, no translation | End-to-end pipeline with UX |

---

### 2.5 Financial Projections (18 Months)

| Period | Free Users | Paid Users | MRR |
|--------|-----------|-----------|-----|
| Month 1 | 500 | 30 (6%) | $570 |
| Month 3 | 5,000 | 350 | $9,450 |
| Month 6 | 18,000 | 1,440 | $52,000 |
| Month 9 | 45,000 | 3,800 | $158,000 |
| Month 12 | 90,000 | 8,100 | $340,000 |
| Month 18 | 200,000 | 20,000 | $900,000 |

- 💰 **ARR Target @ Month 12:** ~$4.1M
- 📈 **Blended ARPU (Month 12):** ~$42/month
- 🎯 **Gross Margin Target:** 72% (after AI compute + Stripe fees)
- 🔥 **Break-even:** Month 8–9 (assuming $150K seed infrastructure spend)

---

## Part 3 — Product Requirements Document (PRD)

*Full specification for design, engineering, and QA.*

---

### 3.1 Product Vision & Goals

**Vision:** Make professional multilingual subtitles as easy as uploading a file — for everyone from a solo YouTube creator to a Hollywood post-production house.

**Mission:** Remove the language barrier from all video content on the internet through AI.

**North Star Metric:** Minutes of video successfully subtitled per month across all users.

---

### 3.2 User Personas

| Persona | Description & Key Needs |
|---------|------------------------|
| 🎬 **Creator Clara** | 25-year-old YouTube tech reviewer. Posts weekly. Needs English + Spanish + Hindi subs fast. Not technical. Needs zero learning curve, clean UX. |
| 🏢 **Agency Alex** | Post-production manager at a 15-person media agency. Manages 50+ projects/month. Needs batch processing, team collaboration, client delivery exports. |
| 🎓 **Educator Emma** | Online course creator on Teachable. Legal requirement to caption all course videos. Needs accurate technical vocabulary, auto-publish to platform. |
| 🎞 **Film Director Faisal** | Indie filmmaker preparing film for festival distribution. Needs SRT + TTML + DCP-compatible subtitle formats, color/font styling for cinema. |
| 🏦 **Enterprise Ethan** | L&D lead at a Fortune 500. 300 training videos/year. Needs SSO, audit logs, SCORM/xAPI subtitle embed, enterprise SLA, dedicated support. |

---

### 3.3 Functional Requirements

#### 3.3.1 Authentication & Account Management

| Req ID | Requirement |
|--------|------------|
| AUTH-01 | Users can register with email/password. Password must be 8+ chars, 1 uppercase, 1 symbol. |
| AUTH-02 | OAuth login via Google (mandatory) and GitHub (optional). |
| AUTH-03 | JWT access tokens expire in 15 min; refresh tokens in 7 days stored in httpOnly cookie. |
| AUTH-04 | Email verification required before first upload. |
| AUTH-05 | 2FA via TOTP (Google Authenticator) available on all paid plans. |
| AUTH-06 | Enterprise plans support SAML 2.0 SSO. |
| AUTH-07 | Users can delete account + all data (GDPR right to erasure, 30-day soft delete). |

#### 3.3.2 File Ingestion & Media Processing

| Req ID | Requirement |
|--------|------------|
| MEDIA-01 | Accept upload formats: MP4, MOV, MKV, AVI, WebM, MP3, WAV, AAC, FLAC, OGG, M4A. |
| MEDIA-02 | Upload via browser (multipart) up to 2 GB (free/creator) or 10 GB (studio/enterprise). |
| MEDIA-03 | Resume interrupted uploads using TUS protocol (tusd server or S3 multipart). |
| MEDIA-04 | YouTube URL import: validate URL → yt-dlp download → auto-ingest pipeline. |
| MEDIA-05 | System extracts audio track from video using FFmpeg within 30 seconds of upload. |
| MEDIA-06 | Generate video thumbnail and duration metadata shown in project card. |
| MEDIA-07 | Virus scan all uploads using ClamAV before processing. |
| MEDIA-08 | Files deleted from S3 after 90 days (free) / 365 days (paid) to manage storage costs. |

#### 3.3.3 Transcription Engine

| Req ID | Requirement |
|--------|------------|
| TRANS-01 | Primary STT: OpenAI Whisper large-v3. Fallback: Deepgram Nova-2 on API error. |
| TRANS-02 | Automatic source language detection (confidence score displayed, manual override allowed). |
| TRANS-03 | Speaker diarization: identify and label up to 8 distinct speakers. |
| TRANS-04 | Output: word-level timestamps, confidence scores, raw transcript JSON stored in DB. |
| TRANS-05 | Timestamps rounded to 10ms precision. Max cue duration: 7 seconds. Max line chars: 42. |
| TRANS-06 | Processing SLA: ≤ 2× video duration (10-min video ready in ≤ 20 min). Target: ≤ 1.5×. |
| TRANS-07 | Background music, applause, ambient noise labeled as `[MUSIC]`, `[APPLAUSE]`, etc. |
| TRANS-08 | Profanity filter (on by default, user-toggleable). |

#### 3.3.4 Translation Engine

| Req ID | Requirement |
|--------|------------|
| TRL-01 | Primary translation: DeepL API for EU/formal languages. GPT-4o for context-heavy/rare languages. |
| TRL-02 | Support 100+ target languages with ISO 639-1 codes, including RTL (Arabic, Hebrew, Persian, Urdu). |
| TRL-03 | Preserve subtitle timing metadata exactly when translating (only text changes). |
| TRL-04 | Translation at segment level (not word-by-word) to preserve natural phrasing. |
| TRL-05 | Custom glossary: users can define up to 500 term pairs (domain-specific vocabulary). Studio+ plans. |
| TRL-06 | Translation tone selector: Formal / Neutral / Casual (applied as GPT-4o system prompt). |
| TRL-07 | Machine translation quality score shown per language pair (BLEU/COMET metric). |
| TRL-08 | Retranslate individual segments without affecting others. |

#### 3.3.5 Subtitle Editor

| Req ID | Requirement |
|--------|------------|
| EDIT-01 | Video player with subtitle overlay synchronized to editor timeline below. |
| EDIT-02 | Timeline shows waveform + subtitle cue blocks; drag to move, resize handles to adjust in/out points. |
| EDIT-03 | Text editing: click any cue to edit. Support for bold, italic, underline, line break. |
| EDIT-04 | Split cue (`Cmd/Ctrl+Enter`) and merge adjacent cues (select both + merge button). |
| EDIT-05 | Find and replace across all cues in a subtitle track. |
| EDIT-06 | Keyboard shortcuts: `Space` (play/pause), `← →` (frame step), `Tab` (next cue), `Shift+Tab` (prev cue). |
| EDIT-07 | Auto-fix tool: detects cues exceeding reading speed (>20 CPS), overlapping timing, or blank cues. |
| EDIT-08 | Side-by-side comparison mode: original language + translated side by side. |
| EDIT-09 | Version history: auto-save every 30s; user can revert to any of last 20 saves. |
| EDIT-10 | Style editor: font, size, color, background opacity, vertical position (for accessibility or cinema). |

#### 3.3.6 Export & Distribution

| Req ID | Requirement |
|--------|------------|
| EXP-01 | Export formats: SRT, VTT, ASS/SSA, TXT, TTML 1.0, EBU-STL (TF-2/3), DFXP, SBV, LRC. |
| EXP-02 | Hardcoded/burn-in: render subtitles into MP4 file using FFmpeg (Studio+ plans). Output up to 4K 60fps. |
| EXP-03 | Batch export: select multiple projects and download as ZIP in chosen format. |
| EXP-04 | Shareable review link: generate public read-only link with embedded player + subtitles. |
| EXP-05 | Direct publish: YouTube (Data API v3), Vimeo, Wistia integrations (Studio+ plans). |
| EXP-06 | API endpoint: `POST /v1/projects/{id}/export` returns subtitle file as binary stream. |
| EXP-07 | Character encoding: UTF-8 default; support for UTF-16 and ANSI for legacy broadcast tools. |

---

### 3.4 Non-Functional Requirements

> Includes updated Vite-specific performance targets.

| Category | Requirement | Target / SLA |
|----------|------------|-------------|
| Performance | API p95 response time (non-AI) | < 200ms |
| Performance | File upload throughput | > 50 MB/s per user |
| Performance | SPA First Contentful Paint (Vite) | < 1.2 sec *(improved from 1.5s)* |
| Performance | Vite Hot Module Replacement | < 50ms (dev mode) |
| Availability | Platform uptime SLA | 99.9% (< 8.7h/year downtime) |
| Availability | AI processing queue availability | 99.5% |
| Scalability | Concurrent transcription jobs | 1,000+ simultaneous |
| Scalability | Storage scalability | Petabyte-scale via S3 |
| Security | Data encryption at rest | AES-256 (S3 SSE-KMS) |
| Security | Data encryption in transit | TLS 1.3 minimum |
| Security | OWASP Top 10 compliance | Quarterly pentest |
| Compliance | GDPR / CCPA ready | DPA available, data residency EU option |
| Accessibility | Platform UI accessibility | WCAG 2.1 AA |
| Browser Support | Supported browsers | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Mobile | Responsive web UI | Fully functional on tablet; view-only on mobile |

---

### 3.5 API Specification (v1)

The public REST API enables enterprise integrations, plugin development, and automation. All endpoints require **Bearer token** authentication.

| Endpoint | Method + Path | Description |
|---------|--------------|-------------|
| Upload Media | `POST /v1/media/upload` | Upload audio/video file; returns `media_id` |
| Import URL | `POST /v1/media/import` | Body: `{url, type:'youtube'}` → returns `media_id` |
| Create Job | `POST /v1/jobs` | Body: `{media_id, source_lang, target_langs[]}` → `job_id` |
| Get Job Status | `GET /v1/jobs/{job_id}` | Returns status: `queued\|processing\|complete\|error` |
| Get Subtitles | `GET /v1/subtitles/{job_id}` | Returns subtitle cues as JSON array |
| Export Subtitles | `GET /v1/export/{job_id}?format=srt` | Returns binary subtitle file |
| List Projects | `GET /v1/projects` | Paginated list of user projects |
| Delete Project | `DELETE /v1/projects/{id}` | Soft delete + schedules file removal |
| Webhook Register | `POST /v1/webhooks` | Register URL for job completion events |

---

### 3.6 Data Models

| Entity | Key Fields |
|--------|-----------|
| **User** | `id`, `email`, `name`, `plan_id`, `credits_remaining`, `created_at`, `last_login`, `is_verified` |
| **Project** | `id`, `user_id`, `name`, `media_url`, `duration_sec`, `status`, `created_at`, `updated_at` |
| **MediaFile** | `id`, `project_id`, `s3_key`, `original_filename`, `size_bytes`, `format`, `audio_s3_key` |
| **TranscriptionJob** | `id`, `project_id`, `status`, `model_used`, `source_lang`, `wer_score`, `started_at`, `completed_at` |
| **SubtitleTrack** | `id`, `project_id`, `language_code`, `is_original`, `created_by` (ai/human), `version` |
| **SubtitleCue** | `id`, `track_id`, `start_ms`, `end_ms`, `text`, `speaker_id`, `confidence`, `line_position` |
| **TranslationJob** | `id`, `track_id`, `target_language`, `model_used`, `bleu_score`, `status` |
| **CreditLedger** | `id`, `user_id`, `type` (debit/credit), `amount_sec`, `reference`, `created_at` |
| **Subscription** | `id`, `user_id`, `stripe_sub_id`, `plan`, `status`, `current_period_end`, `cancel_at` |

---

### 3.7 Quality Assurance & Testing Requirements

| Test Type | Scope | Acceptance Criteria |
|-----------|-------|-------------------|
| Unit Tests | All service functions, utility functions, data transformers | ≥ 85% code coverage |
| Integration Tests | API endpoints, database queries, external API mocks | 100% endpoint coverage |
| E2E Tests (Playwright) | Full upload → transcribe → translate → export flow | 0 regressions on core flows |
| Load Testing (k6) | 500 concurrent users uploading and processing | p99 < 3s, 0% error rate |
| AI Accuracy QA | Monthly benchmark on 50 diverse test files per language | WER ≤ 8%, BLEU ≥ 0.78 |
| Security Pentest | OWASP ZAP automated + quarterly manual pentest | No critical/high vulns shipped |
| Accessibility Audit | axe-core automated + manual screen reader test | 0 WCAG 2.1 AA violations |
| Browser Compatibility | Chrome, Firefox, Safari, Edge — Windows + macOS | 100% feature parity |
| **Vite Build Validation** | CI verifies Vite build output, chunk sizes, source maps | Build < 3s, no console errors |

---

### 3.8 Security & Compliance Requirements

| Requirement | Details |
|------------|---------|
| Data Privacy | GDPR (EU), CCPA (CA), PDPA (India) compliance. DPA signed with all sub-processors. |
| Data Residency | EU data residency option for Studio+ plans (AWS `eu-west-1` isolated tenant). |
| AI Data Usage | User content is **NEVER** used to train AI models. Explicit policy in ToS. |
| Audit Logs | All user actions logged with timestamp, IP, user-agent (enterprise plans: exportable). |
| Rate Limiting | API: 100 req/min (free), 1,000 req/min (paid). Upload: 5 concurrent jobs max. |
| Content Scanning | All uploads scanned for CSAM using PhotoDNA. NSFW detection on thumbnails. |
| Penetration Testing | Annual third-party pentest (HackerOne VDP). Bug bounty program on launch. |
| SOC 2 Type II | Target: SOC 2 Type II certification by Month 18 (required for enterprise sales). |
| **Frontend Security (Vite)** | CSP headers via Cloudflare, no SSR attack surface, subresource integrity on all assets. |

---

### 3.9 Engineering Team Structure

| Role | Responsibilities |
|------|----------------|
| **CTO / Lead Engineer** | Architecture decisions, infrastructure, AI pipeline, code review, Vite config |
| **Frontend Engineer ×2** | Vite + React 18 SPA, video player component, editor timeline, Tailwind design system |
| **Backend Engineer ×2** | API layer, job queue, database schema, Stripe/auth integrations |
| **ML / AI Engineer** | Whisper optimization, translation quality, speaker diarization, benchmarking |
| **DevOps Engineer** | AWS infra (IaC with Terraform), CI/CD (GitHub Actions + Vite build), monitoring |
| **Product Designer** | UX research, wireframes, Figma design system, usability testing |
| **QA Engineer** | Test plans, Playwright E2E, load testing, accessibility audits, Vite build checks |
| **Product Manager** | Roadmap, PRD maintenance, stakeholder comms, analytics |

---

### 3.10 Roadmap — Post-MVP Phases

| Phase | Timeline | Features | Revenue Impact |
|-------|----------|---------|---------------|
| **v1.1 — Collaboration** | Month 4–5 | Multi-user editing, comments, approvals, team workspaces | Enables team plan upsell |
| **v1.2 — Integrations** | Month 5–6 | Zapier, Make, Slack notifications, YouTube auto-publish | Reduces churn, adds stickiness |
| **v1.3 — Enterprise** | Month 6–8 | SSO, SCIM, audit logs, dedicated tenant, SLA contracts | Unlock enterprise ARR |
| **v1.4 — Broadcast Grade** | Month 7–9 | EBU-STL, TTML, DCP, ASS advanced styling, Netflix TT | Film/TV market entry |
| **v1.5 — AI QA** | Month 8–10 | Auto-detect errors, reading speed violations, grammar check | Reduce support load |
| **v2.0 — Platform** | Month 10–12 | Full REST API, webhooks, SDK, marketplace for translators | Platform revenue layer |
| **v2.1 — Real-Time** | Month 12–15 | Live caption for Zoom/Teams/Webex, streaming ingestion (RTMP/HLS) | New live-event market |
| **v2.2 — Mobile** | Month 14–18 | iOS + Android apps, offline mode, camera capture → subtitles | Consumer market expansion |

---

## Appendix

### A.1 Glossary

| Term | Definition |
|------|-----------|
| **WER (Word Error Rate)** | % of words incorrect in transcript vs ground truth. Industry benchmark: < 8% for broadcast-grade. |
| **BLEU Score** | Bilingual Evaluation Understudy — 0-to-1 metric measuring translation quality vs human reference. |
| **SRT** | SubRip Text — most widely supported subtitle format (`.srt`). Plain text with sequence, timestamps, text. |
| **VTT / WebVTT** | Web Video Text Tracks — HTML5 native subtitle format. Supports styling metadata. |
| **ASS / SSA** | Advanced SubStation Alpha — rich subtitle format with font, position, animation control. Used in anime/cinema. |
| **TTML** | Timed Text Markup Language — W3C standard used for IPTV and streaming (Netflix uses IMSC1 subset). |
| **EBU-STL** | European Broadcasting Union Subtitle Format — binary format required for EU broadcast delivery. |
| **Diarization** | Process of identifying and labeling which speaker said what in a multi-speaker recording. |
| **Burn-in / Hardcode** | Subtitles permanently embedded into the video image, not a separate track. |
| **Cue** | A single subtitle unit: start time, end time, and display text. |
| **CPS (Chars per second)** | Standard measure of subtitle readability speed. Netflix standard: max 20 CPS. |
| **DCP** | Digital Cinema Package — industry standard for cinema playback, uses SMPTE TT for subtitles. |
| **Vite** | Next-generation frontend build tool using native ES modules + ESBuild for near-instant HMR. |
| **SPA** | Single-Page Application — client-rendered app; routing handled by React Router without a server. |

---

### A.2 Key Technology References

| Technology | Documentation / Resource | Notes |
|-----------|--------------------------|-------|
| **Vite 5** | vitejs.dev/guide | ⚡ CHANGED from Next.js |
| **React 18** | react.dev | — |
| **React Router v6** | reactrouter.com/en/main | ⚡ CHANGED from App Router |
| **OpenAI Whisper** | platform.openai.com/docs/guides/speech-to-text | — |
| **Deepgram Nova-2** | developers.deepgram.com | — |
| **DeepL API** | developers.deepl.com/docs | — |
| **FFmpeg** | ffmpeg.org/documentation.html | — |
| **BullMQ (Redis Queue)** | docs.bullmq.io | — |
| **Supabase** | supabase.com/docs | — |
| **Stripe Billing** | stripe.com/docs/billing | — |
| **AWS S3 + CloudFront** | docs.aws.amazon.com/s3 | — |
| **TUS (resumable uploads)** | tus.io | — |
| **Cloudflare Pages** | developers.cloudflare.com/pages | ⚡ CHANGED from Vercel |
| **EBU-STL Spec** | tech.ebu.ch/docs/tech/tech3264.pdf | — |
| **Netflix Timed Text Style Guide** | partnerhelp.netflixstudios.com | — |
| **WCAG 2.1 Guidelines** | w3.org/TR/WCAG21 | — |

---

*End of Document — SubtitleAI Pro MVP, Plan & PRD v1.1 (Vite Edition) — Confidential*
