# PROJECT_RULES.md - DSA Cookbook

> Read this before `AGENTS.md`. This defines why we build what we build and how.

---

## 1. What This Platform Is

A **DSA cookbook** for structured, progressive learning from LeetCode easy to interview preparation till DSA advanced and beyond.

It is not:
- A coding judge
- A course platform
- A social network
- An AI chatbot

It is a **reference platform** - a technical notebook you consult when studying a topic or a problem pattern.


---

## 3. Format Rules

### JSON for machine data, YAML for human data

Machine-generated files (`src/generated/`, `src/seeds/`) use JSON.

Human-authored files (`content/topics/`, `content/problems/`) use Markdown with YAML frontmatter.

The reasoning: LLM-generated YAML fails silently on truncation and has inconsistent quoting. JSON fails loudly, which is better. Human-authored YAML is fine because humans and editors handle it correctly.

Never ask Mistral to output YAML. Always JSON.

### Prompts must specify the exact JSON schema
Every Mistral prompt must include the exact field names, types, and constraints in the prompt. "Generate content for this problem" is an unacceptable prompt. See `docs/architecture_blueprint.md` Section 8 for the exact prompt templates.

---

## 4. Architecture Rules

### Strict layer separation
There are 5 layers. Each does one thing.

Forbidden patterns:
- Generation script importing React or Vite
- React component importing Firebase directly
- Frontend reading `graph.json` or calling Cosmos DB directly (must go through `dataService.ts`)
- Hardcoded topic names, slugs, or problem data anywhere in the frontend
- Editing `src/generated/` files manually


### The Mistral client is the way to talk to Mistral
All Mistral API calls go through `mistralClient.ts`. No other file makes HTTP calls to Mistral. Retry logic, token limits, and error handling live here only.

---

## 5. Generation Rules

### Cache LeetCode aggressively
LeetCode rate limits. Every problem fetch is cached for 24 hours in `src/.leetcode-cache/`. Do not bypass the cache during development. Do not commit the cache.

### One problem failure must not stop the pipeline
If a problem fails (LeetCode fetch fails, Mistral returns garbage, JSON parse fails after recovery attempt), log the failure with the slug and reason, then continue to the next problem. Report all failures at the end. Never abort the full topic generation for one bad problem.

### Validate before pushing, always
The push scripts must refuse to push any document that fails validation. Partial data in db is worse than no data. A topic with missing pitfalls or no C++ code should not reach production.

### Token budget
Mistral `max_tokens` is set to 64000 per call. Call 1 (content fields) and Call 2 (code) are always separate calls - do not combine them. Keeping them separate prevents truncation on either, and makes Call 2 independently retryable.

---

## 6. UI Rules

### Kindle e-ink aesthetic
The UI must feel like reading a well-typeset technical book. It is not a dashboard. It is not a social product. It is not a marketing page.

Specifically:
- Minimal color usage. Near-monochromatic with one accent.
- Typography-first layout. Code and prose are the content.
- No animations that don't serve navigation or state feedback.
- No decorative elements.
- No hero sections, banners, or marketing copy.

### No hardcoded content
The frontend must work for any valid topic or problem in the data. Adding a new topic must never require touching a React file.

---

## 7. Code Standards

- No unnecessary comments. If the code is not obvious, refactor it first. Comment only when refactoring would obscure the intent.
- No em-dashes. Use a plain dash.
- No emojis.
- No `any` in TypeScript. If you don't know the type, figure it out. `unknown` with a type guard is acceptable.
- No `console.log` left in production code. Use a logger in scripts, remove debug logs in frontend.
- Functional components only in React. No class components.
- One concern per file. A file that does two things should be two files.

---

## 8. When You Don't Know

If a requirement is ambiguous, do the following in order:

1. Check `docs/architecture_blueprint.md` for the specific contract
2. Check existing files for precedent
3. Do the simpler thing
4. Leave a `// TODO: [describe the ambiguity]` and flag it

Do not invent architecture. Do not add abstractions that are not needed yet.

---

## 9. Definition of Done

A feature is done when:
- `npm run validate` passes
- `npm run lint` passes from `src/web/`
- `npm run build` passes from `src/web/`
- No `.env` or `serviceAccountKey.json` committed
- The feature works in both local dev mode (`VITE_DATA_SOURCE=local`) and production mode (`VITE_DATA_SOURCE=cosmosdb`)
- Generated content for at least one topic passes through the full pipeline end to end