# 🏗️ Tech Lead / Architect Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** Tech Lead / Solution Architect | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Architectural Principles](#architectural-principles)
3. [Full System Architecture](#full-system-architecture)
4. [Technology Decision Log (ADRs)](#technology-decision-log-adrs)
5. [Inter-service Communication](#inter-service-communication)
6. [Coding Standards & Conventions](#coding-standards--conventions)
7. [API Contract Governance](#api-contract-governance)
8. [Database Design Decisions](#database-design-decisions)
9. [Security Architecture](#security-architecture)
10. [Scalability Milestones](#scalability-milestones)
11. [Tech Debt Registry](#tech-debt-registry)
12. [Code Review Standards](#code-review-standards)
13. [Onboarding Engineers](#onboarding-engineers)

---

## Role Overview

You are the technical authority for SubtitleAI Pro. You set architectural direction, make technology decisions, define coding standards, unblock engineers, conduct code reviews, and ensure the codebase remains healthy and scalable as the team and product grow.

**You own:**
- Overall system architecture and design
- Architecture Decision Records (ADRs)
- Coding standards and review standards
- API contract governance (no breaking changes without review)
- Tech debt tracking and prioritization
- Cross-team technical alignment (FE ↔ BE ↔ ML ↔ DevOps)
- Engineering hiring bar and technical interviews
- Mentoring and growing the engineering team

**You do NOT own:**
- Product roadmap or feature prioritization (→ Product Manager)
- Sprint velocity or ticket tracking (→ Project Manager)
- Cloud cost approval beyond existing budget (→ CEO/CTO)

---

## Architectural Principles

1. **Boring technology wins.** Choose well-understood, well-documented tools over trendy ones. New !== Better.

2. **Async by default for AI workloads.** AI calls (Whisper, DeepL, GPT-4o) are slow and expensive. Never block the request thread. All AI processing goes through BullMQ.

3. **Stateless API layer.** API servers hold no state. State lives in PostgreSQL (durable) and Redis (ephemeral). This enables horizontal scaling without session affinity.

4. **Fail gracefully.** Every AI call has a fallback. Every job has retries with exponential backoff. Users see progress and errors — never silent failures.

5. **Security by default.** Principle of least privilege everywhere. No public S3 buckets. No secrets in code. Auth on every API route.

6. **Design for 10× growth.** Build for the current load, but ensure the architecture can handle 10× without a rewrite. Add read replicas, queue workers, and CDN caching before you need them.

7. **Explicit over implicit.** TypeScript strict mode. Zod schema validation. Named exports. Explicit return types on public functions.

8. **Document decisions, not just code.** Use ADRs for every significant choice. Engineers 6 months from now will thank you.

---

## Full System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                     │
│                                                                           │
│  Browser (Next.js 14 on Vercel)                                          │
│  ├── App Router pages (SSR for SEO pages, CSR for dashboard/editor)      │
│  ├── TanStack Query (server state / caching)                             │
│  ├── Zustand (editor client state)                                       │
│  └── WebSocket / SSE (job status updates)                                │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                 │
│                                                                           │
│  AWS ALB + WAF v2                                                        │
│  ├── Rate limiting (100 RPM free / 1000 RPM paid)                       │
│  ├── WAF rules (SQLi, XSS, rate abuse)                                  │
│  └── TLS termination                                                      │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER (ECS Fargate)                    │
│                                                                           │
│  API Service (3 tasks min, auto-scale)                                   │
│  ├── Express + tRPC                                                      │
│  ├── Supabase Auth middleware                                            │
│  ├── Prisma ORM → PostgreSQL                                             │
│  ├── BullMQ job producer                                                 │
│  └── Stripe webhook consumer                                             │
│                                                                           │
│  Worker Services (separate ECS task families)                            │
│  ├── Media Worker: FFmpeg audio extraction                               │
│  ├── Transcription Worker: Whisper/Deepgram calls                       │
│  └── Translation Worker: DeepL/GPT-4o calls                             │
└───────┬──────────────────────────────────────┬───────────────────────────┘
        │                                       │
        ▼                                       ▼
┌───────────────────┐              ┌────────────────────────────┐
│   DATA LAYER      │              │      QUEUE LAYER            │
│                   │              │                             │
│  RDS PostgreSQL   │              │  Upstash Redis (BullMQ)    │
│  (Multi-AZ prod)  │              │  ├── media:processing       │
│                   │              │  ├── transcription:jobs     │
│  S3 (media files  │              │  └── translation:jobs       │
│   + subtitle      │              │                             │
│   exports)        │              └────────────────────────────┘
│                   │
│  CloudFront CDN   │
│  (media delivery) │
└───────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL AI SERVICES                                 │
│                                                                           │
│  OpenAI (Whisper API + GPT-4o)                                           │
│  Deepgram (Nova-2 — STT fallback)                                        │
│  DeepL (translation primary)                                             │
│  pyannote.audio (speaker diarization — self-hosted GPU optional)         │
│  Stripe (payments + webhooks)                                            │
│  Resend (transactional email)                                            │
│  Supabase Auth (JWT + OAuth)                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Decision Log (ADRs)

### ADR-001: Next.js App Router over Pages Router
- **Date:** 2025-01
- **Decision:** Use Next.js 14 App Router
- **Rationale:** RSC reduce JS bundle for marketing pages; layouts simplify dashboard shell; better streaming support for job status updates
- **Trade-offs:** App Router is newer; team needs ramp-up. Mitigation: Pages Router remains option for isolated complex pages.

### ADR-002: BullMQ over SQS for job queue
- **Date:** 2025-01
- **Decision:** BullMQ + Redis (Upstash)
- **Rationale:** Rich job management UI, retry logic, priority queues, delayed jobs out of the box. SQS requires more custom code.
- **Trade-offs:** Redis is another dependency. Upstash serverless Redis removes ops burden.

### ADR-003: Prisma over raw SQL or Drizzle
- **Date:** 2025-01
- **Decision:** Prisma ORM
- **Rationale:** TypeScript-first, excellent DX, migrations tooling, Prisma Studio for debugging. Team familiarity.
- **Trade-offs:** Slightly less control over complex queries. Use `$queryRaw` for performance-critical joins.

### ADR-004: Supabase Auth over Auth.js (NextAuth)
- **Date:** 2025-01
- **Decision:** Supabase Auth
- **Rationale:** Full Auth-as-a-Service with email, OAuth, MFA, magic links. Reduces auth code to maintain. PostgreSQL Row Level Security possible via Supabase.
- **Trade-offs:** Vendor dependency. Mitigation: Auth layer abstracted behind `services/auth.ts`.

### ADR-005: DeepL primary over GPT-4o for translation
- **Date:** 2025-02
- **Decision:** DeepL for EU/major languages; GPT-4o for rare/cinematic
- **Rationale:** DeepL scores 5–10% higher BLEU on EU language pairs; 10× cheaper per character. GPT-4o's strength is context-aware translation for dialogue-heavy content.
- **Trade-offs:** Two translation providers adds complexity. Mitigation: `TranslationService` orchestrator abstracts the choice.

### ADR-006: Fargate over EC2 for compute
- **Date:** 2025-01
- **Decision:** AWS ECS Fargate
- **Rationale:** No EC2 instance management; right-size CPU/memory per service; auto-scaling without ASG configuration.
- **Trade-offs:** Higher per-unit cost than EC2 at scale. Revisit at 1M+ minutes/month.

---

## Inter-service Communication

### Synchronous (HTTP/REST)
Used for: client → API, external service calls (Stripe, Supabase)

### Asynchronous (BullMQ)
Used for: all AI processing, media processing, email sending

```
Client request → API validates → creates Job record (DB) → enqueues BullMQ job → returns job_id
Client polls GET /v1/jobs/{job_id} every 3s → API reads Job status from DB
Worker picks up job → processes → updates Job status → writes results to DB
```

### Real-time Updates (Server-Sent Events)
Used for: job progress updates to the editor

```typescript
// API: SSE endpoint
GET /v1/jobs/{jobId}/stream
Content-Type: text/event-stream

// Server sends:
data: {"status": "PROCESSING", "progress": 45}
data: {"status": "COMPLETE", "trackId": "track_xxx"}

// Client:
const es = new EventSource(`/v1/jobs/${jobId}/stream`);
es.onmessage = (e) => updateJobStatus(JSON.parse(e.data));
```

### No Direct Service-to-Service HTTP
Workers do not call the API server. They write directly to the database via Prisma. This avoids circular dependencies and simplifies auth.

---

## Coding Standards & Conventions

### TypeScript

```typescript
// ✅ Explicit return types on exported functions
export async function createProject(data: CreateProjectDto): Promise<Project> {}

// ✅ Use type imports
import type { SubtitleCue } from '@/types/subtitle';

// ✅ Prefer interfaces for object shapes (extendable)
interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

// ✅ Prefer type aliases for unions/primitives
type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'ERROR';

// ❌ Never use `any` — use `unknown` + type narrowing
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files (components) | PascalCase | `VideoPlayer.tsx` |
| Files (utils/hooks) | camelCase | `useJobStatus.ts` |
| Files (routes) | kebab-case | `media.routes.ts` |
| Variables/functions | camelCase | `getProjectById` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE_BYTES` |
| Types/Interfaces | PascalCase | `SubtitleTrack` |
| Database columns | snake_case | `start_ms`, `user_id` |
| API routes | kebab-case | `/v1/subtitle-tracks` |
| Env variables | SCREAMING_SNAKE | `OPENAI_API_KEY` |

### File Organization Rules

- One component per file (no barrel files with mixed concerns)
- Co-locate tests with source: `VideoPlayer.test.tsx` next to `VideoPlayer.tsx`
- `index.ts` barrel exports allowed only at module root for public API

---

## API Contract Governance

### Versioning Policy
- All public APIs are versioned: `/v1/`, `/v2/`
- **Breaking changes require a new version.** Never break v1 endpoints.
- What is a breaking change?
  - Removing a field from a response
  - Changing a field's type
  - Renaming a field
  - Changing required/optional status of a request field
  - Changing HTTP method or status code

### Adding Fields (Non-breaking)
New optional response fields can be added to v1 without versioning. Document in changelog.

### API Review Process
Any PR that modifies an API endpoint requires:
1. Tech Lead review
2. Updated Postman collection
3. Updated Zod schema
4. Frontend type update (if field added)
5. Changelog entry

---

## Database Design Decisions

### Index Strategy
Always index:
- All foreign keys (Prisma does NOT auto-index FKs — add `@@index` explicitly)
- All fields used in `WHERE` clauses in hot queries
- Composite index for `[trackId, startMs]` on `SubtitleCue` (timeline queries)

```prisma
model SubtitleCue {
  // ...
  @@index([trackId, startMs])  // ← CRITICAL for timeline editor performance
  @@index([trackId])
}
```

### Soft Deletes
All user-facing entities use soft delete (`deletedAt DateTime?`). Hard delete only via scheduled cleanup job or explicit admin action.

### JSON Fields
Use `Json` type for:
- `Job.metadata` (job-specific config — different per job type)
- `SubtitleCue.styleData` (optional styling overrides)

Do NOT store subtitle cue text in JSON. Use the `text` column — it needs to be indexed and queried.

### Connection Pooling
Use **PgBouncer** (via Supabase's built-in pooler) in transaction mode for API services.
Workers use direct Prisma connections (fewer, longer-lived).

---

## Security Architecture

### Authentication Flow

```
1. User logs in → Supabase Auth issues JWT (RS256)
2. JWT contains: { sub: userId, email, plan, exp: +15min }
3. API middleware verifies JWT signature using Supabase public key
4. Middleware fetches full user record from DB (plan, credits, etc.)
5. User attached to req.user for the request lifecycle
6. Frontend refreshes JWT silently using Supabase JS client before expiry
```

### Authorization Model

```typescript
// Resource ownership check (must be on every resource route)
const project = await prisma.project.findUniqueOrThrow({ where: { id } });
if (project.userId !== req.user.id && req.user.plan !== 'ENTERPRISE') {
  throw new AppError('FORBIDDEN', 403);
}
```

### Defense in Depth

```
Layer 1: WAF (blocks known attack patterns at edge)
Layer 2: Rate limiting (per user token)
Layer 3: Auth middleware (valid JWT required)
Layer 4: Authorization (ownership checks)
Layer 5: Zod validation (input sanitization)
Layer 6: Parameterized queries via Prisma (no SQL injection)
Layer 7: S3 bucket policies (no public access)
Layer 8: IAM (least privilege for all service roles)
```

---

## Scalability Milestones

### 0 → 1K active users
- Single-AZ RDS (db.t4g.small)
- 2 API tasks + 2 worker tasks (Fargate)
- Upstash Redis (shared)
- Vercel hobby → pro for frontend

### 1K → 10K active users
- Multi-AZ RDS (db.t4g.medium)
- Auto-scale API: 2–8 tasks
- Auto-scale workers based on queue depth
- Add read replica for read-heavy queries (editor cue fetch)
- CloudFront caching for subtitle export files

### 10K → 100K active users
- RDS → db.r7g.large (memory-optimized for complex joins)
- Add PgBouncer connection pooler
- Separate worker clusters per queue type
- S3 Intelligent Tiering for cost savings
- Evaluate self-hosted Whisper GPU cluster (vs API cost)

### 100K+ active users
- RDS horizontal read replicas (3+)
- Consider multi-region (ap-south-1 primary + eu-west-1 secondary)
- Kafka/SQS for event streaming between services
- Separate microservices for billing, notification

---

## Tech Debt Registry

Track all known debt here. Review monthly. Prioritize quarterly.

| ID | Description | Impact | Effort | Priority | Target Sprint |
|----|-------------|--------|--------|----------|---------------|
| TD-001 | Whisper responses not cached in S3 — re-transcribing same file charged again | High | Low | P1 | Sprint 5 |
| TD-002 | No database connection pooler (PgBouncer) — will hit connection limits at scale | High | Medium | P1 | Sprint 6 |
| TD-003 | Translation jobs not idempotent — retry can create duplicate tracks | Medium | Medium | P2 | Sprint 7 |
| TD-004 | No structured logging in frontend (console.log in components) | Low | Low | P3 | Sprint 8 |
| TD-005 | Editor timeline redraws entire canvas on every cue update (should be incremental) | Medium | High | P2 | Sprint 9 |

---

## Code Review Standards

### What Tech Lead reviews vs Peer reviews

**Tech Lead must review:**
- Any change to the database schema or migrations
- Any new external dependency added (`package.json`)
- Any API endpoint contract change
- Security-related changes (auth, IAM, secrets)
- Architecture-level refactors
- AI pipeline changes (prompt, model, fallback logic)

**Peer review sufficient for:**
- UI component changes
- Bug fixes in isolated services
- Test additions
- Documentation updates

### Review Checklist (Tech Lead)

```
Architecture:
  □ Does this introduce unnecessary coupling?
  □ Is the right abstraction level used?
  □ Does this scale with 10× user growth?

Security:
  □ No secrets or sensitive data in code
  □ Input validated (Zod)
  □ Authorization checked for new resources
  □ No new direct SQL queries (use Prisma)

Performance:
  □ No N+1 queries (check Prisma includes)
  □ New DB queries have appropriate indexes
  □ Heavy operations are async (not blocking event loop)

Code quality:
  □ TypeScript strict — no `any`, explicit return types
  □ Error handling is explicit (no silent catches)
  □ Tests cover happy path + 2 error cases minimum

API changes:
  □ Follows REST conventions
  □ Response uses envelope format
  □ No breaking changes to existing endpoints
  □ Postman collection updated
```

---

## Onboarding Engineers

### Week 1 Checklist (for any new engineer)

```
Day 1:
  □ GitHub access + SSH key configured
  □ AWS dev credentials (read-only)
  □ Slack joined (#general, #engineering, #[role-channel])
  □ Linear + Notion access
  □ 1Password team vault access (secrets)
  □ Local dev environment running (ag dev works)
  □ Meet 1:1 with Tech Lead

Day 2–3:
  □ Read all role-specific .md guide fully
  □ Read Architecture Decision Records (ADRs 001–006)
  □ Read PRD (Part 3)
  □ Shadow a senior team member on their current task

Day 4–5:
  □ Pick up first "good first issue" ticket from Linear
  □ Open first PR → walk through review with Tech Lead
  □ Attend first standup + sprint planning

Week 2:
  □ Own first full feature ticket end-to-end
  □ Present mini-demo at sprint demo
```

---

> 📌 Questions? Tag `@tech-lead` in `#engineering` on Slack.
> 📐 Architecture diagrams: [Notion ADR section]
> 🧩 System diagram (Mermaid): `docs/architecture.mmd`
> 📋 Tech debt tracker: [Linear label: `tech-debt`]
