# Hybrid Content Generation Architecture

> This document describes the generation pipeline in detail.
> It is written for both human developers and AI agents reading the codebase.
> For the full system architecture, see `docs/architecture_blueprint.md`.

---

## Overview

The platform uses a **hybrid content generation approach**:

- **LeetCode API** provides problem statements, examples, hints, and C++ function templates. This data is authoritative. It is fetched, sanitized, and used as-is.
- **AI** generates educational content: intuition, key observations, approach steps, pseudocode, pitfalls, complexity analysis, and topic patterns. This data is generated fresh and validated before use.
- **Azure Cosmos DB** stores and serves final content (current primary).
---

## Pipeline Overview

```
Topic config (name + tags) from TOPIC_CONFIGS in types.ts
        |
        v
seedGenerator.ts
  - Calls LeetCode REST API for full problem list (with GraphQL for metadata)
  - Filters by topic tags using scoring algorithm
  - Selects best N problems based on popularity, acceptance rate, difficulty mix
  - Alternative: --from-public flag reads from publicaly_available_problems.json
  - Prevents duplicate seeds by tracking used problems in `{topic}.used.json` files
        |
        v
src/web/seeds/{topic}.json
  - Array of selected problems with id, slug, title, category
        |
        v
contentGenerator.ts
  - Checks schemaVersion on seed file. Aborts if mismatch.
  - For each problem in seed:
      - Fetches full problem from LeetCode GraphQL (cached 24h, requires LEETCODE_SESSION)
      - DIRECT COPY to output (no tokens): statement, constraints, examples, hints, title, tags, difficulty
      - Sanitizes HTML for statement and constraints before storing
      - Call 1: AI generates content fields (key_observations, intuition, approach, pseudocode, pitfalls, time_complexity, space_complexity, connection_to_subtopic)
      - Call 2: AI generates code.cpp using C++ template + key_observations from Call 1
      - Both calls use max_tokens: 32000
      - If either call fails after retries: skip problem, log, continue
      - Validates all fields non-empty before writing
  - Writes only the newly generated problems for the current run
  - Writes schemaVersion to output
        |
        v
src/web/generated/{topic}.json
  - schemaVersion: 1
  - topic: TopicContent
  - problems: ProblemContent[] for the current run batch only
        |
        v
Validation (inline in parseUtils.ts and contentGenerator.ts)
  - validateSeedFile() and validateGeneratedFile() check schemaVersion (parseUtils.ts)
  - validateContentFields() and validateCodeFields() check AI output (contentGenerator.ts)
  - No separate validator.ts - validation is integrated into generation and push
        |
        +--> cosmosPusher.ts (PRODUCTION)
        |      - Reads src/web/generated/{topic}.json
        |      - Skips same-topic duplicates
        |      - Creates new topics and problems via POST
        |      - Reports pushed/skipped counts
        |      - back4appPusher.ts is legacy, not in active codebase
        |      - firebasePusher.ts is legacy, not in active codebase
        |            |
        |            v
        |      Azure Cosmos DB
        |      (complete documents, served to frontend at runtime via cosmosAdapter.ts)
        |
        +--> buildGraph.ts (LOCAL DEV SYNC)
               - Reads src/web/generated/ directly (documents already complete, no merge needed)
               - Flattens into graph structure with index maps
               - Adds problem sets (DSA Fundamentals, Advanced Problems)
               - Writes src/web/public/data/graph.json (gitignored)
               - Run: npm run build:index from src/web/

Frontend (React 19 + Vite)
  - Production (VITE_DATA_SOURCE=cosmosdb): cosmosAdapter.ts -> Azure Cosmos DB REST API at runtime
  - Local dev  (VITE_DATA_SOURCE=local):    localAdapter.ts    -> graph.json
  - Same dataService.ts API, same React components, both modes
```

---

## Scripts Reference

All scripts are in `src/web/scripts/automation/`.

