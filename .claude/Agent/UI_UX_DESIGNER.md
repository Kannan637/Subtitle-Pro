# 🎨 UI/UX Designer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** UI/UX Designer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Design Stack](#design-stack)
3. [Design System](#design-system)
4. [Key Screens to Design](#key-screens-to-design)
5. [UX Principles](#ux-principles)
6. [User Research & Testing](#user-research--testing)
7. [Handoff Standards](#handoff-standards)
8. [Accessibility Guidelines](#accessibility-guidelines)
9. [Animation & Motion](#animation--motion)
10. [Responsive Design](#responsive-design)
11. [Definition of Done](#definition-of-done)

---

## Role Overview

You are the voice of the user inside the engineering team. You translate user needs into beautiful, intuitive interfaces — and then ensure what gets built matches what was designed.

**You own:**
- Figma design system (components, tokens, patterns)
- Wireframes and high-fidelity mockups for all screens
- User flows and interaction specs
- Prototypes for stakeholder review and usability testing
- Design review before any feature ships (design QA)
- Usability testing plan and synthesis
- Accessibility compliance at the design level

---

## Design Stack

| Tool | Purpose |
|------|---------|
| **Figma** | All UI design, components, prototyping |
| **FigJam** | User flows, journey maps, whiteboarding |
| **Maze** | Unmoderated usability testing |
| **Hotjar** | Heatmaps and session recordings (post-launch) |
| **Loom** | Design walkthrough recordings for handoff |
| **shadcn/ui** | Component library used by FE (align designs to this) |
| **Tailwind CSS** | Token system for colors, spacing, typography |

---

## Design System

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#1A56DB` | CTAs, links, active states |
| `primary-hover` | `#1C3FAA` | Button hover |
| `primary-light` | `#EBF5FF` | Highlight backgrounds |
| `secondary` | `#0E9F6E` | Success, positive states |
| `warning` | `#E3A008` | Caution indicators |
| `danger` | `#F05252` | Errors, destructive actions |
| `gray-900` | `#111928` | Primary text |
| `gray-700` | `#374151` | Secondary text |
| `gray-400` | `#9CA3AF` | Placeholder / disabled |
| `gray-100` | `#F3F4F6` | Surface backgrounds |
| `white` | `#FFFFFF` | Card backgrounds |

**Dark mode counterparts** must be defined for every token.

### Typography

| Style | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| Display | Inter | 48px | 700 | 1.2 |
| H1 | Inter | 36px | 700 | 1.25 |
| H2 | Inter | 28px | 600 | 1.3 |
| H3 | Inter | 22px | 600 | 1.4 |
| Body Large | Inter | 16px | 400 | 1.6 |
| Body | Inter | 14px | 400 | 1.6 |
| Small | Inter | 12px | 400 | 1.5 |
| Code / Timestamps | JetBrains Mono | 13px | 400 | 1.4 |

### Spacing Scale (4px base)
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px

### Border Radius
- `sm`: 4px (inputs, badges)
- `md`: 8px (cards, panels)
- `lg`: 12px (modals, dropdowns)
- `xl`: 16px (large cards, feature sections)
- `full`: 9999px (pills, avatars)

### Component Library (Figma)

Maintain these as Figma components:
- Button (primary / secondary / ghost / destructive / icon)
- Input (default / focused / error / disabled)
- Select, Textarea, Checkbox, Radio, Toggle
- Badge / Tag (multiple color variants)
- Alert (info / success / warning / error)
- Modal / Dialog
- Tooltip
- Dropdown Menu
- Progress Bar / Spinner
- Avatar
- Card
- Table
- Tabs
- Sidebar navigation
- Language selector

---

## Key Screens to Design

### Priority 1 — MVP Launch

#### 1. Landing Page
- Hero: bold headline, subtitle, demo GIF/video, CTA ("Start Free")
- Social proof: logos of supported platforms (YouTube, Netflix, Vimeo)
- Features section (3 columns: Fast, Multilingual, Professional)
- Pricing table (Free / Creator / Studio / Enterprise)
- FAQ accordion
- Footer with legal links

#### 2. Auth Screens
- Sign Up: email + password, Google OAuth button, T&C checkbox
- Log In: email + password, Google OAuth, "Forgot password" link
- Verify Email: illustration + "check your inbox" message
- Reset Password: new password form

#### 3. Dashboard (Projects List)
- Top: usage meter (30 min used of 60 min free)
- Empty state: "Upload your first video" illustration + CTA
- Grid of project cards (thumbnail, name, duration, status pill, date)
- New project button (top right)
- Sidebar: Projects, Settings, Upgrade CTA

#### 4. New Project / Upload
- Drag-and-drop zone: large, prominent, accepts video/audio
- YouTube URL input below (or tab toggle: "Upload" / "YouTube URL")
- File selected state: thumbnail preview, filename, size, duration
- Source language selector (auto-detect default)
- Target language multi-select (flag icons + search)
- "Start Processing" button
- Upload progress: linear bar with percentage

#### 5. Job Progress Screen
- Stepper: Uploading → Extracting → Transcribing → Translating → Ready
- Animated progress indicator per step
- Time estimate ("~2 min remaining")
- "Processing in background" — user can navigate away, comes back to completed

#### 6. Subtitle Editor (most complex screen)

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: [Project name] [Language tabs: EN | ES | HI] [Export ▾] │
├──────────────────────────────┬──────────────────────────────────┤
│                              │  CUE LIST                        │
│   VIDEO PLAYER               │  ┌────────────────────────────┐  │
│   ┌──────────────────────┐   │  │ 1  00:00.0 → 00:03.2      │  │
│   │                      │   │  │    Hello, welcome...       │  │
│   │  [video frame]       │   │  ├────────────────────────────┤  │
│   │                      │   │  │ 2  00:03.5 → 00:06.1 ←sel │  │
│   │  [subtitle overlay]  │   │  │    Today we are discussing │  │
│   │                      │   │  ├────────────────────────────┤  │
│   └──────────────────────┘   │  │ 3  00:06.4 → 00:09.0      │  │
│   [  ◀◀  ▶  ▶▶  ] 00:03.5  │  │    The technology behind.. │  │
│                              │  └────────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────────┤
│  WAVEFORM TIMELINE                                              │
│  ████░░░███░░░████░░░███░░██░░░███░░                           │
│  [cue 1][  cue 2  ][cue 3][  cue 4  ]                         │
├─────────────────────────────────────────────────────────────────┤
│  CUE EDITOR (selected cue 2)                                    │
│  Text: [ Today we are discussing the future      ]             │
│  Start: [00:03.500]  End: [00:06.100]  Speaker: [Speaker 1 ▾] │
│  [B] [I] [U] | [Split] [Merge ▾] [Delete] | ⚠ 18.2 CPS        │
└─────────────────────────────────────────────────────────────────┘
```

Design must handle:
- RTL languages (Arabic, Hebrew) — text direction flip in cue editor
- Long cues (warning state: red border)
- Overlapping cues (error state)
- Multiple speaker labels (color-coded in timeline)

#### 7. Export Panel (slide-out drawer)
- Format picker: SRT / VTT / ASS / TTML / TXT (icon + description)
- Language selection (checkboxes for downloaded languages)
- Burn-in option (Studio+ locked for free users)
- Share link toggle + copy URL
- Download button

#### 8. Billing / Upgrade Page
- Current plan highlighted
- Comparison table (all plans, all features)
- Toggle: Monthly / Annual (annual shows 20% savings)
- "Upgrade" CTA on non-current plans
- Usage meter with billing period

#### 9. Settings
- Profile (name, email, avatar)
- Security (change password, 2FA)
- Billing (current plan, invoices, cancel)
- Notifications (email preferences)
- Team (invite members — Studio+ only)
- API Keys (Studio+ only)

### Priority 2 — Post-MVP

- Real-time collaboration cursors
- Team workspace
- Share link (public view-only player)
- Onboarding tour (product walkthrough overlay)
- Mobile responsive views

---

## UX Principles

### 1. Zero learning curve for core flow
A first-time user should upload a video and get subtitles without reading any documentation. Every screen should have clear primary actions.

### 2. Progress is always visible
AI processing takes time. Users must always know: what stage, what % done, how long remaining. Never a blank "loading" screen.

### 3. Destructive actions need confirmation
Delete project, delete cue, cancel subscription → always require confirmation dialog. Use red buttons only for these.

### 4. Errors explain what to do
Never show "Error 422". Show: "Your video file is too large. Upgrade to Studio to upload files up to 10 GB." with a "Upgrade" CTA.

### 5. Empty states are opportunities
Empty project list, no translations yet → use illustrated empty states with clear next-action CTAs, not blank white space.

### 6. The editor is the product
The subtitle editor is where users spend 80% of their time. Every millisecond of friction costs retention. Obsess over keyboard shortcuts, selection states, and save feedback.

---

## User Research & Testing

### Usability Testing Plan (MVP)

**Round 1 — Before launch (n=5 users)**
- Recruit: Indie YouTubers via Twitter/LinkedIn DM
- Method: Moderated Zoom sessions (45 min each)
- Tasks:
  1. "Upload this video file and get English subtitles"
  2. "Translate the subtitles to Spanish"
  3. "Fix the timing of the 3rd subtitle cue"
  4. "Download the subtitles as an SRT file"
- Success metric: Task completion rate ≥ 80% without help

**Round 2 — 2 weeks post-launch (n=5 users)**
- Recruit: New signups (in-app Typeform invite)
- Method: Unmoderated via Maze
- Focus: Upgrade flow, editor keyboard shortcuts, export

### Jobs-to-be-Done (Core)

| JTBD | User Statement |
|------|---------------|
| Global reach | "When I post content, I want subtitles in 5 languages, so my video performs in more countries" |
| Compliance | "When I publish a course, I need captions, so I meet accessibility regulations" |
| Speed | "When I have a 2-hour video, I want subtitles same day, not next week" |
| Control | "When AI makes mistakes, I need to fix them easily, not start over" |
| Trust | "When I'm paying for AI, I need to see quality metrics, not just hope it's good" |

---

## Handoff Standards

Every design handed to engineering must include:

### Figma Frame Requirements
- [ ] Mobile (375px), Tablet (768px), Desktop (1280px, 1440px) frames
- [ ] All interactive states: default, hover, focus, active, disabled, loading, error, empty
- [ ] Dark mode variant (use color tokens, not manual overrides)
- [ ] Annotated spacing (use Figma's "Measure" plugin)
- [ ] Component names match `shadcn/ui` names where possible

### Written Spec (per design)
- User story: "As a [user], I want to [action]"
- Interaction notes (hover effects, transitions, click behaviors)
- Edge cases (what if filename is 200 chars? what if 0 cues? what if translation pending?)
- Copy: all button labels, placeholders, error messages, empty states, tooltips
- Animation: which elements animate, duration, easing

### Loom Walkthrough
Record a 3–5 minute Loom for any complex feature:
- Walk through the design at all states
- Highlight key interaction details
- Note anything non-obvious for the developer

---

## Accessibility Guidelines

### Color
- Minimum 4.5:1 contrast ratio for body text (WCAG 2.1 AA)
- Minimum 3:1 for large text and UI components
- Never use color alone to convey information (add icon or label)
- Test designs with Figma's "Color Blind" view

### Typography
- Minimum 14px for body text; never smaller for interactive labels
- Line height ≥ 1.5 for body text
- Left-align body text (centered text harder to read at length)

### Touch targets
- Minimum 44×44px for all tappable elements (WCAG 2.5.5)
- At least 8px spacing between adjacent targets

### Focus states
- Every interactive element must have a visible focus ring
- Use `ring-2 ring-primary ring-offset-2` (Tailwind) — never remove default focus outline without replacement
- Design the focus state in Figma (don't leave it to the browser default)

### Icons
- Icon-only buttons must have `aria-label` — call this out explicitly in design specs
- Add tooltip on hover for icon-only actions

---

## Animation & Motion

### Principles
- **Purposeful:** animate to guide attention, not to show off
- **Brief:** transitions ≤ 300ms; loading animations as short as useful
- **Respectful:** all animations must respect `prefers-reduced-motion`

### Standard Transitions

| Transition | Duration | Easing |
|-----------|----------|--------|
| Button hover | 150ms | ease-out |
| Modal open/close | 200ms | ease-in-out |
| Dropdown open | 150ms | ease-out |
| Page transition | 300ms | ease-in-out |
| Job progress step | 400ms | ease-in-out |
| Toast notification | 250ms | ease-out |

### Framer Motion tokens (for FE reference)
```javascript
// Tell FE to use these standard values:
const transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition }
const slideUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition }
```

---

## Responsive Design

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 375–767px | Single column, bottom nav, read-only editor |
| Tablet | 768–1279px | Sidebar collapses to icon rail, editor functional |
| Desktop | 1280px+ | Full layout, all panels visible |
| Wide | 1440px+ | Max-width 1440px centered |

**Editor responsiveness:**
- Desktop: 3-panel layout (video | cue list | timeline + editor)
- Tablet: collapsible cue list panel; simplified timeline
- Mobile: View-only (editing via mobile is out of MVP scope — show banner suggesting desktop)

---

## Definition of Done

A design task is **done** when:
- [ ] All states designed (default, hover, focus, active, disabled, loading, error, empty)
- [ ] Mobile + desktop variants complete
- [ ] Dark mode tested
- [ ] Accessibility checked (contrast ratios, focus states, touch targets)
- [ ] Copy finalized (no "Lorem ipsum")
- [ ] Loom walkthrough recorded for complex features
- [ ] Figma component added to Design System library if reusable
- [ ] Dev handoff section in Figma with spacing annotations and notes
- [ ] Reviewed by PM and Tech Lead
- [ ] Marked "Ready for Dev" in Figma and Linear ticket updated

---

> 📌 Questions? Ping `#design` on Slack or tag `@designer` in Linear tickets.
> 🎨 Figma: [link to main design file]
> 🗺️ FigJam user flows: [link]
> 📹 Design walkthrough Looms: [Notion page link]
