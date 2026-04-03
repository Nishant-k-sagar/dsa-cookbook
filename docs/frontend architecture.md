# DSA Cookbook - Frontend Architecture

> This document covers everything inside `src/web/`. Read `docs/architecture_blueprint.md` first for the full system context.
> This file is the canonical reference for the React frontend: structure, routing, data flow, components, pages, and build.

---

## 1. Stack

| Concern | Tool | Notes |
|---|---|---|
| Framework | React 19 | Functional components only, no class components |
| Build | Vite 7 | With gzip + brotli compression plugins |
| Language | TypeScript 5 strict | No `any`, no non-null assertions without comment |
| Routing | React Router DOM 7 | `BrowserRouter`, lazy-loaded pages |
| Markdown | react-markdown | For rendering problem statement and content fields |
| Data source (prod) | Azure Cosmos DB | via `cosmosAdapter.ts` |
| Data source (local) | `graph.json` | via `localAdapter.ts`, built by `buildGraph.ts` |
| Styling | Plain CSS modules | No component library, no utility framework |
| Compression | vite-plugin-compression | gzip + brotli on build output |

No animation library. No component library. No state management library. CSS transitions only.

---

## 2. Directory Structure

All frontend code lives under `src/web/`. This is the Vite project root.

```
src/web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── package.json
├── .env                          # Never commit - see Section 10
├── .env.example                  # Committed - documents all variables
├── public/
│   └── data/
│       └── graph.json            # LOCAL DEV ONLY - gitignored, built by buildGraph.ts
└── src/
    ├── main.tsx                  # React root, StrictMode
    ├── App.tsx                   # Router, layout shell, nav
    ├── index.css                 # CSS variables, typography, global reset
    ├── components/
    │   ├── BookmarkButton.tsx    # Session bookmark toggle (no backend)
    │   ├── FilterBar.tsx         # Difficulty/topic filter controls
    │   ├── FilterBar.css
    │   ├── Footer.tsx            # Minimal footer
    │   ├── ProblemCard.tsx       # List item for a problem
    │   ├── ProblemCard.css
    │   ├── SearchBar.tsx         # Client-side search input
    │   ├── Skeleton.tsx          # Static placeholder, no shimmer
    │   ├── Skeleton.css
    │   ├── TopicCard.tsx         # List item for a topic
    │   └── TopicCard.css
    ├── pages/
    │   ├── LearnPage.tsx         # Topic grid - entry point for Learn section
    │   ├── LearnPage.css
    │   ├── LearnTopicDetail.tsx  # Single topic: subtopics, patterns, pitfalls
    │   ├── LearnTopicDetail.css
    │   ├── ProblemDetail.tsx     # Single problem: full content
    │   ├── ProblemDetail.css
    │   ├── ProblemSetDetail.tsx  # All problems within a topic
    │   ├── ProblemSetDetail.css
    │   ├── ProblemSetList.tsx    # All topics as problem sets
    │   └── ProblemSetList.css
    ├── services/
    │   ├── dataService.ts        # Public API - ONLY import point for data
    │   ├── cosmosAdapter.ts      # Cosmos DB REST calls (production)
    │   ├── localAdapter.ts       # Local dev: reads graph.json
    │   ├── cacheService.ts       # In-memory session cache
    │   └── progressService.ts    # Local session progress (no backend)
    └── types/
        └── index.ts              # All TypeScript interfaces, no logic
```

**Notes:**
- The platform uses Azure Cosmos DB as the primary production database.
- `VITE_DATA_SOURCE` controls which adapter is active. Two values: `cosmosdb`, `local`.

---

## 3. Routing

All routes are defined in `App.tsx`. Pages are lazy-loaded with `React.lazy` and wrapped in `Suspense` with a skeleton fallback.

```
/                     -> redirect to /learn
/learn                -> LearnPage          (topic grid)
/learn/:topicId       -> LearnTopicDetail   (topic detail: patterns, subtopics, pitfalls)
/problems             -> ProblemSetList     (all topics as problem sets)
/problems/:topicId    -> ProblemSetDetail   (problems list for a topic)
/problems/:problemId -> ProblemDetail (full problem page)
```

## 4. Data Service

The frontend has one entry point for all data: `src/services/dataService.ts`.

No component, hook, or utility imports any adapter directly. No component calls `fetch()` or imports any external SDK.

### Public API