| File | Responsibility |
|------|---------------|
| `seedGenerator.ts` | Generates `src/web/seeds/{topic}.json` with schemaVersion. Uses scoring algorithm to select problems from LeetCode. Supports `--from-public` flag for public problem list. |
| `contentGenerator.ts` | Two AI calls per problem. Generates only problems missing in Cosmos DB for the same `topicSlug`, then writes the current run batch to `src/web/generated/{topic}.json`. Uses `aiClient.ts` abstraction. |
| `leetCodeClient.ts` | All LeetCode API calls (REST + GraphQL). Cache in `.leetcode-cache/` with 24h TTL. Rate limits at 1s between requests. |
| `AIClient.ts` | All AI API calls. Retry with exponential backoff (max_tokens: 32000). |
| `aiClient.ts` | Abstraction layer over AI. Provides `call()` and `callForJson()` methods. |
| `promptTemplates.ts` | Prompt construction. Returns strings. No side effects. |
| `parseUtils.ts` | HTML sanitization, JSON parsing, schemaVersion check, field validation. |
| `back4appPusher.ts` | Pushes to Back4App Parse Server (active). Skips same-topic duplicates. |
| `buildGraph.ts` | Builds `graph.json` from generated files. Adds problem sets (DSA Fundamentals, Advanced Problems). |
| `types.ts` | TypeScript interfaces and `TOPIC_CONFIGS` constant. |
| `config.ts` | Reads env variables. Exports typed config object. |
| `back4appDeleteFromSeed.ts` | Utility to delete problems from Back4App based on seed file. |
| `back4appOverwriteFromSeed.ts` | Utility to overwrite problems in Back4App from seed file. |
| `buildLeetCodeMetadataCache.ts` | Builds metadata cache from LeetCode. |
| `cleanupHints.ts` | Utility to clean up hints in generated files. |
| `deleteSlidingWindow.ts` | Utility to delete sliding window topic. |
| `googleAuth.ts` | Google authentication utilities. |

---

## Step 1 - Seed Generation

**Script:** `seedGenerator.ts`
**Input:** Topic name + LeetCode tags from `TOPIC_CONFIGS` in `types.ts`
**Output:** `src/web/seeds/{topic}.json`

```
seedGenerator.ts
  |
  +-- fetchProblemList() [leetCodeClient.ts]
  |     GET https://leetcode.com/api/problems/algorithms/ (REST)
  |     + GraphQL for metadata (tags, acceptance rate)
  |     Cache: .leetcode-cache/problem-list.json (24h TTL)
  |     Returns: array of {id, slug, title, difficulty, tags, totalSubmitted, acceptanceRate}
  |
  +-- Scoring Algorithm (no AI)
  |     - Filters by topic tags
  |     - Scores by: popularity (log submissions), acceptance rate band, difficulty mix
  |     - Applies submission thresholds with fallback relaxation
  |     - Selects top N problems (default 8 per topic)
  |     - Difficulty target: 25% Easy, 50% Medium, 25% Hard
  |
  +-- Alternative: --from-public flag
  |     Reads from public/publicaly_available_problems/publicaly_availabale_problems.json
  |     Skips already-generated problems
  |
  +-- Write src/web/seeds/{topic}.json with schemaVersion: 1
```

**Commands:**
```bash
# Single topic
npx tsx seedGenerator.ts --topic="Binary Search"

# All topics from TOPIC_CONFIGS
npx tsx seedGenerator.ts --all

# From public problem list
npx tsx seedGenerator.ts --from-public --topic=binary-search
```

---

## Step 2 - Content Generation (Two AI Calls Per Problem)

**Script:** `contentGenerator.ts`
**Input:** `src/web/seeds/{topic}.json`
**Output:** `src/web/generated/{topic}.json` for the current run batch

