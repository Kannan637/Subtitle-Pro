# ⚙️ Backend Developer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** Backend Developer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Tech Stack](#tech-stack)
3. [Environment Setup](#environment-setup)
4. [Project Structure](#project-structure)
5. [Core Services to Build](#core-services-to-build)
6. [Database Schema](#database-schema)
7. [API Design Standards](#api-design-standards)
8. [Job Queue Architecture](#job-queue-architecture)
9. [AI Pipeline Integration](#ai-pipeline-integration)
10. [Authentication & Authorization](#authentication--authorization)
11. [File Storage](#file-storage)
12. [Payment Integration](#payment-integration)
13. [Error Handling & Logging](#error-handling--logging)
14. [Testing](#testing)
15. [Git Workflow & Definition of Done](#git-workflow--definition-of-done)

---

## Role Overview

You are responsible for **all server-side logic** — REST API, job queue processing, AI pipeline orchestration, database design, authentication, billing, and third-party integrations. You work within **Antigravity's backend scaffold**, which provides service scaffolding, middleware, and deployment config.

**You own:**
- REST API (`/v1/*` endpoints)
- Background job processing (transcription + translation queues)
- Database schema, migrations, and query optimization
- Auth (JWT, OAuth, refresh token rotation)
- Stripe subscription & credit management
- AWS S3 file lifecycle + FFmpeg audio extraction
- Webhook system for enterprise integrations
- All third-party API integrations (Whisper, DeepL, GPT-4o, Deepgram)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | **Node.js 20** (LTS) |
| Framework | **Express.js** + **Antigravity** server scaffold |
| Language | **TypeScript** (strict) |
| API Layer | **tRPC** for internal type-safe RPC + REST for public API |
| ORM | **Prisma** with PostgreSQL |
| Database | **PostgreSQL 16** (via Supabase) |
| Cache / Queue | **Redis 7** (Upstash) + **BullMQ** |
| Auth | **Supabase Auth** (JWT + OAuth) |
| File Storage | **AWS S3** + **CloudFront** CDN |
| Video Processing | **FFmpeg** (AWS Lambda layer) |
| AI — STT | **OpenAI Whisper** large-v3 + **Deepgram** Nova-2 (fallback) |
| AI — Translation | **DeepL API** (primary) + **OpenAI GPT-4o** (fallback/rare langs) |
| Payments | **Stripe** (subscriptions + usage billing) |
| Email | **Resend** (transactional emails) |
| Monitoring | **Sentry** (errors) + **Datadog** (APM) + **Pino** (logging) |
| Testing | **Vitest** + **Supertest** + **Testcontainers** |

---

## Environment Setup

### Prerequisites
- Node.js 20+ (`nvm install 20`)
- pnpm 9+ (`npm install -g pnpm`)
- Docker Desktop (for local PostgreSQL + Redis)
- Antigravity CLI (`npm install -g @antigravity/cli`)
- AWS CLI configured with dev credentials

### Step-by-Step

```bash
# 1. Clone repo
git clone git@github.com:your-org/subtitleai-pro.git
cd subtitleai-pro/backend

# 2. Install dependencies
pnpm install

# 3. Start local services (Postgres + Redis)
docker-compose up -d

# 4. Copy and fill env vars
cp .env.example .env

# 5. Run database migrations
pnpm prisma migrate dev

# 6. Seed development data
pnpm db:seed

# 7. Start dev server via Antigravity
ag dev --service backend --port 4000
```

### Key Environment Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/subtitleai_dev"
REDIS_URL="redis://localhost:6379"

# Auth
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
JWT_SECRET="your-secret-min-32-chars"

# Storage
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="subtitleai-media-dev"
AWS_REGION="ap-south-1"
CLOUDFRONT_DOMAIN="https://d1234.cloudfront.net"

# AI APIs
OPENAI_API_KEY="sk-..."
DEEPGRAM_API_KEY="..."
DEEPL_API_KEY="..."

# Payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
RESEND_API_KEY="re_..."
```

---

## Project Structure

```
src/
├── api/
│   ├── routes/
│   │   ├── media.routes.ts       # Upload, import YouTube
│   │   ├── jobs.routes.ts        # Job CRUD + status
│   │   ├── subtitles.routes.ts   # Cue CRUD
│   │   ├── export.routes.ts      # Format exports
│   │   ├── projects.routes.ts    # Project management
│   │   ├── billing.routes.ts     # Stripe checkout, portal
│   │   ├── webhooks.routes.ts    # Stripe + user webhooks
│   │   └── auth.routes.ts        # Session refresh, profile
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT verification
│   │   ├── authorize.ts          # Plan-based access control
│   │   ├── rateLimit.ts          # Per-user rate limiting
│   │   ├── validate.ts           # Zod schema validation
│   │   └── errorHandler.ts       # Global error middleware
│   └── validators/               # Zod schemas per route
│
├── services/
│   ├── transcription/
│   │   ├── whisper.service.ts    # OpenAI Whisper calls
│   │   ├── deepgram.service.ts   # Deepgram fallback
│   │   └── diarization.service.ts
│   ├── translation/
│   │   ├── deepl.service.ts
│   │   ├── openai.service.ts     # GPT-4o translation
│   │   └── translation.service.ts # Orchestration
│   ├── media/
│   │   ├── ffmpeg.service.ts     # Audio extraction, burn-in
│   │   ├── s3.service.ts         # Upload, presigned URLs
│   │   └── ytdlp.service.ts      # YouTube download
│   ├── subtitle/
│   │   ├── parser.service.ts     # Parse SRT/VTT/ASS
│   │   ├── formatter.service.ts  # Export to all formats
│   │   └── validator.service.ts  # CPS, overlap, blank checks
│   ├── billing/
│   │   ├── stripe.service.ts
│   │   └── credits.service.ts    # Credit ledger logic
│   └── notification/
│       └── resend.service.ts
│
├── workers/
│   ├── transcription.worker.ts   # BullMQ worker
│   ├── translation.worker.ts
│   └── media.worker.ts           # FFmpeg processing worker
│
├── queues/
│   ├── transcription.queue.ts
│   ├── translation.queue.ts
│   └── media.queue.ts
│
├── db/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── seed.ts
│
├── lib/
│   ├── logger.ts                 # Pino logger
│   ├── redis.ts                  # Redis client singleton
│   ├── sentry.ts
│   └── constants.ts
│
└── types/
    ├── express.d.ts              # req.user type extension
    └── api.ts
```

---

## Database Schema

```prisma
// db/prisma/schema.prisma

model User {
  id                String        @id @default(cuid())
  email             String        @unique
  name              String?
  avatarUrl         String?
  plan              Plan          @default(FREE)
  creditsRemainingS Int           @default(1800) // 30 min in seconds
  isVerified        Boolean       @default(false)
  stripeCustomerId  String?       @unique
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  projects          Project[]
  subscriptions     Subscription[]
  creditLedger      CreditLedger[]
}

enum Plan { FREE CREATOR STUDIO ENTERPRISE }

model Project {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  status      JobStatus   @default(PENDING)
  durationSec Int?
  thumbnailUrl String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  mediaFiles  MediaFile[]
  jobs        Job[]
  tracks      SubtitleTrack[]
}

enum JobStatus { PENDING QUEUED PROCESSING COMPLETE ERROR }

model MediaFile {
  id               String   @id @default(cuid())
  projectId        String
  project          Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  s3Key            String
  audioS3Key       String?
  originalFilename String
  sizeBytes        BigInt
  format           String
  mimeType         String
  createdAt        DateTime @default(now())
}

model Job {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type        JobType
  status      JobStatus @default(QUEUED)
  modelUsed   String?
  errorMsg    String?
  metadata    Json?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
}

enum JobType { TRANSCRIPTION TRANSLATION MEDIA_PROCESSING BURN_IN }

model SubtitleTrack {
  id          String        @id @default(cuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  languageCode String
  isOriginal  Boolean       @default(false)
  createdBy   String        @default("ai")  // "ai" | "human"
  version     Int           @default(1)
  createdAt   DateTime      @default(now())
  cues        SubtitleCue[]

  @@unique([projectId, languageCode, version])
}

model SubtitleCue {
  id          String        @id @default(cuid())
  trackId     String
  track       SubtitleTrack @relation(fields: [trackId], references: [id], onDelete: Cascade)
  sequence    Int
  startMs     Int
  endMs       Int
  text        String
  speakerId   String?
  confidence  Float?
  linePosition String?      // "top" | "bottom" (default)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([trackId, startMs])
}

model CreditLedger {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // "debit" | "credit"
  amountS   Int      // seconds
  reference String?  // job_id, stripe_invoice_id, etc.
  createdAt DateTime @default(now())
}

model Subscription {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  stripeSubId       String   @unique
  plan              Plan
  status            String   // "active" | "canceled" | "past_due"
  currentPeriodEnd  DateTime
  cancelAtPeriodEnd Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## API Design Standards

### URL Conventions
```
GET    /v1/projects              → list user projects (paginated)
POST   /v1/projects              → create project
GET    /v1/projects/:id          → get single project
PATCH  /v1/projects/:id          → partial update
DELETE /v1/projects/:id          → soft delete

POST   /v1/media/upload          → initiate upload (returns presigned URL)
POST   /v1/media/import          → YouTube URL import

POST   /v1/jobs                  → create transcription/translation job
GET    /v1/jobs/:id              → get job + status
GET    /v1/jobs/:id/subtitles    → get subtitle cues for a job

PATCH  /v1/cues/:id              → update single cue
POST   /v1/cues/:trackId/split   → split a cue
POST   /v1/cues/merge            → merge two cues

GET    /v1/export/:trackId       → export subtitles (query: format)
```

### Response Envelope
```typescript
// Always wrap in this structure
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 42 }  // pagination only
}

// Errors
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "You have 0 seconds of credit remaining.",
    "details": {}
  }
}
```

### Standard HTTP Status Codes
| Code | When to Use |
|------|-------------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (created resource) |
| 204 | Successful DELETE (no body) |
| 400 | Validation error (Zod) |
| 401 | Missing or expired token |
| 403 | Valid token, insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state mismatch) |
| 422 | Business logic error (e.g., insufficient credits) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

---

## Job Queue Architecture

```
User uploads file
       │
       ▼
  MEDIA_PROCESSING queue (BullMQ)
  → FFmpeg extract audio → store audioS3Key → update Project
       │
       ▼
  TRANSCRIPTION queue (BullMQ)
  → call Whisper API → get word-level JSON
  → create SubtitleTrack (isOriginal=true)
  → create SubtitleCues in bulk
  → deduct user credits (job duration × 1s)
       │
       ▼
  TRANSLATION queue (BullMQ) — one job per target language
  → call DeepL / GPT-4o → create translated SubtitleTrack
  → update Job status = COMPLETE
  → fire webhook (if registered)
  → send email notification
```

**BullMQ config:**
```typescript
// queues/transcription.queue.ts
export const transcriptionQueue = new Queue('transcription', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
```

**Worker pattern:**
```typescript
// workers/transcription.worker.ts
export const transcriptionWorker = new Worker(
  'transcription',
  async (job: Job<TranscriptionJobData>) => {
    const { projectId, mediaFileId, sourceLang } = job.data;

    await job.updateProgress(10);
    const audioUrl = await s3Service.getPresignedUrl(audioS3Key);

    await job.updateProgress(30);
    const transcript = await whisperService.transcribe(audioUrl, sourceLang);

    await job.updateProgress(70);
    await subtitleService.createCuesFromTranscript(projectId, transcript);

    await job.updateProgress(90);
    await creditsService.debit(userId, durationSeconds);

    await job.updateProgress(100);
  },
  { connection: redisClient, concurrency: 10 }
);
```

---

## AI Pipeline Integration

### Whisper Transcription
```typescript
// services/transcription/whisper.service.ts
async transcribe(audioUrl: string, sourceLang?: string): Promise<TranscriptResult> {
  const formData = new FormData();
  formData.append('file', audioStream);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  if (sourceLang) formData.append('language', sourceLang);

  const response = await openai.audio.transcriptions.create(formData);
  return this.mapToTranscriptResult(response);
}
```

### DeepL Translation (segment-by-segment)
```typescript
async translateTrack(cues: SubtitleCue[], targetLang: string): Promise<SubtitleCue[]> {
  // Batch to max 50 segments per API call (DeepL limit: 128KB)
  const batches = chunk(cues, 50);

  const results = await Promise.all(batches.map(batch =>
    deepl.translateText(
      batch.map(c => c.text),
      null,           // auto-detect source
      targetLang as deepl.TargetLanguageCode,
      { tagHandling: 'xml', preserveFormatting: true }
    )
  ));

  return cues.map((cue, i) => ({
    ...cue,
    text: results.flat()[i].text,  // preserve all timing metadata
    id: cuid(),                    // new ID for translated cue
  }));
}
```

---

## Authentication & Authorization

**Middleware chain:**
```typescript
// Protect all /v1/* routes
router.use('/v1', authenticate, rateLimit);

// Plan-based access
router.post('/v1/export/burn-in', authorize(['STUDIO', 'ENTERPRISE']), exportController.burnIn);
```

**authenticate middleware:**
```typescript
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json(error('MISSING_TOKEN'));

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json(error('INVALID_TOKEN'));

  req.user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  next();
};
```

---

## File Storage

**Upload flow (presigned URL pattern):**
```
Frontend → POST /v1/media/upload → Backend generates S3 presigned PUT URL
Frontend → PUT directly to S3 (no backend bandwidth used)
Frontend → POST /v1/media/confirm → Backend reads S3 metadata, creates MediaFile record
Backend → enqueue MEDIA_PROCESSING job
```

**S3 key structure:**
```
media/{userId}/{projectId}/original/{filename}
media/{userId}/{projectId}/audio/extracted.mp3
media/{userId}/{projectId}/output/burned-{trackId}.mp4
subtitles/{userId}/{projectId}/{trackId}/{format}.srt
```

**File expiry policy (via S3 Lifecycle Rules):**
- Free tier: delete originals after 90 days
- Creator+: delete after 365 days
- Enterprise: no auto-delete (configurable)

---

## Payment Integration

**Credit system:**
- 1 credit = 1 second of video processed
- Free plan: 1,800 credits/month (30 min)
- Creator: 18,000 credits/month (300 min)
- Studio: 90,000 credits/month (1,500 min)
- Overage: deducted and billed at end of billing cycle

```typescript
// services/billing/credits.service.ts
async debit(userId: string, seconds: number, reference: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.creditsRemainingS < seconds && user.plan === 'FREE') {
    throw new AppError('INSUFFICIENT_CREDITS', 422);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditsRemainingS: { decrement: seconds } },
    }),
    prisma.creditLedger.create({
      data: { userId, type: 'debit', amountS: seconds, reference },
    }),
  ]);
}
```

---

## Error Handling & Logging

**Custom error class:**
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string
  ) {
    super(message ?? code);
  }
}
```

**Global error handler:**
```typescript
export const errorHandler = (err: Error, req: Request, res: Response) => {
  logger.error({ err, path: req.path, method: req.method });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
  }

  if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  }

  Sentry.captureException(err);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
};
```

**Logging with Pino:**
```typescript
logger.info({ jobId, userId, durationSec }, 'Transcription job completed');
logger.warn({ userId, creditsRemaining }, 'User approaching credit limit');
logger.error({ err, jobId }, 'Transcription job failed after 3 attempts');
```

---

## Testing

### Unit Tests
```bash
pnpm test                  # run all
pnpm test --coverage       # coverage (target: ≥ 85%)
```

Test these thoroughly:
- All service methods (mock external APIs with `vi.mock`)
- Credit debit/credit logic
- Subtitle parser/formatter for all formats (SRT, VTT, ASS)
- Cue split + merge logic
- Auth middleware

### Integration Tests (Supertest + Testcontainers)
```typescript
// Spin up real Postgres + Redis in Docker for integration tests
const container = await new PostgreSqlContainer().start();
```

Test all API endpoints end-to-end with real DB queries.

### Load Testing (k6)
```bash
ag test:load               # runs k6 script against staging
```

Target: 500 concurrent users, p99 < 3s, 0% error rate.

---

## Git Workflow & Definition of Done

Same branching strategy as frontend (`feature/*`, `fix/*`, `chore/*`).

**Backend PR checklist:**
- [ ] All new endpoints have Zod validation
- [ ] New DB tables have indexes on foreign keys + query fields
- [ ] Migrations are reversible (no destructive changes in same PR)
- [ ] Unit tests for all new service methods
- [ ] No `console.log` — use `logger.*`
- [ ] No hardcoded secrets — use `process.env`
- [ ] API response follows envelope format
- [ ] Rate limiting applied to new endpoints
- [ ] Reviewed by Tech Lead

**A backend task is DONE when:**
- [ ] Endpoint returns correct response for happy path + 3 error cases
- [ ] Integration test covers the route
- [ ] Sentry error tracking verified in staging
- [ ] Pino logs emitted for start/complete/error states
- [ ] API documented in Postman collection

---

> 📌 Questions? Ping `#backend` on Slack or tag `@backend-lead` in your PR.
> 🗄️ DB schema: [Prisma Studio](http://localhost:5555) (`pnpm prisma studio`)
> 📮 API collection: [Postman workspace link]
