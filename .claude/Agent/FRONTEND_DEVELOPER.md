# 🎨 Frontend Developer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** Frontend Developer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Tech Stack](#tech-stack)
3. [Environment Setup](#environment-setup)
4. [Project Structure](#project-structure)
5. [Core Modules to Build](#core-modules-to-build)
6. [Component Architecture](#component-architecture)
7. [API Integration](#api-integration)
8. [State Management](#state-management)
9. [Design System & Styling](#design-system--styling)
10. [Performance Standards](#performance-standards)
11. [Accessibility Requirements](#accessibility-requirements)
12. [Testing](#testing)
13. [Git Workflow](#git-workflow)
14. [Definition of Done](#definition-of-done)

---

## Role Overview

You are responsible for building the **entire web UI** of SubtitleAI Pro — from the landing page and authentication flows to the core subtitle editor, video player, and export panels. You work within the **Antigravity framework**, which provides scaffolding, routing, and deployment pipelines out of the box.

**You own:**
- All UI components and pages
- Video player with subtitle overlay
- Interactive subtitle timeline editor
- Real-time job status tracking (WebSocket/polling)
- Stripe payment & subscription UI
- Responsive layout across desktop and tablet

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 14** (App Router) via Antigravity scaffold |
| Language | **TypeScript** (strict mode — no `any`) |
| Styling | **Tailwind CSS** + `shadcn/ui` component library |
| State | **Zustand** (client state) + **TanStack Query** (server state) |
| Video Player | **Video.js** or **Plyr** with custom subtitle renderer |
| Timeline Editor | **WaveSurfer.js** for waveform + custom canvas for cue blocks |
| Forms | **React Hook Form** + **Zod** validation |
| Animation | **Framer Motion** |
| Icons | **Lucide React** |
| API Client | **Axios** with interceptors (auth token injection) |
| Testing | **Vitest** + **Testing Library** + **Playwright** (E2E) |

---

## Environment Setup

### Prerequisites
- Node.js 20+ (use `nvm`)
- pnpm 9+ (`npm install -g pnpm`)
- Antigravity CLI (`npm install -g @antigravity/cli`)
- Git configured with SSH key

### Step-by-Step

```bash
# 1. Clone the repository
git clone git@github.com:your-org/subtitleai-pro.git
cd subtitleai-pro

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Fill in required env vars (get from 1Password / team lead)
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 5. Start development server via Antigravity
ag dev --port 3000

# 6. Open browser
open http://localhost:3000
```

### Antigravity Dev Commands

```bash
ag dev          # Start dev server with hot reload
ag build        # Production build
ag lint         # Run ESLint + Prettier check
ag test         # Run Vitest unit tests
ag test:e2e     # Run Playwright E2E tests
ag deploy       # Deploy to Vercel (staging)
```

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify-email/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar + header shell
│   │   ├── projects/page.tsx     # Project list
│   │   ├── projects/[id]/page.tsx
│   │   └── settings/page.tsx
│   ├── editor/[projectId]/       # Core subtitle editor
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── api/                      # Next.js API routes (thin proxy)
│   └── layout.tsx                # Root layout
│
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── editor/                   # Subtitle editor components
│   │   ├── VideoPlayer.tsx
│   │   ├── Timeline.tsx
│   │   ├── CueList.tsx
│   │   ├── CueEditor.tsx
│   │   └── StylePanel.tsx
│   ├── upload/
│   │   ├── UploadZone.tsx        # Drag-drop + URL import
│   │   └── ProgressTracker.tsx
│   ├── projects/
│   │   ├── ProjectCard.tsx
│   │   └── ProjectGrid.tsx
│   ├── billing/
│   │   ├── PricingTable.tsx
│   │   └── UsageMeter.tsx
│   └── shared/
│       ├── Navbar.tsx
│       ├── Sidebar.tsx
│       └── LanguageSelector.tsx
│
├── hooks/
│   ├── useSubtitleEditor.ts      # Core editor state hook
│   ├── useJobStatus.ts           # Polling / WebSocket hook
│   ├── useMediaUpload.ts         # TUS upload hook
│   └── useKeyboardShortcuts.ts
│
├── stores/
│   ├── editorStore.ts            # Zustand: cues, playhead, selection
│   └── userStore.ts              # Zustand: auth, credits, plan
│
├── lib/
│   ├── api.ts                    # Axios instance + interceptors
│   ├── queryClient.ts            # TanStack Query config
│   ├── supabase.ts               # Supabase client
│   └── utils.ts
│
├── types/
│   ├── subtitle.ts               # SubtitleCue, SubtitleTrack types
│   ├── project.ts
│   └── api.ts                    # API response types
│
└── styles/
    └── globals.css               # Tailwind base + custom vars
```

---

## Core Modules to Build

### 1. Upload Module
- Drag-and-drop zone (react-dropzone) accepting MP4/MOV/MKV/MP3/WAV/AAC
- YouTube URL paste with preview thumbnail fetch
- TUS resumable upload with progress bar (`tus-js-client`)
- File size validation per plan tier (500MB free / 2GB creator / 10GB studio)

### 2. Job Status Tracker
- Poll `GET /v1/jobs/{job_id}` every 3 seconds during processing
- Show animated progress stages: `Uploading → Extracting Audio → Transcribing → Translating → Ready`
- WebSocket upgrade when available (fallback to polling)
- Toast notification on completion

### 3. Subtitle Editor (most complex)

```
┌─────────────────────────────────────────────────────────┐
│  VIDEO PLAYER (16:9)      │  CUE LIST (scrollable)      │
│                           │  [00:01.200] Hello world     │
│  [Subtitle overlay here]  │  [00:03.500] How are you?   │
│                           │  [00:06.100] ← selected      │
├───────────────────────────┴─────────────────────────────┤
│  WAVEFORM TIMELINE                                       │
│  ████░░░███░░░░███░░░███░░░░███░░░                      │
│  [cue][  cue  ][cue][  cue  ]                           │
├─────────────────────────────────────────────────────────┤
│  CUE EDITOR: [ Hello world            ] 00:01.2→00:03.4  │
│  [Bold] [Italic] [Split] [Merge] [Delete]               │
└─────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Click cue in list → seek video to that timestamp
- Drag cue block on timeline → update start/end time
- Resize handle on cue block → extend/shrink cue
- Spacebar → play/pause; Tab → next cue; Shift+Tab → previous cue

### 4. Language Selector & Translation Panel
- Multi-select language picker (search + flag icons)
- Show translation status per language (queued / translating / done)
- Toggle between language tracks in editor

### 5. Export Panel
- Format picker: SRT, VTT, ASS, TTML, TXT
- Language selection for export
- Burn-in video option (Studio+)
- Batch ZIP download
- Share link generator

---

## Component Architecture

Follow **Atomic Design**:

```
atoms/       → Button, Input, Badge, Spinner
molecules/   → FormField, LanguageBadge, CueTimestamp
organisms/   → VideoPlayer, Timeline, CueList, ExportPanel
templates/   → EditorLayout, DashboardLayout
pages/       → ProjectsPage, EditorPage
```

**Component rules:**
- Every component must have explicit TypeScript props interface
- Use `React.memo` for list items (CueCard, ProjectCard)
- No inline styles — Tailwind only
- `data-testid` attribute on all interactive elements

---

## API Integration

All API calls go through the shared Axios instance:

```typescript
// lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken(); // from Supabase session
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshSession();
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

**TanStack Query patterns:**

```typescript
// hooks/useProject.ts
export const useProject = (id: string) =>
  useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/v1/projects/${id}`).then(r => r.data),
    staleTime: 30_000,
  });

export const useUpdateCue = () =>
  useMutation({
    mutationFn: (cue: SubtitleCue) =>
      api.patch(`/v1/cues/${cue.id}`, cue).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subtitles'] }),
  });
```

---

## State Management

Use **Zustand** for editor state only. Server data lives in TanStack Query cache.

```typescript
// stores/editorStore.ts
interface EditorState {
  cues: SubtitleCue[];
  selectedCueId: string | null;
  playheadMs: number;
  activeLanguage: string;
  isDirty: boolean;

  setCues: (cues: SubtitleCue[]) => void;
  selectCue: (id: string) => void;
  updateCue: (id: string, patch: Partial<SubtitleCue>) => void;
  splitCue: (id: string, atMs: number) => void;
  mergeCues: (id1: string, id2: string) => void;
}
```

---

## Design System & Styling

- **Primary:** `#1A56DB` (blue)
- **Success:** `#0E9F6E` (green)
- **Warning:** `#E3A008` (amber)
- **Danger:** `#F05252` (red)
- **Font:** Inter (body), JetBrains Mono (timestamps/code)

Use Tailwind config extensions — do **not** hardcode hex values in components:

```tsx
// ✅ Correct
<button className="bg-primary text-white hover:bg-primary/90">

// ❌ Wrong
<button style={{ backgroundColor: '#1A56DB' }}>
```

**Dark mode** is supported via `class` strategy. All components must render correctly in both modes.

---

## Performance Standards

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 90 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.0s |
| Editor renders 500 cues | < 16ms per frame |
| Bundle size (initial JS) | < 200KB gzipped |

**Rules:**
- Use `next/image` for all images
- Dynamic import heavy components: `const Timeline = dynamic(() => import('./Timeline'), { ssr: false })`
- Virtualise long cue lists with `@tanstack/virtual`
- Debounce cue text input saves by 500ms

---

## Accessibility Requirements

- All interactive elements must be keyboard-navigable
- ARIA labels on icon-only buttons
- Focus trap in modals
- Subtitle editor must be operable without a mouse
- Color contrast ratio ≥ 4.5:1 (WCAG 2.1 AA)
- Screen reader announcement on job completion

---

## Testing

### Unit Tests (Vitest)
```bash
pnpm test                 # Run all
pnpm test --watch         # Watch mode
pnpm test --coverage      # Coverage report (target: ≥ 85%)
```

Write tests for:
- All utility functions (`lib/utils.ts`)
- Zustand store actions
- Custom hooks (with `renderHook`)
- Complex component logic (cue split, merge, auto-fix)

### E2E Tests (Playwright)
```bash
pnpm test:e2e             # Run all E2E
pnpm test:e2e --ui        # Playwright UI mode
```

Required E2E coverage:
- [ ] Sign up → verify email → login
- [ ] Upload video → wait for transcription → see cues
- [ ] Edit a cue text → save → download SRT
- [ ] Select translation language → wait → export VTT
- [ ] Upgrade to paid plan via Stripe test card

---

## Git Workflow

```
main          ← production (protected, PR only)
staging       ← staging environment
dev           ← integration branch
feature/xxx   ← your feature branches
fix/xxx       ← bug fix branches
```

**Branch naming:**
```
feature/upload-youtube-url
fix/timeline-drag-off-by-one
chore/upgrade-next-14-5
```

**Commit message format (Conventional Commits):**
```
feat(editor): add split cue at playhead shortcut
fix(upload): handle files with spaces in filename
chore(deps): upgrade tailwind to 3.4.1
```

**PR checklist before merge:**
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Tests passing (`pnpm test`)
- [ ] Lighthouse score ≥ 90 on changed pages
- [ ] Reviewed by at least 1 team member
- [ ] `data-testid` added to new interactive elements

---

## Definition of Done

A frontend task is **done** when:
- [ ] Feature works in Chrome, Firefox, Safari (desktop)
- [ ] Responsive on 1280px+ (desktop) and 768–1279px (tablet)
- [ ] Dark mode tested
- [ ] Unit tests written (≥ 85% coverage for new code)
- [ ] No console errors or warnings
- [ ] Accessibility: keyboard navigable + no axe violations
- [ ] Code reviewed and approved
- [ ] Deployed to staging and smoke-tested

---

> 📌 Questions? Ping `#frontend` on Slack or tag `@tech-lead` in your PR.
> 📖 Design system Figma: [link to Figma]
> 🔗 API docs: [link to Postman / Swagger]