```
contentGenerator.ts
  |
  +-- Read src/web/seeds/{topic}.json
  +-- checkSchemaVersion(seed, SEED_SCHEMA_VERSION) [parseUtils.ts]
  |     Aborts if mismatch. Stale seed files must be regenerated.
  |
  +-- For each problem (sequential, 1s delay between LeetCode fetches):
  |
  |     +-- checkProblemExistsInBack4App(slug, topicSlug)
  |     |     If problem exists for same topic: skip content generation (saves AI calls)
  |     |
  |     +-- fetchProblem(slug) [leetCodeClient.ts]
  |     |     POST https://leetcode.com/graphql
  |     |     Cookie: LEETCODE_SESSION from env
  |     |     Cache: .leetcode-cache/{slug}.json (24h TTL)
  |     |     On blocked/failed with no cache: log slug, skip problem, continue
  |     |     On 401 (session expired): abort entire script
  |     |
  |     --- DIRECT COPY FROM LEETCODE ---
  |     +-- extractPureStatement(problem.content) -> content.statement
  |     +-- extractConstraints(problem.content)   -> content.constraints
  |     +-- parseExamplesFromContent(problem.content) -> content.examples (JSON string)
  |     +-- problem.hints                         -> content.hints (array, can be empty)
  |     +-- problem.title                         -> title
  |     +-- problem.questionId                    -> leetcode_id
  |     +-- problem.difficulty                    -> difficulty
  |     +-- problem.topicTags[].name              -> tags
  |     +-- getCppTemplate(problem.codeSnippets)  -> held for Call 2 prompt
  |     |
  |     --- CALL 1: Content fields [aiClient.ts] ---
  |     +-- buildProblemContentPrompt() [promptTemplates.ts]
  |     |     Includes: sanitized statement as context, hints, tags, difficulty, topic
  |     |     Requests: key_observations, intuition, approach, pseudocode, pitfalls, time_complexity, space_complexity, connection_to_subtopic
  |     |     States explicitly: "do not reproduce the statement in your output"
  |     |
  |     +-- aiClient.callForJson()  max_tokens: 32000, retry up to 5 times
  |     |
  |     +-- parseLLMJson() [parseUtils.ts] - throws on invalid, no recovery
  |     +-- validateContentFields()        - all 8 fields must be non-empty
  |     |     On any failure: log slug + reason, skip problem
  |     |
  |     --- CALL 2: Code field [aiClient.ts] ---
  |     +-- buildProblemCodePrompt() [promptTemplates.ts]
  |     |     Includes: C++ template, problem title, difficulty, key_observations from Call 1
  |     |     Requests: code.cpp only
  |     |
  |     +-- aiClient.call()  max_tokens: 32000, retry up to 3 times
  |     |
  |     +-- stripMarkdownCodeFences() -> validateCodeFields()
  |     |     On failure after 3 retries: log slug + "code call failed", skip problem
  |     |
  |     +-- Merge: LeetCode direct copy + Call 1 + Call 2 = complete GeneratedProblem
  |
  +-- buildTopicContentPrompt() [promptTemplates.ts]
  |     Aggregates tags and problem list from all successfully generated problems
  |
  +-- Write src/web/generated/{topic}.json with schemaVersion: 1
  |     Contains only the newly generated problems for this run
```

**Field sources summary:**
- `statement`, `constraints`, `examples`, `hints`, `title`, `leetcode_id`, `difficulty`, `tags` - generated using LeetCode GraphQL
- `key_observations`, `intuition`, `approach`, `pseudocode`, `pitfalls`, `time_complexity`, `space_complexity`, `connection_to_subtopic` - AI Call 1 (via `aiClient.callForJson()`)
- `code.cpp` - AI Call 2 (via `aiClient.call()`, then `stripMarkdownCodeFences()`)
- `topic_id`, `subtopic_id`, `importance`, `rating`, `difficulty_bucket`, `leetcode_url` - assigned by pipeline logic

---

## Step 3 - Validation

**Note:** There is no separate `validator.ts` file. Validation is integrated into the generation and push scripts via functions in `parseUtils.ts` and `contentGenerator.ts`.

