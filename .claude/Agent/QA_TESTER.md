# 🧪 QA Engineer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** QA / Test Engineer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Testing Stack](#testing-stack)
3. [Environment Setup](#environment-setup)
4. [Test Strategy](#test-strategy)
5. [Test Plans by Feature](#test-plans-by-feature)
6. [AI Accuracy Testing](#ai-accuracy-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Accessibility Testing](#accessibility-testing)
10. [Bug Reporting Standards](#bug-reporting-standards)
11. [Regression Checklist](#regression-checklist)
12. [Release Gate Criteria](#release-gate-criteria)
13. [Tools & Dashboards](#tools--dashboards)

---

## Role Overview

You are the quality guardian of SubtitleAI Pro. Your job is to catch bugs before users do, validate AI accuracy, ensure performance under load, and verify every feature against acceptance criteria.

**You own:**
- Test plan creation and maintenance
- Manual exploratory testing on staging
- E2E test automation (Playwright)
- AI accuracy benchmarking (WER, BLEU)
- Load and performance testing (k6)
- Accessibility audits (axe-core + manual)
- Security smoke tests (OWASP checklist)
- Bug triage, severity classification, and regression tracking
- Release sign-off (final go/no-go before production)

---

## Testing Stack

| Tool | Purpose |
|------|---------|
| **Playwright** | E2E browser automation |
| **Vitest** | Unit + integration tests (run by devs, reviewed by QA) |
| **k6** | Load and performance testing |
| **axe-core** | Automated accessibility scanning |
| **NVDA / VoiceOver** | Screen reader manual testing |
| **Postman / Bruno** | API contract testing |
| **BrowserStack** | Cross-browser / cross-device testing |
| **Sentry** | Error monitoring (bug source) |
| **Linear** | Bug tracking and test case management |
| **Loom** | Screen recording for bug reports |

---

## Environment Setup

```bash
# 1. Clone repo
git clone git@github.com:your-org/subtitleai-pro.git
cd subtitleai-pro

# 2. Install dependencies
pnpm install

# 3. Set up QA-specific env vars
cp .env.qa.example .env.qa
# Fill in: staging API URL, test user credentials, Stripe test keys

# 4. Install Playwright browsers
npx playwright install --with-deps

# 5. Run E2E tests against staging
pnpm test:e2e --env=staging

# 6. Run accessibility audit
pnpm test:a11y

# 7. Run load test
pnpm test:load
```

### Test Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Local | `http://localhost:3000` | Developer testing |
| Staging | `https://staging.subtitleai.pro` | QA + team review |
| Production | `https://app.subtitleai.pro` | Smoke tests only post-deploy |

### Test Accounts (Staging Only)

| Account | Email | Plan | Purpose |
|---------|-------|------|---------|
| Free user | `qa+free@subtitleai.pro` | FREE | Test credit limits |
| Creator | `qa+creator@subtitleai.pro` | CREATOR | Paid features |
| Studio | `qa+studio@subtitleai.pro` | STUDIO | Batch, burn-in |
| Enterprise | `qa+enterprise@subtitleai.pro` | ENTERPRISE | API, SSO |
| No credits | `qa+nocredits@subtitleai.pro` | FREE | Test exhaustion flow |

**Stripe test cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3DS required: `4000 0027 6000 3184`

---

## Test Strategy

### Testing Pyramid

```
          ┌──────────┐
          │   E2E    │  ← 15% (critical flows only — slow)
          │ Playwright│
         ─┼──────────┼─
        ╱  Integration  ╲  ← 25% (API contracts, DB)
       ╱    (Supertest)   ╲
      ─────────────────────
     ╱        Unit          ╲  ← 60% (services, utils, hooks)
    ╱         (Vitest)        ╲
   ─────────────────────────────
```

### Coverage Targets

| Type | Target |
|------|--------|
| Unit (line coverage) | ≥ 85% |
| Integration (endpoint coverage) | 100% of public routes |
| E2E (critical path coverage) | 100% of happy paths |
| AI accuracy (WER) | ≤ 8% across test corpus |
| Accessibility | 0 WCAG 2.1 AA violations |

---

## Test Plans by Feature

### 1. Authentication

| Test Case | Steps | Expected Result | Priority |
|-----------|-------|-----------------|----------|
| Email signup | Enter email + password → click Sign Up | Verification email sent; user sees "check your email" screen | P0 |
| Email verify | Click verify link in email | Redirected to dashboard; account marked verified | P0 |
| Invalid signup | Enter duplicate email | Error: "Account already exists" | P0 |
| Google OAuth | Click "Continue with Google" → authorize | Logged in; user created in DB | P0 |
| Login success | Valid credentials | JWT token set; redirected to dashboard | P0 |
| Login failure | Wrong password | "Invalid credentials" error; no token | P0 |
| Session expire | Wait for token expiry (15 min) | Auto-refresh works silently; user not logged out | P1 |
| Forgot password | Request reset link | Email received; can reset within 1 hour | P1 |
| Logout | Click logout | Session cleared; redirect to /login | P0 |
| 2FA enable | Enable TOTP in settings | QR code shown; code validated; 2FA active | P1 |

---

### 2. File Upload

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Upload valid MP4 (< 500MB free) | Progress shown → job queued | P0 |
| Upload MP4 > 500MB on free plan | Error: "Upgrade to upload larger files" | P0 |
| Upload MP3 audio file | Accepted; audio extracted | P0 |
| Upload invalid format (.exe) | Rejected with format error | P0 |
| Upload corrupted video | Error during FFmpeg extraction; user notified | P1 |
| Resume interrupted upload | Upload resumes from where it stopped | P1 |
| YouTube URL — valid | Video imported; thumbnail shown | P0 |
| YouTube URL — private video | Error: "Video not accessible" | P0 |
| YouTube URL — invalid URL | Validation error shown inline | P0 |
| Simultaneous uploads (batch) | All process independently; no race conditions | P1 |
| Upload while credit is 0 | Blocked with upgrade prompt before upload | P0 |

---

### 3. Transcription & Job Processing

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Transcription completes < 2× video duration | Job done within SLA | P0 |
| Source language auto-detected correctly | Detected language shown; ≥ 90% accuracy on test corpus | P0 |
| Manual source language override | User-selected language used regardless of detection | P0 |
| Speaker diarization (2 speakers) | Speakers labeled Speaker 1, Speaker 2 | P1 |
| Speaker diarization (8 speakers) | All 8 labeled correctly | P1 |
| Job fails mid-processing | Status = ERROR; user sees retry option | P0 |
| Whisper API timeout | Fallback to Deepgram; job eventually completes | P1 |
| Credits deducted on completion | Ledger entry created; UI credit counter updated | P0 |
| No credits → job rejected | Job never queued; user prompted to upgrade | P0 |
| 10-min video cues count | ~60–120 cues created (reasonable density) | P1 |

---

### 4. Subtitle Editor

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Click cue in list → video seeks | Video jumps to that timestamp ± 100ms | P0 |
| Edit cue text → auto-save | Changes persist after page refresh (30s max) | P0 |
| Drag cue on timeline → updates timestamps | start_ms and end_ms updated in DB | P0 |
| Split cue at playhead | One cue becomes two; text divided at word boundary | P0 |
| Merge two adjacent cues | Combined into one cue; timing spans both | P0 |
| Find & replace | All matching text in track replaced | P1 |
| Undo last action (Cmd+Z) | Previous state restored | P1 |
| Cue exceeds 42 chars/line | Yellow warning shown | P1 |
| Cue exceeds 20 CPS reading speed | Red warning shown | P1 |
| Overlapping cue timings | Auto-fix tool flags overlap | P1 |
| Keyboard nav: Tab → next cue | Focus moves to next cue; video seeks | P0 |
| Version history: revert | Previous version loaded correctly | P1 |
| Side-by-side language comparison | Both language tracks shown, synchronized | P1 |

---

### 5. Translation

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Translate to Spanish | Subtitle text translated; timing identical | P0 |
| Translate to Arabic (RTL) | Text displayed right-to-left in editor | P0 |
| Translate to Hindi | Devanagari script renders correctly | P0 |
| Translation preserves timing | No start/end timestamps altered | P0 |
| BLEU score ≥ 0.78 (Spanish) | Benchmark test against reference translations | P1 |
| Retranslate single segment | Only selected cue changes; others unaffected | P1 |
| Translate with custom glossary | Domain-specific terms respected | P1 |
| Translation failure (API error) | Error shown; retry button available | P0 |
| Select 5 target languages | 5 parallel jobs created; all complete | P1 |

---

### 6. Export

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Export SRT | Valid .srt file downloads; parseable by VLC | P0 |
| Export VTT | Valid .vtt file; works in HTML5 `<track>` | P0 |
| Export ASS | Valid .ass file; styling preserved | P1 |
| Export TTML | Valid TTML 1.0; passes W3C validator | P1 |
| Export TXT | Plain text, no timestamps | P0 |
| Export — wrong language selected | Correct track exported | P0 |
| Burn-in video (Studio plan) | MP4 downloaded with embedded subs; plays in VLC | P1 |
| Burn-in video (Free plan) | Button disabled with upgrade prompt | P0 |
| Share link | Public URL renders video + subs without login | P1 |
| Batch export ZIP | All selected projects included, each in correct format | P1 |

---

### 7. Billing & Credits

| Test Case | Expected Result | Priority |
|-----------|-----------------|----------|
| Upgrade Free → Creator | Stripe checkout completes; plan updated in DB; credits added | P0 |
| Stripe card decline | Error shown; plan not changed | P0 |
| Subscription cancel | Plan continues until period end; then downgrades | P0 |
| Credit counter accurate | After 10-min job: counter decreases by exactly 600 | P0 |
| Credit refund on job error | Credits returned if transcription fails | P0 |
| Overage billing (Creator) | Overage usage tracked; invoice line item correct | P1 |
| Billing portal access | User can view invoices, update card | P1 |
| Webhook: subscription.updated | DB plan updated within 30 seconds of Stripe event | P0 |

---

## AI Accuracy Testing

Run monthly against a standardized test corpus.

### Test Corpus (maintain in S3: `s3://subtitleai-qa/accuracy-corpus/`)

| File | Language | Speaker Count | Audio Quality | Duration |
|------|----------|---------------|---------------|----------|
| `en_interview_clear.mp4` | English | 2 | Studio | 10 min |
| `en_lecture_noisy.mp4` | English | 1 | Ambient noise | 20 min |
| `hi_conversation.mp4` | Hindi | 3 | Phone quality | 8 min |
| `es_news_anchor.mp4` | Spanish | 1 | Broadcast | 15 min |
| `ar_dialogue.mp4` | Arabic | 2 | Studio | 12 min |
| `zh_documentary.mp4` | Mandarin | 2 | Compressed | 25 min |
| `fr_accent_heavy.mp4` | French | 1 | Heavy accent | 10 min |
| `de_technical.mp4` | German | 1 | Technical vocab | 18 min |

### WER (Word Error Rate) Benchmarks

```bash
# Run accuracy benchmark script
pnpm run qa:accuracy-test --corpus s3://subtitleai-qa/accuracy-corpus/

# Output: accuracy-report-YYYY-MM-DD.json
```

| Language | Target WER | Alert Threshold |
|----------|------------|-----------------|
| English (clear) | ≤ 5% | > 8% |
| English (noisy) | ≤ 12% | > 15% |
| Hindi | ≤ 10% | > 13% |
| Spanish | ≤ 6% | > 10% |
| Arabic | ≤ 12% | > 16% |
| Mandarin | ≤ 8% | > 12% |

### Translation BLEU Score Benchmarks

| Language Pair | Target BLEU | Alert Threshold |
|---------------|-------------|-----------------|
| EN → ES | ≥ 0.80 | < 0.75 |
| EN → HI | ≥ 0.72 | < 0.65 |
| EN → AR | ≥ 0.70 | < 0.63 |
| EN → FR | ≥ 0.82 | < 0.76 |

---

## Performance Testing

### k6 Load Test Scenarios

```javascript
// tests/load/upload-and-transcribe.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up
    { duration: '5m', target: 500 },   // sustained load
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],  // 99% under 3s
    http_req_failed: ['rate<0.01'],     // < 1% errors
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/projects`, { headers: authHeaders });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Performance Acceptance Criteria

| Scenario | Target |
|----------|--------|
| 500 concurrent users browsing dashboard | p99 < 3s, 0% error |
| 100 simultaneous file uploads | p99 < 5s, < 1% error |
| 50 concurrent transcription jobs | Queue processes all within 3× video duration |
| Editor load with 500 cues | First interactive < 2s |
| Export SRT for 2-hour film | Response < 5s |

---

## Security Testing

Run OWASP ZAP scan on staging before every release:

```bash
pnpm run qa:security-scan --target=https://staging.subtitleai.pro
```

### Manual Security Checklist

- [ ] JWT tokens cannot be forged (algorithm: RS256, not HS256 with weak key)
- [ ] Presigned S3 URLs expire in ≤ 15 minutes
- [ ] Users cannot access other users' files (IDOR test: swap project IDs)
- [ ] File uploads reject non-media MIME types (upload a PHP file → rejected)
- [ ] Rate limiting works: 101 requests/min → 429 response
- [ ] Stripe webhook signature verified (replay attack: resend old webhook → rejected)
- [ ] XSS: Enter `<script>alert(1)</script>` in cue text → not executed
- [ ] SQL injection: Enter `'; DROP TABLE users;--` in search → safely handled
- [ ] CSRF: API requires Authorization header (not cookie-only)
- [ ] Admin endpoints inaccessible to regular users (403)

---

## Accessibility Testing

### Automated (run on every PR to staging)

```bash
pnpm test:a11y  # runs axe-core on all key pages
```

Pages audited automatically:
- `/` (landing page)
- `/login`, `/signup`
- `/projects` (dashboard)
- `/editor/[id]`
- `/settings/billing`

**Pass criteria:** 0 WCAG 2.1 AA violations

### Manual Screen Reader Testing (monthly)

Test with **NVDA + Chrome (Windows)** and **VoiceOver + Safari (macOS)**:

- [ ] Can navigate to upload zone using Tab key
- [ ] Upload zone announces "Drop files here or click to browse"
- [ ] Job progress percentage is announced as it updates
- [ ] Cue list items readable: "Cue 3 of 47, 0 minutes 6 seconds, Hello world"
- [ ] Error messages announced immediately (aria-live="assertive")
- [ ] Modal dialogs trap focus correctly
- [ ] All icon buttons have accessible names

---

## Bug Reporting Standards

### Bug Severity Levels

| Severity | Definition | SLA to Fix |
|----------|------------|------------|
| **P0 — Critical** | Data loss, payment failure, security breach, service down | Same day |
| **P1 — High** | Core feature broken, no workaround possible | Within 1 sprint |
| **P2 — Medium** | Feature degraded, workaround available | Within 2 sprints |
| **P3 — Low** | UI glitch, minor UX issue | Backlog (prioritize later) |

### Bug Report Template (Linear)

```markdown
**Title:** [Component] — [Short description of bug]

**Severity:** P0 / P1 / P2 / P3

**Environment:** Staging / Production
**Browser:** Chrome 124 / Firefox 125 / Safari 17
**OS:** macOS 14.4 / Windows 11

**Steps to Reproduce:**
1. Log in as qa+free@subtitleai.pro
2. Upload file: `test-10min.mp4`
3. Click "Translate to Hindi"
4. Observe: [what happens]

**Expected Behavior:**
Translation starts and shows "Translating..." progress

**Actual Behavior:**
Page shows blank white screen. Console error: TypeError: Cannot read properties of undefined

**Attachments:**
- [ ] Loom screen recording: [link]
- [ ] Console screenshot
- [ ] Network tab (XHR errors)
- [ ] Sentry error link: [link]

**Reproducibility:** Always / Intermittent (X/10 attempts)

**Workaround:** [if any]
```

---

## Regression Checklist

Run this after every major merge to `staging`. Takes ~45 minutes.

### Core Flow Smoke Tests
- [ ] Sign up with new email → verify → login
- [ ] Upload a 5-min MP4 → transcription completes
- [ ] Translate to Spanish → download SRT
- [ ] Edit 3 cues → verify changes saved after refresh
- [ ] Upgrade Free → Creator with test card `4242...`
- [ ] Export VTT → open in browser → verify subtitle display
- [ ] Share link opens and plays with subtitles (logged out)
- [ ] Logout → login again → projects intact

### API Smoke Tests (Postman collection)
- [ ] `POST /v1/media/upload` → 200 + presigned URL
- [ ] `POST /v1/jobs` → 201 + job_id
- [ ] `GET /v1/jobs/{id}` → status field present
- [ ] `GET /v1/export/{trackId}?format=srt` → binary response
- [ ] `POST /v1/billing/checkout` → Stripe URL returned
- [ ] Unauthenticated request → 401
- [ ] Wrong user accessing another user's project → 403

---

## Release Gate Criteria

**QA must sign off before any production deployment:**

| Gate | Requirement |
|------|-------------|
| Unit tests | 100% passing, ≥ 85% coverage |
| Integration tests | 100% passing |
| E2E tests | 100% passing on staging |
| Regression checklist | 100% complete, 0 P0/P1 bugs open |
| Load test | p99 < 3s, < 1% error at 500 concurrent users |
| Accessibility | 0 WCAG 2.1 AA violations |
| Security scan | 0 critical/high OWASP findings |
| AI accuracy | WER ≤ 8% on English test corpus |

**Sign-off process:**
1. QA Engineer runs all checks and documents results in Notion
2. QA Engineer posts in `#releases`: "✅ QA signed off for v[X.Y.Z] — all gates passed"
3. DevOps triggers production deployment
4. QA runs post-deploy smoke test (15 min)
5. If smoke test fails → DevOps rolls back immediately

---

## Tools & Dashboards

| Tool | URL | Access |
|------|-----|--------|
| Sentry errors | sentry.io/subtitleai | View |
| Datadog APM | app.datadoghq.com | View |
| Linear (bugs) | linear.app/subtitleai | Full |
| BrowserStack | browserstack.com | QA team login |
| Playwright reports | CI: GitHub Actions artifacts | Auto |
| k6 Cloud | k6.io/cloud | View |
| Postman | Workspace: SubtitleAI Pro API | Collaborator |

---

> 📌 Questions? Ping `#qa` on Slack or tag `@qa-lead` in Linear bugs.
> 📁 Test assets (corpus, fixtures): `s3://subtitleai-qa/`
> 📋 Test case tracker: [Linear link]
