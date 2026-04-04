# 📊 Project Manager Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** Project Manager | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Project Management Stack](#project-management-stack)
3. [Team Structure & Contacts](#team-structure--contacts)
4. [Sprint Framework](#sprint-framework)
5. [Roadmap Overview](#roadmap-overview)
6. [Risk Register](#risk-register)
7. [Stakeholder Communication](#stakeholder-communication)
8. [Ceremonies & Cadence](#ceremonies--cadence)
9. [Ticket Management](#ticket-management)
10. [Delivery Metrics (KPIs)](#delivery-metrics-kpis)
11. [Escalation Paths](#escalation-paths)
12. [Definition of Ready / Done](#definition-of-ready--done)
13. [Tools & Integrations](#tools--integrations)

---

## Role Overview

You are the operational center of the SubtitleAI Pro engineering team. You ensure the right work gets done at the right time, dependencies are unblocked, the team is aligned, and stakeholders have visibility into progress.

**You own:**
- Sprint planning, execution, and retrospectives
- Roadmap maintenance and prioritization (in collaboration with Product Manager)
- Dependency tracking across frontend, backend, ML, and DevOps
- Risk identification and mitigation
- Status reporting to founders and investors
- Cross-functional communication (design ↔ engineering ↔ QA)
- Team velocity tracking and burndown

**You do NOT own:**
- Product vision or feature prioritization (→ Product Manager)
- Technical architecture decisions (→ Tech Lead)
- Business strategy (→ Founders / CEO)

---

## Project Management Stack

| Tool | Purpose |
|------|---------|
| **Linear** | Sprint planning, tickets, roadmap, backlog |
| **Notion** | Project wiki, meeting notes, decision log |
| **Slack** | Day-to-day communication |
| **GitHub** | Code + PRs linked to Linear tickets |
| **Figma** | Design handoff (view access) |
| **Google Meet / Zoom** | Ceremonies and stakeholder calls |
| **Loom** | Async demos and walkthroughs |
| **Datadog** | Monitoring dashboards (read access) |
| **Retool** | Internal admin dashboard |

---

## Team Structure & Contacts

| Role | Name | Slack | Time Zone |
|------|------|-------|-----------|
| CTO / Tech Lead | TBD | `@cto` | IST |
| Frontend Dev 1 | TBD | `@fe-lead` | IST |
| Frontend Dev 2 | TBD | `@fe-2` | IST |
| Backend Dev 1 | TBD | `@be-lead` | IST |
| Backend Dev 2 | TBD | `@be-2` | IST |
| ML / AI Engineer | TBD | `@ml-eng` | IST |
| DevOps Engineer | TBD | `@devops` | IST |
| QA Engineer | TBD | `@qa` | IST |
| UI/UX Designer | TBD | `@design` | IST |
| Product Manager | TBD | `@pm` | IST |

**On-call rotation:** Backend Dev 1 → Backend Dev 2 → DevOps (weekly rotation, managed in PagerDuty)

---

## Sprint Framework

### Sprint Structure
- **Duration:** 2 weeks
- **Capacity per sprint:** 10 working days per engineer
- **Story point scale:** Fibonacci (1, 2, 3, 5, 8, 13)
- **Velocity target (initial):** 60–70 points/sprint (whole team)
- **WIP limit:** Max 2 tickets In Progress per engineer at any time

### Sprint Calendar (recurring)

| Day | Event |
|-----|-------|
| Sprint Day 1 (Monday) | Sprint Planning (2 hrs) |
| Daily (Mon–Fri) | Daily Standup (15 min, 10:00 AM IST) |
| Sprint Day 8 (Wednesday) | Mid-sprint check-in (30 min) |
| Sprint Day 10 (Friday) | Sprint Demo (1 hr) |
| Sprint Day 10 (Friday) | Retrospective (45 min) |
| Sprint Day 10 → Day 1 | Backlog grooming (async + 1 hr session) |

---

## Roadmap Overview

### Phase 0 — Foundation (Weeks 1–2)
**Goal:** All infrastructure up, CI/CD running, auth working, dev environments ready.
- [ ] Antigravity project scaffold created
- [ ] GitHub repo + branch protection configured
- [ ] CI/CD: GitHub Actions pipelines (lint, test, deploy)
- [ ] AWS infra provisioned (Terraform): S3, RDS, ElastiCache, ECS
- [ ] Supabase project setup (Auth + DB)
- [ ] Design system in Figma finalized
- [ ] Linear workspace + team onboarded

### Phase 1 — Core Upload & Transcription (Weeks 3–6)
**Goal:** A user can upload a video, get a transcription, and view cues.
- [ ] File upload UI (drag-drop + YouTube URL)
- [ ] S3 presigned upload flow
- [ ] FFmpeg audio extraction (Lambda)
- [ ] BullMQ queue: media → transcription pipeline
- [ ] Whisper integration + cue creation
- [ ] Basic subtitle editor (video player + cue list)
- [ ] SRT export

### Phase 2 — Translation (Weeks 7–9)
**Goal:** Users can translate transcriptions into multiple languages and export.
- [ ] DeepL + GPT-4o translation integration
- [ ] Language selector UI
- [ ] Translation job queue
- [ ] Multi-language track UI in editor
- [ ] VTT + ASS export
- [ ] Auto language detection

### Phase 3 — Monetisation (Weeks 10–11)
**Goal:** Stripe live, credit system running, upgrade flow complete.
- [ ] Stripe Checkout integration
- [ ] Subscription plan tiers (Free, Creator, Studio)
- [ ] Credit ledger + deduction on job completion
- [ ] Credit exhaustion → upgrade prompt
- [ ] Billing portal (manage subscription)
- [ ] Plan-based feature gating (middleware)

### Phase 4 — Launch Prep (Week 12)
**Goal:** Product Hunt ready, bugs zero, performance validated.
- [ ] Performance audit (Lighthouse ≥ 90)
- [ ] Security review (OWASP checklist)
- [ ] Load test (k6: 500 concurrent users)
- [ ] Landing page live
- [ ] Onboarding flow polished
- [ ] Product Hunt assets prepared
- [ ] Staging → Production deployment

---

## Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R1 | Whisper API latency spikes under load | Medium | High | Deepgram fallback queue; async job model hides latency from UX |
| R2 | DeepL accuracy issues for rare languages | Medium | Medium | GPT-4o fallback; BLEU score monitoring alerts |
| R3 | AWS S3 costs exceed budget | Low | High | Lifecycle policies; video compression before storage; monitor spend weekly |
| R4 | Stripe integration delay blocks launch | Low | High | Begin Stripe work in Phase 2 parallel, not Phase 3 sequential |
| R5 | Key engineer unavailable (sick / attrition) | Medium | High | Cross-train BE1/BE2 on each other's domains; documentation standards |
| R6 | Whisper rate limits hit at scale | Medium | Medium | Batch queue with priority lanes; Deepgram fallback; Whisper self-hosted option |
| R7 | GDPR non-compliance at launch | Low | Critical | Legal review in Week 10; DPA templates ready; data residency on roadmap |
| R8 | YouTube URL import blocked (ToS) | Medium | Low | Clarify ToS compliance; offer as "import for personal use" with disclaimer |

**Risk review:** Every sprint retrospective, PM updates this register and shares with Tech Lead + CEO.

---

## Stakeholder Communication

### Internal (Weekly)
- **Engineering sync:** Every Monday post-standup — PM shares sprint goals and blockers
- **Founder update:** Every Friday — 1-page status doc via Notion + Slack summary

### Investor / Board (Monthly)
Monthly 1-pager covering:
1. MRR / ARR (if launched)
2. Sprint velocity vs plan
3. Key features shipped
4. Key metrics (WER, conversion, churn)
5. Top 3 risks and mitigations
6. Next month goals

### Stakeholder Status Template (Notion)
```markdown
## Week [N] — SubtitleAI Pro Update
**Sprint:** [X] of 6 (MVP Phase)

### ✅ Shipped This Week
- [Feature 1]
- [Feature 2]

### 🔄 In Progress
- [Feature 3] — 80% complete, ETA [date]

### 🚧 Blockers
- [Blocker 1] — Owner: [name] — ETA to resolve: [date]

### 📊 Metrics
- Velocity: 62 pts (target: 65)
- Bugs opened: 4 | Bugs closed: 6
- Sprint burn: on track

### ⚠️ Risks This Week
- [Risk]: [mitigation action]
```

---

## Ceremonies & Cadence

### Daily Standup (15 min — 10:00 AM IST)
**Format (each person):**
1. What did I complete yesterday?
2. What will I do today?
3. Any blockers?

**PM's role:** Note blockers immediately, follow up within 2 hours. Do NOT let blockers sit overnight.

### Sprint Planning (2 hrs)
1. Review team capacity (vacations, on-call, etc.)
2. PM + Product Manager present prioritized backlog
3. Engineers pull tickets and estimate in points
4. Commit to sprint goal and scope
5. Assign owners to each ticket

### Sprint Demo (1 hr)
- Each engineer demos their completed work (share screen)
- Stakeholders / founders invited
- PM records demo with Loom and shares to `#general`
- No polish required — working software is the demo

### Retrospective (45 min — Format: Start / Stop / Continue)
- What should we START doing?
- What should we STOP doing?
- What should we CONTINUE doing?
- PM captures action items with owners + due dates in Notion

### Backlog Grooming (1 hr — every sprint mid-point)
- PM + Product Manager review upcoming backlog
- Tickets get acceptance criteria added
- Estimates added by Tech Lead / engineers async before planning

---

## Ticket Management

### Linear Ticket Structure

**Epic** → **Feature** → **Task** → **Subtask**

```
Epic: Upload & Transcription Pipeline
  ├── Feature: File Upload UI
  │     ├── Task: Build drag-drop zone component [FE-001]
  │     ├── Task: Add YouTube URL input + validation [FE-002]
  │     └── Task: TUS resumable upload integration [FE-003]
  └── Feature: Whisper Transcription
        ├── Task: Whisper API service wrapper [BE-001]
        ├── Task: BullMQ transcription queue setup [BE-002]
        └── Task: Cue creation from transcript JSON [BE-003]
```

### Ticket Labels
| Label | Meaning |
|-------|---------|
| `p0-critical` | Launch blocker — drop everything |
| `p1-high` | Must have in current sprint |
| `p2-medium` | Should have this phase |
| `p3-low` | Nice to have, can slip |
| `bug` | Production or staging defect |
| `tech-debt` | Refactoring / cleanup |
| `blocked` | Waiting on external dependency |

### Ticket Acceptance Criteria Template
```
**As a** [user type]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]
- [ ] Error state: [what happens on failure]
- [ ] Loading state: [what the user sees while waiting]

**Out of scope for this ticket:**
- [explicit exclusion]

**Test data / setup needed:**
- [any fixtures, environment config]
```

---

## Delivery Metrics (KPIs)

Track these weekly and report in stakeholder updates:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sprint velocity | 60–70 pts/sprint | Linear |
| Sprint goal completion | ≥ 85% | Linear |
| Cycle time (ticket start → done) | ≤ 4 days | Linear |
| Bug escape rate (bugs found in prod) | ≤ 2/sprint | Linear bug label |
| PR review turnaround | ≤ 24 hrs | GitHub |
| Blocker resolution time | ≤ 1 day | Standup notes |
| Deployment frequency | ≥ 2x/week to staging | GitHub Actions |
| Mean time to restore (MTTR) | < 2 hrs | PagerDuty |

---

## Escalation Paths

```
Developer stuck on technical problem
    → Tech Lead (same day)

Tech Lead can't resolve architecture decision
    → CTO (within 24 hrs)

External API / vendor issue (Stripe, AWS, OpenAI)
    → DevOps + Tech Lead → vendor support ticket
    → PM notifies stakeholders if sprint-impacting

Sprint scope needs to change mid-sprint
    → PM + Product Manager discuss → inform founders if > 1 sprint impact

Security incident
    → DevOps + CTO → PM notifies founders within 1 hr
    → Follow incident response runbook (in Notion)

Key person leaves / unavailable > 3 days
    → PM + CEO assess coverage → cross-train plan activated
```

---

## Definition of Ready / Done

### Definition of Ready (before sprint planning)
A ticket is **ready to be pulled into a sprint** when:
- [ ] Clear title and description
- [ ] Acceptance criteria written (testable, specific)
- [ ] Story points estimated by engineer
- [ ] Dependencies identified and noted
- [ ] Design mockup linked (if UI work)
- [ ] API contract agreed (if FE + BE work)

### Definition of Done (before marking Complete)
A ticket is **done** when:
- [ ] Code merged to `dev` branch
- [ ] Unit/integration tests passing
- [ ] Deployed to staging
- [ ] QA engineer has verified against acceptance criteria
- [ ] No P0/P1 bugs introduced
- [ ] PR reviewed and approved by ≥ 1 peer
- [ ] Relevant docs updated (API docs, Notion)
- [ ] Ticket moved to Done in Linear with comment summarizing what shipped

---

## Tools & Integrations

### Linear → GitHub integration
- Branches named `feature/SAP-[ticket-number]-short-desc` auto-link to Linear tickets
- PR merges automatically move tickets to Done
- Branch created from Linear ticket to avoid mismatches

### Slack Automations
- `#deployments` — auto-post on every staging deploy (GitHub Actions webhook)
- `#alerts` — Datadog + Sentry alerts
- `#releases` — Production deployments only
- `#standup` — Geekbot async standup summary (for remote/async days)

### Weekly PM Checklist
```
Monday:
  □ Review sprint board — any tickets missing owners?
  □ Send sprint goal reminder to team in Slack
  □ Check if any tickets are blocked → follow up

Wednesday:
  □ Mid-sprint check: will we hit the sprint goal?
  □ If at risk: scope conversation with PM + Tech Lead
  □ Update risk register

Friday:
  □ Sprint demo recording posted to Slack
  □ Retro action items added to Notion
  □ Weekly stakeholder update sent
  □ Next sprint backlog groomed for Monday planning
```

---

> 📌 Notion workspace: [link]
> 📋 Linear project: [link]
> 🎙 Team Slack: `#subtitleai-team`
> 📅 Sprint calendar: [Google Calendar link]