**Validation functions in `parseUtils.ts`:**

| Function | Purpose |
|----------|---------|
| `validateSeedFile()` | Checks `schemaVersion`, `topic`, `topicSlug`, `problems` array, and required fields on each problem |
| `validateGeneratedFile()` | Checks `schemaVersion`, `topic`, `problems` array |
| `checkSchemaVersion()` | Generic schema version check, throws on mismatch |

**Validation functions in `contentGenerator.ts`:**

| Function | Purpose |
|----------|---------|
| `validateContentFields()` | Checks all 8 AI Call 1 fields are non-empty (key_observations, intuition, approach, pseudocode, pitfalls, time_complexity, space_complexity, connection_to_subtopic) |
| `validateCodeFields()` | Checks `code.cpp` is non-empty and contains "class Solution" |

**Validation in `contentGenerator.ts`:**
- `validateSeedFile()` called at start, aborts if seed is invalid
- `validateContentFields()` called after Call 1, skips problem if invalid
- `validateCodeFields()` called after Call 2, skips problem if invalid (after 3 retries)

**Validation in `cosmosPusher.ts`:**
- Checks that `content.statement`, `content.constraints`, `content.examples` are non-empty
- Checks that `code.cpp` contains "class Solution"
- Skips problems that already exist in Cosmos DB (no overwrite)

**Validation failure behavior:** log the field that failed and the document ID. Skip that document. Continue to the next. Never abort the batch for one bad document.

---

## Step 4 - Push to Cosmos DB

**Script:** `cosmosPusher.ts` (current active pusher)
**Input:** `src/web/generated/{topic}.json` (current run batch)
**Output:** Documents in Azure Cosmos DB `topics` and `problems` containers

**Duplicate check behavior:** Topic records are looked up by topic name or slug. Problem records are checked only within the same `topicSlug`.

```
cosmosPusher.ts
  |
  +-- Read src/web/generated/{topic}.json
  |
  +-- For topic:
  |     queryDocuments('topics', { slug }) to check if exists
  |     If exists: update via upsertDocument
  |     If not: create via upsertDocument
  |
  +-- For each problem:
  |     queryDocuments('problems', {
  |       topicSlug,
  |       $or: [{ slug }, { title }]
  |     }) to check if exists for SAME topic
  |     If exists for same topic: skip - logs "already exists for topic {topicSlug}, skipping"
  |     If not: create via upsertDocument
  |     Note: Same problem can exist in multiple topics with different content
  |
  +-- Report: N pushed, M skipped
```

**Cosmos DB REST API:**
```
Base URL: {COSMOS_ENDPOINT}
Auth: {COSMOS_KEY}
Database: {COSMOS_DATABASE}
```

**Note:** `back4appPusher.ts` is legacy and not in active codebase. `firebasePusher.ts` is legacy and not in active codebase.

**Additional utilities:**
- `deleteFromCosmos.ts` - Delete problems from Cosmos DB based on seed file
- `overwriteToCosmos.ts` - Overwrite problems in Cosmos DB from seed file

---

## API Contracts

### LeetCode REST API

```
GET https://leetcode.com/api/problems/algorithms/
Returns: { stat_status_pairs: [{ stat: { question_id, question__title_slug, question__title }, difficulty: { level }, paid_only }] }
Used by: seedGenerator.ts to get the full problem list
Cache: 24h TTL
```

### LeetCode GraphQL API

```
POST https://leetcode.com/graphql
Query: see Architecture blueprint.md
Returns: full problem data including content (HTML), hints, codeSnippets
Used by: contentGenerator.ts to get full problem detail
Cache: 24h TTL per slug
Rate limit: 1s between requests
```

### AI API

```
POST https://api.AI.ai/v1/chat/completions
Body: { model, messages, temperature: 0.3, max_tokens: 32000 }
Auth: Authorization: Bearer {AI_API_KEY}
Calls per problem: 2 (content fields, then code field)
Retry: 5 attempts with exponential backoff starting 25s
On 429: respect retry-after header
```

