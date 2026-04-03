import type { Difficulty } from './types.js';

export interface ProblemContext {
  title: string;
  slug: string;
  difficulty: Difficulty;
  statement: string;
  constraints: string;
  examples: string;
  hints: string[];
  tags: string[];
  topicSlug: string;
  cppTemplate: string;
}

export interface TopicContext {
  topicName: string;
  topicSlug: string;
  tags: string[];
  problems: Array<{
    title: string;
    difficulty: Difficulty;
    tags: string[];
  }>;
}

export function buildProblemContentPrompt(context: ProblemContext): string {
  const hintsText = context.hints.length > 0 
    ? `Hints from LeetCode:\n${context.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : 'No hints available.';

  return `You are a patient DSA tutor creating content for beginners. Use an encouraging, supportive tone.

Problem: ${context.title}
Slug: ${context.slug}
Difficulty: ${context.difficulty}
Topic: ${context.topicSlug}
Tags: ${context.tags.join(', ')}

Problem Statement (do not reproduce in output):
${context.statement}

Constraints:
${context.constraints}

Examples:
${context.examples}

${hintsText}

Generate educational content for this problem which is great for beginners. The content is very refined and very premium, not generic. The content generated is strictly for the given problem and includes everything needed to understand and solve the problem. Your response must be ONLY valid JSON with this exact schema. Use ARRAYS for list fields:

{
  "key_observations": ["observation1", "observation2", "observation3", "and so on"],
  "intuition": "A clear explanation with analogies or real-world examples. Explain what insight makes this problem click. Use 5-7 sentences.",
  "approach": ["step1 with why it helps", "step2 with why it helps", "step3 with why it helps", "and so on"],
  "pseudocode": ["line1", "line2", "line3", "and so on"],
  "pitfalls": ["common mistake 1", "common mistake 2", "and so on"],
  "time_complexity": "O(...) with a brief explanation of why",
  "space_complexity": "O(...) with a brief explanation of why",
  "connection_to_subtopic": "Brief connection to related problems"
}

Requirements:
- key_observations: array of 2-6 short strings (under 15 words each)
- intuition: single string, 2-4 sentences with analogies where helpful
- approach: array of 3-4 short strings explaining both what to do and why
- pseudocode: array of 3-8 short strings or as per need of the problem
- pitfalls: array of 1-2 short strings or as per need of the problem
- time_complexity: string like "O(n log n)"
- space_complexity: string like "O(n)"
- Use simple language, avoid jargon
- Output ONLY valid JSON, no markdown fences, no explanation`;
}

// export function buildProblemCodePrompt(context: ProblemContext, keyObservations: string): string {
//   const hintsText = context.hints.length > 0
//     ? context.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')
//     : 'No hints available.';

//   const keyObsText = keyObservations
//     ? keyObservations.split('; ').map((obs, i) => `${i + 1}. ${obs.trim()}`).join('\n')
//     : 'No key observations available.';

//   return `You are a world-class C++ competitive programmer solving a LeetCode problem. You ALWAYS produce the most optimal solution possible.

// CRITICAL RULE: DO NOT write brute force or naive solutions. Skip them entirely. Go directly to efficient algorithms.

// THINKING PROCESS (do this mentally before writing code):
// 1. FIRST: Analyze the constraints - they tell you what time complexity is acceptable
//    - n <= 10: O(n!) or O(2^n) is fine
//    - n <= 20: O(2^n) is fine
//    - n <= 100: O(n^3) is fine
//    - n <= 1000: O(n^2) is fine
//    - n <= 10^5: O(n log n) or O(n) required
//    - n <= 10^6: O(n) or O(n log n) required
// 2. DO NOT consider brute force - skip directly to efficient approaches
// 3. For string/search problems with word lists: use pattern matching or bidirectional search
// 4. For graph problems: use BFS/DFS with proper optimization (visited tracking, bidirectional)
// 5. For DP problems: use memoization or tabulation, not recursion without memoization
// 6. Implement the optimal solution directly

// Problem: ${context.title}
// Difficulty: ${context.difficulty}
// Topic: ${context.topicSlug}

// Problem Statement:
// ${context.statement}

// Constraints:
// ${context.constraints}

// Examples:
// ${context.examples}

// Hints:
// ${hintsText}

// Key Observations:
// ${keyObsText}

// C++ Template (use this exact signature):
// ${context.cppTemplate}

// CRITICAL REQUIREMENTS:
// - Consider each problem leetcode hard tagged. Generate the standard accepted LeetCode Hard optimized solution.
// - SKIP NAIVE APPROACHES - do not implement O(n^2) when O(n log n) or O(n) is possible
// - The solution MUST be optimal for the given constraint
// - All the problems are from leetcode, so you can use leetcode sources to come up with solution.
// - Handle ALL edge cases: empty input, single element, max constraints, negative numbers, duplicates
// - Use efficient C++ patterns:
//   * Pass large objects by reference, not by value
//   * Use '\n' instead of endl
//   * Avoid unnecessary string copies
//   * Use appropriate STL algorithms (lower_bound, upper_bound, etc.)
// - The code must compile and pass all test cases

// Generate ONLY the C++ code. Requirements:
// - Use the exact function signature from the template
// - Include necessary headers
// - Use standard C++17 features
// - Add brief comments only for non-obvious algorithmic choices
// - Output ONLY the code, no explanations, no markdown fences`;
// }

export function buildProblemCodePrompt(context: ProblemContext, keyObservations: string): string {
  const hintsText = context.hints.length > 0
    ? context.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : 'No hints available.';

  const keyObsText = keyObservations
    ? keyObservations.split('; ').map((obs, i) => `${i + 1}. ${obs.trim()}`).join('\n')
    : 'No key observations available.';

  return `You are a world-class C++ competitive programmer solving a LeetCode problem.
You ALWAYS produce the most optimal accepted solution. You are great at coming up with
ideas for solutions for hard problems. You are profecient at pattern recognition and 
handling problems which expands across multiple topics. You take care exceptionally 
well for the edge cases, ans always considers in resolving edge case at the highest priority.
Second priority is to write the time complexity suitable code(No TLE throwing).

CRITICAL RULES:
- DO NOT write brute force
- DO NOT write naive solutions
- DO NOT write suboptimal complexity
- Skip directly to optimal algorithm
- Treat every problem as LeetCode Hard

COMPLEXITY ENFORCEMENT:
- Always choose lowest possible time complexity
- If multiple solutions exist choose asymptotically best
- Avoid O(n^2) if O(n log n) exists
- Avoid O(n log n) if O(n) exists
- Avoid recursion if iterative faster
- Avoid map/set if vector/array possible

THINKING PROCESS (mental):

1. Determine complexity target from constraints:
- n <= 10: O(n!)
- n <= 20: O(2^n)
- n <= 100: O(n^3)
- n <= 1000: O(n^2)
- n <= 1e5: O(n log n) or O(n)
- n <= 1e6: O(n)

2. Choose BEST algorithm category:

Graph:
- BFS / DFS
- Bidirectional BFS
- Multi-source BFS
- 0-1 BFS
- Dijkstra
- Topological sort
- DAG DP
- Union Find
- Minimum spanning tree
- BFS + DFS shortest path DAG

Dynamic Programming:
- Memoization / Tabulation
- Rolling DP
- Bitmask DP
- Interval DP
- Tree DP
- Digit DP
- DP + prefix sum
- DP + monotonic queue
- DP + binary search

Search / Optimization:
- Binary search
- Binary search on answer
- Two pointers
- Sliding window
- Meet in the middle

Greedy:
- Sorting + greedy
- Heap greedy
- Interval greedy

Data Structures:
- Heap / priority queue
- Monotonic stack
- Monotonic queue
- Deque optimization
- Prefix sum
- Difference array
- Fenwick tree
- Segment tree
- Coordinate compression
- Sweep line
- Ordered set

Strings:
- Trie
- Rolling hash
- Double hashing
- KMP
- Z algorithm
- Prefix function
- Aho corasick

CRITICAL OPTIMIZATION RULES:

General:
- Avoid recomputation
- Use pruning aggressively
- Use early exits
- Avoid unnecessary states
- Prefer indices over objects
- Use optimal DS
- Avoid copying containers
- Use references

DFS / Backtracking:
- Prune early
- Sort for pruning
- Skip duplicates
- Use index recursion
- Use visited tracking
- Use memoization if overlap

BFS:
- Use level-based BFS
- Mark visited correctly
- Remove visited level-wise
- Avoid revisits
- Use queue efficiently

SHORTEST PATH ENUMERATION:
- Use BFS to compute minimum distance
- Maintain distance map
- Build shortest-path DAG only
- Only connect when dist[next] == dist[cur] + 1
- Remove visited level-wise
- Avoid full graph
- DFS only on shortest DAG
- Prune non-shortest transitions

GRAPH HARD RULES:
- Use bidirectional BFS when start and end known
- Use multi-source BFS
- Use Dijkstra for weighted graph
- Use 0-1 BFS for binary weights
- Use topo DP for DAG
- Use union find for connectivity
- Generate neighbors on-the-fly

DP OPTIMIZATION:
- Reduce dimensions
- Use rolling arrays
- Use prefix sum optimization
- Use monotonic queue optimization
- Use bitmask compression

TWO POINTER OPTIMIZATION:
- Use sliding window for subarray problems
- Use two pointers for sorted arrays
- Avoid nested loops when possible

MONOTONIC STRUCTURE RULES:
- Monotonic stack for next greater/smaller
- Monotonic deque for sliding window
- Stack for histogram problems

BINARY SEARCH:
- Binary search on answer when monotonic
- Efficient check function

MEMORY OPTIMIZATION:
- Use vector instead of map when dense
- Use static arrays when known size
- Avoid storing full paths
- Avoid full adjacency graph
- Use boolean visited arrays
- Reuse buffers

IMPLEMENTATION OPTIMIZATION:
- Reserve vector capacity
- Use emplace_back
- Use references in loops
- Avoid substr in loops
- Modify strings in-place
- Use prefix sums
- Use difference arrays
- Use bit operations when possible

EDGE CASE RULES:
- empty input
- single element
- duplicates
- negative values
- overflow
- max constraints
- all equal values

Problem: ${context.title}
Difficulty: ${context.difficulty}
Topic: ${context.topicSlug}

Problem Statement:
${context.statement}

Constraints:
${context.constraints}

Examples:
${context.examples}

Hints:
${hintsText}

Key Observations:
${keyObsText}

C++ Template (use exact signature):
${context.cppTemplate}

CRITICAL REQUIREMENTS:
- Optimal algorithm only
- No brute force
- Minimal memory
- Handle all edge cases
- Avoid TLE
- Avoid MLE
- Use long long when needed
- Avoid recursion overflow
- use references
- avoid making irrelevant copies and calls
- Use visited array to avoid cycles

Use efficient C++ patterns:
- Pass large objects by const reference
- Use '\\n' instead of endl
- Avoid string copies
- Use unordered_map / unordered_set when beneficial
- Reserve memory
- Use emplace_back
- Modify strings in-place
- Avoid substr in loops
- Use auto&
- Prefer vector over map/set
- Use move semantics
- Pre-allocate containers
- Avoid pair copying
- Use references in loops
- Use static arrays when faster
- Use bit operations when possible

The code must compile and pass all test cases.

Generate ONLY C++ code:
- Use exact function signature
- Include headers
- Use C++17
- Minimal comments
- No explanation
- No markdown
- Output only code`;
}

export function buildTopicContentPrompt(context: TopicContext): string {
  const problemsList = context.problems
    .map((p, i) => `${i + 1}. ${p.title} (${p.difficulty}) - Tags: ${p.tags.join(', ')}`)
    .join('\n');

  return `You are a patient DSA tutor generating topic-level content for beginners. Use an encouraging, supportive tone.

Topic: ${context.topicName}
Slug: ${context.topicSlug}
Tags: ${context.tags.join(', ')}

Problems in this topic:
${problemsList}

Generate comprehensive topic content. Your response must be ONLY valid JSON with this exact schema:

{
  "summary": "A 2-3 sentence overview with simple language and a relatable analogy",
  "lc_rating_range": [min_rating, max_rating],
  "prerequisites": ["array basics", "loops"],
  "patterns": ["pattern1", "pattern2"],
  "pitfalls": ["common mistake 1", "common mistake 2", "common mistake 3"],
  "content": {
    "introduction": "Introduction to the topic, why it matters, and a real-world analogy",
    "key_patterns": "Description of key patterns with beginner-friendly examples",
    "common_pitfalls": "Common mistakes developers make",
    "when_to_use": "When to apply this technique",
    "related_topics": "Topics that build on or relate to this"
  }
}

Requirements:
- Use simple language, avoid jargon
- Include analogies and real-world examples
- rating range should reflect difficulty (Easy: 1200-1300, Medium: 1300-1500, Hard: 1500-1800)
- patterns should be specific to ${context.topicName}
- pitfalls should be actionable advice
- Output ONLY valid JSON, no markdown fences, no explanation`;
}
