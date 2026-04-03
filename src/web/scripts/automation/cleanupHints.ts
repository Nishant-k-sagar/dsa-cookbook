import fs from 'fs';
import path from 'path';
import { sanitizeHtmlContent } from './parseUtils.js';

const GENERATED_DIR = path.join(process.cwd(), 'generated');

interface Problem {
  slug: string;
  leetcode_id: number;
  title: string;
  difficulty: string;
  content?: {
    hints?: string[];
    statement?: string;
    constraints?: string;
    examples?: string;
  };
  code?: {
    cpp?: string;
  };
}

interface Topic {
  topic: string;
  slug: string;
  problems: Problem[];
  schemaVersion: number;
}

function stripHtmlTags(text: string): string {
  return sanitizeHtmlContent(text);
}

function cleanHints(problem: Problem): Problem {
  if (problem.content?.hints && Array.isArray(problem.content.hints)) {
    problem.content.hints = problem.content.hints.map(hint => stripHtmlTags(hint));
  }
  return problem;
}

function cleanProblem(problem: Problem): Problem {
  problem = cleanHints(problem);
  return problem;
}

function processTopicFile(filePath: string): { cleaned: number; total: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const topic: Topic = JSON.parse(content);
  
  let cleaned = 0;
  const total = topic.problems?.length || 0;
  
  if (topic.problems) {
    for (const problem of topic.problems) {
      const originalHints = JSON.stringify(problem.content?.hints);
      cleanProblem(problem);
      const newHints = JSON.stringify(problem.content?.hints);
      
      if (originalHints !== newHints) {
        cleaned++;
      }
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(topic, null, 2), 'utf-8');
  
  return { cleaned, total };
}

function main() {
  console.log('Starting global hints cleanup...\n');
  
  if (!fs.existsSync(GENERATED_DIR)) {
    console.error(`Generated directory not found: ${GENERATED_DIR}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.json'));
  
  let totalCleaned = 0;
  let totalProblems = 0;
  
  for (const file of files) {
    const filePath = path.join(GENERATED_DIR, file);
    console.log(`Processing: ${file}`);
    
    try {
      const result = processTopicFile(filePath);
      console.log(`  - Cleaned ${result.cleaned}/${result.total} problems`);
      totalCleaned += result.cleaned;
      totalProblems += result.total;
    } catch (error) {
      console.error(`  - ERROR: ${error}`);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total files processed: ${files.length}`);
  console.log(`Total problems: ${totalProblems}`);
  console.log(`Total cleaned: ${totalCleaned}`);
  
  if (totalCleaned > 0) {
    console.log(`\nCleanup complete. Files updated. Run 'npm run build:index' to rebuild graph.json`);
  } else {
    console.log('\nNo hints needed cleaning.');
  }
}

main();