```typescript
// src/services/dataService.ts

export interface DataService {
  getTopics(): Promise<Topic[]>
  getTopicDetail(id: string): Promise<TopicDetail>
  getProblemDetail(id: string): Promise<ProblemDetail>
}

// VITE_DATA_SOURCE controls which backend is active.
// Only one adapter is used at runtime.
//
//   "cosmosdb" -> cosmosAdapter    (production)
//   "local"    -> localAdapter     (local dev only)

const source = import.meta.env.VITE_DATA_SOURCE

async function resolveAdapter(): Promise<DataService> {
  switch (source) {
    case 'cosmosdb':
      return (await import('./cosmosAdapter')).cosmosAdapter
    case 'local':
    default:
      return (await import('./localAdapter')).localAdapter
  }
}

const adapter = resolveAdapter()

export const getTopics       = (...args: Parameters<DataService['getTopics']>) =>
  adapter.then(a => a.getTopics(...args))
export const getTopicDetail  = (...args: Parameters<DataService['getTopicDetail']>) =>
  adapter.then(a => a.getTopicDetail(...args))
export const getProblemDetail = (...args: Parameters<DataService['getProblemDetail']>) =>
  adapter.then(a => a.getProblemDetail(...args))
```

Dynamic `import()` means Vite only bundles the active adapter. No dead code ships to the user.

### Adapters

**`cosmosAdapter.ts`** - used in production. Makes REST calls to Azure Cosmos DB at runtime. Each response is a complete self-contained document - no secondary fetches needed.

**`localAdapter.ts`** - used in local dev. Reads `public/data/graph.json` which is built from `src/generated/` by `buildGraph.ts`.

```typescript
let cache: GraphJson | null = null

async function loadGraph(): Promise<GraphJson> {
  if (cache) return cache
  const res = await fetch('/data/graph.json')
  if (!res.ok) throw new Error('graph.json not found - run npm run build:index first')
  cache = await res.json()
  return cache!
}

async function getTopics(): Promise<Topic[]> {
  const g = await loadGraph()
  return g.topics
}

async function getTopicDetail(id: string): Promise<TopicDetail> {
  const g = await loadGraph()
  const topic = g.topics.find(t => t.id === id)
  if (!topic) throw new Error(`Topic not found: ${id}`)
  return topic
}

async function getProblemDetail(id: string): Promise<ProblemDetail> {
  const g = await loadGraph()
  const problem = g.problems.find(p => p.id === id)
  if (!problem) throw new Error(`Problem not found: ${id}`)
  return problem
}
```

### Cache Service

`cacheService.ts` wraps `dataService.ts` with a session-scoped in-memory cache. Components use this, not `dataService.ts` directly.

```typescript
// src/services/cacheService.ts
const topicCache = new Map<string, TopicDetail>()
const problemCache = new Map<string, ProblemDetail>()
let topicsListCache: Topic[] | null = null

export async function getCachedTopics(): Promise<Topic[]> {
  if (topicsListCache) return topicsListCache
  topicsListCache = await getTopics()
  return topicsListCache
}

export async function getCachedTopicDetail(id: string): Promise<TopicDetail> {
  if (topicCache.has(id)) return topicCache.get(id)!
  const topic = await getTopicDetail(id)
  topicCache.set(id, topic)
  return topic
}

export async function getCachedProblemDetail(id: string): Promise<ProblemDetail> {
  if (problemCache.has(id)) return problemCache.get(id)!
  const problem = await getProblemDetail(id)
  problemCache.set(id, problem)
  return problem
}
```

Components call `getCachedTopics()`, `getCachedTopicDetail(id)`, `getCachedProblemDetail(id)`. The same topic or problem is never fetched twice in a session.

---

## 5. TypeScript Types

All types live in `src/types/index.ts`. No logic, no functions.

---

## 6. Pages

### LearnPage (`/learn`)

Displays all topics as a grid of `TopicCard` components.

Data: `getCachedTopics()`

Behaviour:
- `SearchBar` filters topics by title client-side
- `FilterBar` filters by `lc_rating_range` bucket
- On topic card click: navigate to `/learn/:topicId`
- On hover over topic card: prefetch `getCachedTopicDetail(id)` (fires and forgets, no await)

```tsx
// Prefetch pattern
function handleTopicHover(id: string) {
  getCachedTopicDetail(id).catch(() => {}) // warm the cache silently
}
```

### LearnTopicDetail (`/learn/:topicId`)

Full topic reference page. Reads `topicId` from route params.

Data: `getCachedTopicDetail(topicId)`

