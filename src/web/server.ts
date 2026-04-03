import express from 'express';
import { CosmosClient } from '@azure/cosmos';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'dsa-cookbook';

if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
  console.error('Missing COSMOS_ENDPOINT or COSMOS_KEY in .env');
  process.exit(1);
}

const cosmosClient = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  key: COSMOS_KEY,
  connectionPolicy: {
    requestTimeout: 10000, // 10s timeout
  }
});

app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

async function getDatabase() {
  return cosmosClient.database(COSMOS_DATABASE);
}

async function getContainer(containerName: string) {
  const db = await getDatabase();
  return db.container(containerName);
}

// Initialization: Verify connection and database/containers
async function initialize() {
  console.log('Connecting to Cosmos DB...');
  try {
    const db = await cosmosClient.database(COSMOS_DATABASE).read();
    console.log(`Successfully connected to database: ${db.database.id}`);
    
    // Check containers
    const containers = ['topics', 'problems'];
    for (const name of containers) {
      await cosmosClient.database(COSMOS_DATABASE).container(name).read();
      console.log(`Container connected: ${name}`);
    }
    
    console.log('Cosmos DB initialization successful.');
  } catch (error) {
    console.error('Failed to initialize Cosmos DB connection:');
    console.error(error);
    // We don't exit here to allow the server to start, but routes will likely fail.
  }
}

initialize();

// Health endpoint for keep-alive monitoring
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get all topics
app.get('/api/topics', async (_req, res) => {
  try {
    const container = await getContainer('topics');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    res.json(resources);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics from Cosmos DB' });
  }
});

// Get single topic by slug
app.get('/api/topics/:slug', async (req, res) => {
  try {
    const container = await getContainer('topics');
    const { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.slug = @slug',
      parameters: [{ name: '@slug', value: req.params.slug }]
    }).fetchAll();
    
    if (resources.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    res.json(resources[0]);
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic from Cosmos DB' });
  }
});

// Get all problems
app.get('/api/problems', async (_req, res) => {
  try {
    const container = await getContainer('problems');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    res.json(resources);
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({ error: 'Failed to fetch problems from Cosmos DB' });
  }
});

// Get single problem by slug
app.get('/api/problems/:slug', async (req, res) => {
  try {
    const container = await getContainer('problems');
    const { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.slug = @slug',
      parameters: [{ name: '@slug', value: req.params.slug }]
    }).fetchAll();
    
    if (resources.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    res.json(resources[0]);
  } catch (error) {
    console.error('Error fetching problem:', error);
    res.status(500).json({ error: 'Failed to fetch problem from Cosmos DB' });
  }
});

// Get problems for a topic
app.get('/api/topics/:topicSlug/problems', async (req, res) => {
  try {
    const container = await getContainer('problems');
    const { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.topicSlug = @topicSlug',
      parameters: [{ name: '@topicSlug', value: req.params.topicSlug }]
    }).fetchAll();
    res.json(resources);
  } catch (error) {
    console.error('Error fetching problems for topic:', error);
    res.status(500).json({ error: 'Failed to fetch problems for topic from Cosmos DB' });
  }
});

// TEMPORARY: Admin migration trigger for Graph slug case-sensitivity fix.
// REMOVE AFTER RUNNING.
app.get('/api/admin/run-graph-migration', async (_req, res) => {
  console.log('--- ADMIN MIGRATION START: Fixing Graph slugs ---');
  try {
    const problemsContainer = await getContainer('problems');
    const topicsContainer = await getContainer('topics');
    
    // Find problems with incorrect slugs
    const { resources: problems } = await problemsContainer.items.query({
      query: "SELECT * FROM c WHERE c.topicSlug = 'Graph'"
    }).fetchAll();
    
    console.log(`Found ${problems.length} problems to fix.`);
    let migratedCount = 0;

    for (const problem of problems) {
      const newId = `graph--${problem.slug}`;
      const newDoc = { 
        ...problem, 
        id: newId, 
        topicSlug: 'graph' 
      };
      await problemsContainer.items.upsert(newDoc);
      console.log(`  Moved: ${problem.title} -> ${newId}`);
      migratedCount++;
    }

    // Refresh count on topic
    const { resources: totalProblems } = await problemsContainer.items.query({
      query: "SELECT * FROM c WHERE c.topicSlug = 'graph'"
    }).fetchAll();

    const { resources: topicDocs } = await topicsContainer.items.query({
      query: "SELECT * FROM c WHERE c.slug = 'graph'"
    }).fetchAll();

    if (topicDocs.length > 0) {
      const topicDoc = topicDocs[0];
      topicDoc.problemCount = totalProblems.length;
      await topicsContainer.items.upsert(topicDoc);
      console.log(`  Updated 'graph' topic headcount to: ${totalProblems.length}`);
    }

    res.json({ 
      success: true, 
      migratedCount, 
      totalInGraph: totalProblems.length,
      message: 'Migration complete. Check frontend at /topic/graph'
    });
    console.log('--- ADMIN MIGRATION FINISHED: Success ---');
  } catch (error: any) {
    console.error('Migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cosmos DB API server running on http://localhost:${PORT}`);
  console.log(`Database: ${COSMOS_DATABASE}`);
});
