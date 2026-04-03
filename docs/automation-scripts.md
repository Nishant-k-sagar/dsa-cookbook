# Automation Scripts Documentation

This document describes the automation scripts used in the DSA Cookbook project for generating, managing, and pushing content to CosmosDB.

**AI Provider:** All content generation scripts use **Mistral AI** for generating problem content and C++ code solutions. You can pick as per your availability.

## Table of Contents

1. [Seed Generator](#seed-generator)
2. [Content Generator](#content-generator)
3. [Regenerate Content](#regenerate-content)
4. [Cosmos Pusher](#cosmos-pusher)
5. [Overwrite to Cosmos](#overwrite-to-cosmos)
6. [Delete from Cosmos](#delete-from-cosmos)
7. [Prompt Templates](#prompt-templates)

---

## Seed Generator

**File:** `src/web/scripts/automation/seedGenerator.ts`

Generates seed files containing problem metadata (ID, slug, title, difficulty) from LeetCode API or a public problems file.

### Usage

```bash
# From LeetCode API (requires LEETCODE_SESSION cookie)
npx tsx seedGenerator.ts --topic="Binary Search"
npx tsx seedGenerator.ts --all

# From public problems file
npx tsx seedGenerator.ts --from-public --topic=binary-search
```

### Parameters

- `--topic="<Topic Name>"` - Generate seeds for a specific topic from LeetCode API
- `--all` - Generate seeds for all configured topics
- `--from-public` - Use the public problems file instead of LeetCode API

### Output

Creates seed files in `seeds/` directory:
- `seeds/binary-search.json`
- `seeds/graph.json`
- etc.

### Notes

- Seed files contain problem metadata only (no content)
- Used problems are tracked in `seeds/{topic}.used.json` to prevent duplicates
- Topic slugs must match `TOPIC_CONFIGS` defined in `types.ts`

---

## Content Generator

**File:** `src/web/scripts/automation/contentGenerator.ts`

Generates full content (intuition, approach, pseudocode, code) for problems in seed files using AI.

### Usage

```bash
npx tsx contentGenerator.ts --topic=binary-search
npx tsx contentGenerator.ts --all
```

### Parameters

- `--topic=<topic-slug>` - Generate content for a specific topic
- `--all` - Generate content for all topics with seed files

### Behavior

- **Skips existing problems** - Checks CosmosDB before generating
- If problem exists in CosmosDB for the topic, skips generation
- Uses two Mistral API calls per problem:
  - Call 1: Generate content fields (intuition, approach, etc.)
  - Call 2: Generate C++ code

### Output

Creates/updates generated files in `generated/` directory:
- `generated/binary-search.json`
- `generated/graph.json`
- etc.

### Notes

- Respects CosmosDB state - won't regenerate existing problems
- Use `regenerateContent.ts` if you need to force regeneration

---

## Regenerate Content

**File:** `src/web/scripts/automation/regenerateContent.ts`

Regenerates content for problems in seed files WITHOUT checking if they exist in CosmosDB.

### Usage

```bash
npx tsx regenerateContent.ts --topic=graph
```

### Parameters

- `--topic=<topic-slug>` - Topic slug to regenerate

### Behavior

- **Always regenerates** - No existence checks
- Reads seeds from `seeds/{topic}.json`
- Generates content for ALL problems in seed file
- Overwrites existing `generated/{topic}.json`

### Output

Overwrites generated files in `generated/` directory.

### Notes

- Use this when you want fresh content (e.g., after updating prompts)
- Does NOT push to CosmosDB - use `overwriteToCosmos.ts` after regeneration

---

## Cosmos Pusher

**File:** `src/web/scripts/automation/cosmosPusher.ts`

Pushes generated content to CosmosDB with duplicate checking.

### Usage

```bash
npx tsx cosmosPusher.ts --topic=graph
npx tsx cosmosPusher.ts --all
```

### Parameters

- `--topic=<topic-slug>` - Push a specific topic
- `--all` - Push all topics with generated files

### Behavior

- **Skips existing problems** - Checks if problem already exists in CosmosDB
- If problem exists for the topic, skips push

### Notes

- Safe to run multiple times - won't create duplicates
- Use `overwriteToCosmos.ts` if you need to force updates

---

## Overwrite to Cosmos

**File:** `src/web/scripts/automation/overwriteToCosmos.ts`

Pushes generated content to CosmosDB WITHOUT checking for existing entries (always overwrites).

### Usage

```bash
npx tsx overwriteToCosmos.ts --topic=graph
npx tsx overwriteToCosmos.ts --all
```

### Parameters

- `--topic=<topic-slug>` - Overwrite a specific topic
- `--all` - Overwrite all topics with generated files

### Behavior

- **Always overwrites** - No existence checks
- Uses `upsertDocument` which creates or replaces documents
- Every problem in generated file is pushed to CosmosDB

### Notes

- Use when you want to update existing content
- Use after `regenerateContent.ts` to push fresh content

---

## Delete from Cosmos

**File:** `src/web/scripts/automation/deleteFromCosmos.ts`

Deletes specific problems from CosmosDB based on seed files.

### Usage

```bash
npx tsx deleteFromCosmos.ts --topic=graph
```

### Parameters

- `--topic=<topic-slug>` - Topic slug to delete problems from

### Behavior

- Reads seeds from `seeds/{topic}.json`
- For each problem in seed, queries CosmosDB by slug and topicSlug
- Deletes only problems that exist in the seed file
- Skips problems not found in CosmosDB

### Notes

- Use before regeneration to ensure clean slate
- Only deletes problems specified in seed file
- Does NOT delete all problems for a topic (granular control)

---

## Prompt Templates

**File:** `src/web/scripts/automation/promptTemplates.ts`

Contains prompt templates for AI content generation.

### Functions

#### `buildProblemContentPrompt(context)`
Generates prompt for content fields (intuition, approach, pseudocode, etc.)

**Input:** ProblemContext with title, slug, difficulty, statement, constraints, examples, hints, tags, cppTemplate

**Output:** JSON with:
- `key_observations` - Array of short insights
- `intuition` - Clear explanation with analogies
- `approach` - Step-by-step solution
- `pseudocode` - Array of pseudocode lines
- `pitfalls` - Common mistakes
- `time_complexity` - Big-O notation with explanation
- `space_complexity` - Big-O notation with explanation
- `connection_to_subtopic` - Related problems

#### `buildProblemCodePrompt(context, keyObservations)`
Generates prompt for C++ code.

**LeetCode-Centric Requirements:**
- Pass ALL test cases including large inputs
- Be OPTIMIZED for time and space complexity
- Handle edge cases (empty input, max constraints, etc.)
- Use efficient algorithms (not brute force)
- Be production-ready, not just correct

**Output:** C++ code only (no explanations)

#### `buildTopicContentPrompt(context)`
Generates prompt for topic-level content (summary, patterns, etc.)

---

## Common Workflows

### Generate New Topic Content

```bash
# 1. Generate seeds from public file
npx tsx seedGenerator.ts --from-public --topic=graph

# 2. Generate content
npx tsx contentGenerator.ts --topic=graph

# 3. Push to CosmosDB
npx tsx cosmosPusher.ts --topic=graph
```

### Regenerate Existing Topic

```bash
# 1. Delete existing problems from CosmosDB
npx tsx deleteFromCosmos.ts --topic=graph

# 2. Regenerate content (no skipping)
npx tsx regenerateContent.ts --topic=graph

# 3. Overwrite CosmosDB
npx tsx overwriteToCosmos.ts --topic=graph
```

### Update Single Problem

```bash
# 1. Delete specific problem (edit seed file first if needed)
npx tsx deleteFromCosmos.ts --topic=graph

# 2. Regenerate content
npx tsx regenerateContent.ts --topic=graph

# 3. Overwrite CosmosDB
npx tsx overwriteToCosmos.ts --topic=graph
```

---

## Environment Variables

Required in `.env` file:

```bash
# Mistral AI
MISTRAL_API_KEY=your_api_key

# CosmosDB
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=dsa-cookbook

# LeetCode (optional, for seedGenerator)
LEETCODE_SESSION=your_session_cookie
```

---

## File Structure

```
dsa-cookbook/
├── seeds/                          # Seed files (problem metadata)
│   ├── graph.json
│   ├── graph.used.json
│   └── ...
├── generated/                      # Generated content files
│   ├── graph.json
│   └── ...
└── src/web/scripts/automation/
    ├── seedGenerator.ts            # Generate seeds
    ├── contentGenerator.ts         # Generate content (with skipping)
    ├── regenerateContent.ts        # Regenerate content (no skipping)
    ├── cosmosPusher.ts             # Push to CosmosDB (with skipping)
    ├── overwriteToCosmos.ts        # Overwrite CosmosDB (no skipping)
    ├── deleteFromCosmos.ts         # Delete from CosmosDB
    ├── promptTemplates.ts          # AI prompt templates
    ├── leetCodeClient.ts           # LeetCode API client
    ├── aiClient.ts                 # Mistral AI client
    ├── cosmosClient.ts             # CosmosDB client
    ├── types.ts                    # TypeScript interfaces
    ├── config.ts                   # Configuration
    └── parseUtils.ts               # Parsing utilities