Sections rendered in order:
1. Topic title + `lc_rating_range`
2. `content.introduction` - rendered as markdown
3. Prerequisites list (plain text)
4. Subtopics list (title + description per subtopic)
5. `content.key_patterns` - rendered as markdown
6. `content.when_to_use` - rendered as markdown
7. Pitfalls - each as a `pitfall` callout (amber left border)
8. `content.common_pitfalls` - rendered as markdown
9. Link: "See all problems for this topic" -> `/problems/:topicId`

### ProblemSetList (`/problems`)

Displays all topics as a list of `TopicCard` components with problem count.

Data: `getCachedTopics()`

Same `SearchBar` and `FilterBar` as `LearnPage`. Navigation target on click: `/problems/:topicId`.

### ProblemSetDetail (`/problems/:topicId`)

All problems for a topic, as a list of `ProblemCard` components.

Data: `getCachedTopicDetail(topicId)` + `getCachedTopics()` for breadcrumb

`FilterBar` filters by difficulty (`Easy`, `Medium`, `Hard`) and importance (`Crucial`, `Optional`). Filtering is client-side, no refetch.

On hover over problem card: prefetch `getCachedProblemDetail(id)`.

On problem card click: navigate to `/problems/:problemId`.

### ProblemDetail (`/problems/:problemId`)

Full problem page. Reads both `topicId` and `problemId` from route params.

Data: `getCachedProblemDetail(problemId)` + `getCachedTopicDetail(topicId)` for breadcrumb

Sections rendered in order:
1. Breadcrumb: `Problems > {topicTitle} > {problemTitle}`
2. Problem title + metadata row: difficulty badge, rating, time/space complexity, tags
3. `BookmarkButton` (session-only, no backend)
4. **Statement** - `content.statement` rendered as markdown
5. **Constraints** - `content.constraints` as preformatted text
6. **Examples** - `content.examples` as preformatted text
7. **Hints** - collapsed by default, expand on click. Only shown if `hints.length > 0`
8. **Key Observations** - `content.key_observations` as markdown, amber left border callout
9. **Intuition** - `content.intuition` as markdown
10. **Logical Reasoning** - `content.logical_reasoning` as markdown
11. **Pseudocode** - `content.pseudocode` as code block
12. **C++ Solution** - `content.code.cpp` as code block with copy button
13. **Pitfalls** - each item in `pitfalls[]` as amber left-border callout
14. **Connection to Subtopic** - `content.connection_to_subtopic` as markdown

`react-markdown` is used for all markdown fields.

---

## 7. Components

### TopicCard

Props: `topic: Topic`, `onHover?: () => void`, `href: string`

Renders: title, summary (truncated to 2 lines), problem count, rating range badge.

No card shadow. Border only. Hover: `background: var(--bg-active)`, `border-color: var(--border-strong)`. Transition `120ms ease`.

### ProblemCard

Props: `problem: ProblemDetail`, `onHover?: () => void`, `href: string`

Renders: title, difficulty text label, rating (monospaced), importance badge, tags (first 3 only).

Difficulty colors map to state variables only:
```css
.difficulty-easy   { color: var(--state-success); }
.difficulty-medium { color: var(--state-warning); }
.difficulty-hard   { color: var(--state-error);   }
```

### SearchBar

Props: `value: string`, `onChange: (v: string) => void`, `placeholder?: string`

Uncontrolled input that calls `onChange` on every keystroke. Filtering happens in parent. No debounce needed - all filtering is synchronous on in-memory arrays.

### FilterBar

Props: `filters: FilterState`, `onChange: (f: FilterState) => void`, `options: FilterOptions`

`FilterState` and `FilterOptions` are typed in `src/types/index.ts`. Renders plain text toggle buttons - not `<select>`, not checkboxes. Active filter: `border-bottom: 2px solid var(--accent-blue)`.

### Skeleton

Static gray placeholder blocks. No shimmer. No animation.

### Footer

Static. With important links and things.

---

## 8. Progress Service

`progressService.ts` handles session-level state. No backend. Uses `sessionStorage` (cleared when tab closes - intentional, no persistent state needed).

```typescript
// src/services/progressService.ts

const BOOKMARK_KEY = 'dsa-cookbook-bookmarks'

export function getBookmarks(): string[] {
  const raw = sessionStorage.getItem(BOOKMARK_KEY)
  return raw ? JSON.parse(raw) : []
}

export function toggleBookmark(problemId: string): boolean {
  const current = getBookmarks()
  const idx = current.indexOf(problemId)
  const updated = idx === -1
    ? [...current, problemId]
    : current.filter(id => id !== problemId)
  sessionStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated))
  return idx === -1 // returns true if now bookmarked
}

export function isBookmarked(problemId: string): boolean {
  return getBookmarks().includes(problemId)
}
```

