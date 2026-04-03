# DSA Cookbook

A one stop platform for last moment dsa rivision. If you are about to appear for the interview, this is the only resource you need. This also includes the learning path for the beginners.

## What This Is

A **DSA cookbook** for structured, progressive learning from LeetCode easy to interview preparation till DSA advanced and beyond.

It is:
- A reference platform - a technical notebook you consult when studying a topic or a problem pattern
- A minimal, premium technical notebook UI (Kindle e-ink aesthetic)

It is not:
- A coding judge
- A course platform
- A social network

## Architecture

### Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Database**: Azure Cosmos DB (production)
- **Generation**: Node/tsx scripts + Mistral AI
- **Data Source**: LeetCode GraphQL + REST API

### Data Flow

```
LeetCode API
  -> contentGenerator.ts
     -> Fetches problem data from LeetCode
     -> Generates educational content via Mistral AI
  -> cosmosPusher.ts
     -> Pushes to Azure Cosmos DB
  -> cosmosAdapter.ts
     -> Frontend reads from Cosmos DB at runtime
  -> React components
```

### Directory Structure

```
dsa-cookbook/
├── content/                          # Human-authored content
├── src/
│   ├── web/
│   │   ├── scripts/automation/       # Generation scripts
│   │   ├── src/
│   │   │   ├── components/           # React components
│   │   │   ├── pages/                # Page components
│   │   │   ├── services/             # Data adapters
│   │   │   └── types/                # TypeScript interfaces
│   │   ├── seeds/                    # Seed files (problem metadata)
│   │   └── generated/                # Generated content (current run batch)
│   └── validation/                   # Schema validation
├── docs/                             # Documentation
└── AGENTS.md                         # AI agent instructions
```

## Quick Start

### Prerequisites

- Node.js 18+
- Mistral AI API key
- Azure Cosmos DB account (for production)
- LeetCode session cookie (for reliable problem fetching)

### Installation

```bash
cd src/web
npm install
```

### Environment Setup

Create `src/web/.env`:

```bash
# Mistral AI (required for generation)
MISTRAL_API_KEY=your_key_here
MISTRAL_MODEL=mistral-large-latest

# LeetCode session cookie (required for reliable fetching)
LEETCODE_SESSION=your_session_cookie_value

# Azure Cosmos DB (required for production)
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=dsa-cookbook

# Frontend data source
VITE_DATA_SOURCE=local  # or "cosmosdb" for production
```

### Local Development

```bash
cd src/web
npm run dev
```

The frontend will run on `http://localhost:5173` and read from `graph.json` in local mode.

## Content Generation Pipeline

### Step 1: Generate Seeds

```bash
cd src/web
npx tsx scripts/automation/seedGenerator.ts --topic="Binary Search"
```

### Step 2: Generate Content

```bash
npx tsx scripts/automation/contentGenerator.ts --topic=binary-search
```

### Step 3: Push to Cosmos DB

```bash
npx tsx scripts/automation/cosmosPusher.ts --topic=binary-search
```

### Step 4: Sync Local Dev

```bash
npm run build:index
```

## Available Topics

- Arrays & Hashing
- Binary Search
- Two Pointers
- Sliding Window
- Linked List
- Stack
- Queue
- Recursion
- Hash Table
- Sorting
- Greedy
- Graph
- Dynamic Programming
- Trees
- and more on the way

## Documentation

- [Architecture Blueprint](docs/Architecture%20blueprint.md) - System architecture and data contracts
- [Hybrid Content Architecture](docs/Hybrid%20content%20architecture.md) - Generation pipeline details
- [Frontend Architecture](docs/frontend%20architecture.md) - React frontend structure
- [Automation Scripts](docs/automation-scripts.md) - Script reference and usage
- [AGENTS.md](AGENTS.md) - AI agent instructions and rules
- [PROJECT_RULES.md](PROJECT_RULES.md) - Project philosophy and standards

## Contributing

Before any commit:

1. Run `npm run lint` from `src/web/`
2. Run `npm run build` from `src/web/`
3. Ensure no `.env` or sensitive files are staged
4. Follow the code standards in PROJECT_RULES.md

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License
```