### Azure Cosmos DB REST API (current active)

```
Base URL: {COSMOS_ENDPOINT}
Auth: {COSMOS_KEY}
Database: {COSMOS_DATABASE}

Endpoints used:
  GET    /dbs/{db}/colls/{coll}/docs         Query documents
  POST   /dbs/{db}/colls/{coll}/docs         Create document
  PUT    /dbs/{db}/colls/{coll}/docs/{id}    Upsert document

Frontend read pattern (via dataService.ts):
  cosmosAdapter.ts queries Cosmos DB at runtime
```

---

## Error Handling Reference

| Situation | Behavior |
|-----------|---------|
| LeetCode rate limited | 1s delay between requests, built into client |
| LeetCode blocked (403/429, no cache) | Log slug + reason, skip problem, continue. Report blocked slugs at end. |
| LeetCode session expired (401) | Abort entire script. Refresh LEETCODE_SESSION in .env. |
| LeetCode fetch fails (network) | Retry 3 times with 2s delay, then skip problem. |
| AI Call 1 returns invalid JSON | Log slug + "content call failed", skip problem. No recovery. |
| AI Call 2 returns invalid JSON | Retry up to 3 times, then log slug + "code call failed", skip problem. |
| AI rate limited (429) | Respect retry-after header, exponential backoff, 5 retries |
| schemaVersion mismatch on seed | Abort with filename. Regenerate the seed. |
| schemaVersion mismatch on generated | Abort with filename. Regenerate the topic. |
| Validation fails for a document | Log document ID + failed field, skip push, continue |
| Parse Server write fails | Log document ID + HTTP status, continue to next |
| All problems fail in a topic | Do not push topic document either |
| LeetCode cache missing during buildGraph.ts | Abort buildGraph. Re-fetch missing slugs first. |

---

## Environment Variables

Required for generation and push scripts (set in `src/web/.env`):

```bash
# AI - required for all generation
AI_API_KEY=your_key
AI_MODEL=ai_model  # default: actual AI model

# LeetCode session cookie - required for reliable problem fetching
# Get from: browser devtools -> Application -> Cookies -> leetcode.com -> LEETCODE_SESSION
LEETCODE_SESSION=your_session_cookie_value

# Azure Cosmos DB - required for push scripts
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=dsa-cookbook

# Frontend data source
VITE_DATA_SOURCE=local  # or "cosmosdb" for production
```

The frontend reads `VITE_DATA_SOURCE` at runtime to switch between local and Cosmos DB modes. In local mode, it reads `graph.json`. In Cosmos DB mode, it reads from Cosmos DB REST API.

---

## Commands

All commands run from `src/web/` unless noted.

```bash
# Step 1: Generate seed files
npx tsx scripts/automation/seedGenerator.ts --topic="Binary Search"
npx tsx scripts/automation/seedGenerator.ts --all
npx tsx scripts/automation/seedGenerator.ts --from-public --topic=binary-search

# Step 2: Generate content (2 AI calls per problem)
npx tsx scripts/automation/contentGenerator.ts --topic=binary-search
npx tsx scripts/automation/contentGenerator.ts --all

# Step 3: Push to Cosmos DB
npx tsx scripts/automation/cosmosPusher.ts --topic=binary-search
npx tsx scripts/automation/cosmosPusher.ts --all

# Step 4: Sync local dev graph.json from generated/ files
npm run build:index

# Step 5: Verify locally (set VITE_DATA_SOURCE=local in .env)
npm run dev

# Utility commands
npx tsx scripts/automation/deleteFromCosmos.ts --topic=binary-search
npx tsx scripts/automation/overwriteToCosmos.ts --topic=binary-search
npx tsx scripts/automation/cleanupHints.ts
npx tsx scripts/automation/buildLeetCodeMetadataCache.ts

# Frontend commands
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint + TypeScript check
```