---

## 9. Build Configuration

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'gzip' }),
    viteCompression({ algorithm: 'brotliCompress' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'markdown-vendor': ['react-markdown'],
        }
      }
    }
  }
})
```

### Chunk rationale

- `react-vendor`: always needed, large, changes rarely - cache independently
- `markdown-vendor`: only needed on content pages, worth isolating

---

## 10. Environment Variables

```bash
# src/web/.env - never commit this file

# Data source for the frontend
# "cosmosdb" = Azure Cosmos DB (production)
# "local"    = local dev (reads public/data/graph.json)
VITE_DATA_SOURCE=cosmosdb

# Azure Cosmos DB (required when VITE_DATA_SOURCE=cosmosdb)
VITE_COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
VITE_COSMOS_KEY=your_cosmos_primary_key
VITE_COSMOS_DATABASE=dsa-cookbook

# --- Generation scripts (not used by the frontend at runtime) ---
MISTRAL_API_KEY=your_key_here
MISTRAL_MODEL=mistral-large-latest
LEETCODE_SESSION=your_session_cookie_value
```

```bash
# src/web/.env.example - commit this file, keep in sync with .env
VITE_DATA_SOURCE=cosmosdb

VITE_COSMOS_ENDPOINT=
VITE_COSMOS_KEY=
VITE_COSMOS_DATABASE=dsa-cookbook

MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-large-latest
LEETCODE_SESSION=
```

---

## 11. CSS Architecture

All styles follow the Kindle e-ink design system defined in `docs/frontend-design-skill.md`.

### index.css

Contains:
1. Google Fonts import (`Crimson Pro`, `Source Serif 4`, `JetBrains Mono`)
2. CSS custom property definitions for light theme (default, on `:root`)
3. CSS custom property overrides for dark theme (on `[data-theme="dark"]`)
4. Global reset (`box-sizing: border-box`, `margin: 0`, `padding: 0`)
5. Base `body` styles: `background: var(--bg-page)`, `color: var(--text-primary)`, `font-family: 'Source Serif 4'`
6. Global `a` styles: `color: var(--accent-blue)`, no underline by default, underline on hover
7. Global `code` and `pre` styles: `font-family: 'JetBrains Mono'`
8. Focus ring: `outline: 2px solid var(--accent-blue)`, `outline-offset: 2px`

### Theme switching pattern

`App.tsx` sets `data-theme` on `<html>`. CSS does the rest - no JS is involved in rendering the correct colors.

The dark theme inverts the e-ink palette: warm dark backgrounds, warm light text. The same ink-on-paper feeling, just with the paper being dark. Accent values are lightened for contrast on dark backgrounds.

Never add component styles to `index.css`. Component styles live in their own `.css` files.

### Component CSS pattern

Each component with non-trivial styles gets its own `.css` file imported directly in the component file. No CSS Modules (overkill for this scale). Class names are prefixed with the component name to avoid collisions: `.topic-card`, `.topic-card__title`, `.problem-card`, etc.

### What never appears in any CSS file

- `box-shadow` values heavier than `0 1px 0`
- `animation` keyframes (except `Skeleton.css` static placeholder colors)
- `transform: scale()` on hover
- Any hex color not defined as a CSS variable
- `font-family` values not in the defined type stack
- `border-radius` values above `4px`

---

## 12. Performance Checklist

Before any component is considered complete:

- [ ] Data calls go through `cacheService.ts`, not `dataService.ts` directly
- [ ] Page components are `React.lazy` imports in `App.tsx`
- [ ] `Suspense` fallback uses a skeleton component, not a spinner
- [ ] Hover prefetch implemented on `TopicCard` and `ProblemCard` where navigation follows
- [ ] No `console.log` statements
- [ ] No hardcoded strings for topic names, problem IDs, or any content
- [ ] `npm run lint` passes
- [ ] `npm run build` passes with no type errors
- [ ] Renders correctly at 375px width (iPhone SE) and 1440px width (desktop)
- [ ] All interactive elements have visible focus styles (do not suppress outline)
- [ ] Problem list with 50+ items does not cause visible scroll lag (verify in Chrome DevTools)