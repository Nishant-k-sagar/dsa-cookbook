import * as fs from 'fs';
import * as path from 'path';
import { examplesFromString, decodeHtmlEntities, sanitizeHtmlArray } from './parseUtils';

const GENERATED_DIR = path.join(process.cwd(), 'generated');
const OUTPUT_DIR = path.join(process.cwd(), 'public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'graph.json');

interface GeneratedTopic {
  schemaVersion?: number;
  topic: {
    id: string;
    title: string;
    summary: string;
    problemCount: number;
  };
  problems: Array<{
    id: string;
    title: string;
    topic_id: string;
    subtopic_id: string;
    leetcode_id: number;
    leetcode_slug: string;
    leetcode_url: string;
    source: string;
    difficulty: string;
    importance: string;
    rating: number;
    difficulty_bucket: string;
    tags: string[];
    time_complexity: string;
    space_complexity: string;
    pitfalls: string[];
    content: {
      statement: string;
      constraints: string;
      examples: string;
      hints: string[];
      key_observations: string[];
      intuition: string;
      approach: string[];
      pseudocode: string[];
      pitfalls: string[];
      time_complexity: string;
      space_complexity: string;
      connection_to_subtopic: string;
    };
    code: {
      cpp: string;
    };
  }>;
}

interface GraphTopic {
  id: string;
  slug: string;
  name: string;
  description: string;
  problemCount: number;
}

interface GraphProblemSet {
  id: string;
  slug: string;
  name: string;
  description: string;
  topicIds: string[];
  problemCount: number;
}

interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

interface GraphProblem {
  id: string;
  slug: string;
  leetcodeId: number;
  leetcodeUrl: string;
  title: string;
  difficulty: string;
  topicId: string;
  statement: string;
  constraints: string[];
  examples: ProblemExample[];
  hints: string[];
  content: {
    intuition: string;
    keyObservations: string[];
    approach: string;
    pseudocode: string | string[];
    pitfalls: string[];
    timeComplexity: string;
    spaceComplexity: string;
  };
  code: {
    cpp: string;
  };
}

interface GraphData {
  schemaVersion: number;
  topics: GraphTopic[];
  problems: GraphProblem[];
  problemSets: GraphProblemSet[];
  topicToProblems: Record<string, string[]>;
  problemSetToTopics: Record<string, string[]>;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseConstraints(constraintsStr: string): string[] {
  if (!constraintsStr || constraintsStr.trim() === '') {
    return [];
  }
  return constraintsStr
    .split('\n')
    .map(c => decodeHtmlEntities(c.trim()))
    .filter(c => c.length > 0);
}

function parseExamples(examplesStr: string): ProblemExample[] {
  if (!examplesStr || examplesStr.trim() === '') {
    return [];
  }
  return examplesFromString(examplesStr);
}

function flattenTopics(): GraphData {
  const topics: GraphTopic[] = [];
  const problemSets: GraphProblemSet[] = [];
  const problems: GraphProblem[] = [];
  const topicToProblems: Record<string, string[]> = {};
  const problemSetToTopics: Record<string, string[]> = {};
  let schemaVersion = 1;

  if (!fs.existsSync(GENERATED_DIR)) {
    console.log(`Generated directory not found: ${GENERATED_DIR}`);
    return { schemaVersion, topics, problems, problemSets, topicToProblems, problemSetToTopics };
  }

  const files = fs.readdirSync(GENERATED_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const data: GeneratedTopic = JSON.parse(content);

      if (data.schemaVersion !== undefined) {
        schemaVersion = data.schemaVersion;
      }

      const topic: GraphTopic = {
        id: data.topic.id,
        slug: data.topic.id,
        name: data.topic.title,
        description: data.topic.summary,
        problemCount: data.topic.problemCount
      };

      const problemSet: GraphProblemSet = {
        id: data.topic.id,
        slug: data.topic.id,
        name: data.topic.title,
        description: data.topic.summary,
        topicIds: [data.topic.id],
        problemCount: data.topic.problemCount
      };

      topics.push(topic);
      problemSets.push(problemSet);
      topicToProblems[topic.id] = [];
      problemSetToTopics[topic.id] = [topic.id];

      for (const problem of data.problems) {
        const graphProblem: GraphProblem = {
          id: problem.id,
          slug: problem.leetcode_slug || problem.id,
          leetcodeId: problem.leetcode_id || 0,
          leetcodeUrl: problem.leetcode_url || `https://leetcode.com/problems/${problem.leetcode_slug}/`,
          title: problem.title,
          difficulty: problem.difficulty,
          topicId: problem.topic_id,
          statement: problem.content?.statement || '',
          constraints: parseConstraints(problem.content?.constraints || ''),
          examples: parseExamples(problem.content?.examples || ''),
          hints: sanitizeHtmlArray(problem.content?.hints || []),
          content: {
            intuition: problem.content?.intuition || '',
            keyObservations: problem.content?.key_observations || [],
            approach: (problem.content?.approach || []).join('\n'),
            pseudocode: problem.content?.pseudocode || [],
            pitfalls: problem.content?.pitfalls || [],
            timeComplexity: problem.content?.time_complexity || '',
            spaceComplexity: problem.content?.space_complexity || ''
          },
          code: {
            cpp: problem.code?.cpp || ''
          }
        };

        problems.push(graphProblem);
        topicToProblems[topic.id].push(problem.id);
      }

      console.log(`Processed ${file}: ${data.problems.length} problems`);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err);
    }
  }

  // Add default problem sets that group multiple topics
  const allTopicIds = topics.map(t => t.id);
  const totalProblems = topics.reduce((sum, t) => sum + t.problemCount, 0);

  // DSA Fundamentals - contains all topics
  const dsaFundamentals: GraphProblemSet = {
    id: 'dsa-fundamentals',
    slug: 'dsa-fundamentals',
    name: 'DSA Fundamentals',
    description: 'Master the fundamental data structures and algorithms needed for technical interviews.',
    topicIds: allTopicIds,
    problemCount: totalProblems
  };
  problemSets.push(dsaFundamentals);
  problemSetToTopics['dsa-fundamentals'] = allTopicIds;

  // Advanced Problems - for experienced developers
  const advancedProblems: GraphProblemSet = {
    id: 'advanced-problems',
    slug: 'advanced-problems',
    name: 'Advanced Problems',
    description: 'Challenge yourself with advanced algorithmic problems for experienced developers.',
    topicIds: allTopicIds,
    problemCount: totalProblems
  };
  problemSets.push(advancedProblems);
  problemSetToTopics['advanced-problems'] = allTopicIds;

  return { schemaVersion, topics, problems, problemSets, topicToProblems, problemSetToTopics };
}

function main(): void {
  console.log('Building graph.json from generated files...');
  console.log(`Generated dir: ${GENERATED_DIR}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);

  ensureDir(OUTPUT_DIR);

  const graphData = flattenTopics();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graphData, null, 2));

  console.log(`Graph built successfully!`);
  console.log(`- Schema Version: ${graphData.schemaVersion}`);
  console.log(`- Topics: ${graphData.topics.length}`);
  console.log(`- Problems: ${graphData.problems.length}`);
  console.log(`- Output: ${OUTPUT_FILE}`);

  if (graphData.problems.length > 0) {
    const firstProblem = graphData.problems[0];
    console.log(`- Sample problem has pseudocode: ${firstProblem.content.pseudocode?.length > 0}`);
    console.log(`- Sample problem has code: ${firstProblem.code.cpp.length > 0}`);
  }
}

main();
