# Problem Content Generation Template (Manual/Claude Web)

Use this as the source-of-truth template for `generated/<topic>.json`.

## Claude Prompt Header (copy-paste before template)

```text
Return ONLY valid JSON (no markdown, no comments, no explanation).
Use EXACT keys and value types from the template.
Keep schemaVersion as 1.
Set topic.problemCount exactly equal to problems.length.
In each problem, content.examples must be a STRING containing serialized JSON array of examples, not an array object.
Always include code.cpp.
code.python and code.java are optional.
Do not add any extra keys that are not in the template.
```

## 1) Call 1 AI Output (content fields only)

```json
{
  "key_observations": ["observation 1", "observation 2"],
  "intuition": "Clear explanation.",
  "approach": ["step 1", "step 2", "step 3"],
  "pseudocode": ["line 1", "line 2", "line 3"],
  "pitfalls": ["pitfall 1", "pitfall 2"],
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "connection_to_subtopic": "How this problem connects to the subtopic."
}
```

## 2) Call 2 AI Output (code fields only)

```json
{
  "cpp": "class Solution {\npublic:\n    ...\n};"
}
```

## 3) Final Problem Object (`problems[]` item)

```json
{
  "id": "problem-slug",
  "title": "Problem Title",
  "topic_id": "binary-search",
  "subtopic_id": "subtopic-slug",
  "leetcode_id": 1234,
  "leetcode_slug": "problem-slug",
  "leetcode_url": "https://leetcode.com/problems/problem-slug/",
  "source": "LeetCode",
  "difficulty": "Easy",
  "importance": "Crucial",
  "rating": 1300,
  "difficulty_bucket": "standard",
  "tags": ["array", "binary-search"],
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "pitfalls": [],
  "content": {
    "statement": "Plain problem statement text",
    "constraints": "Plain constraints text",
    "examples": "[{\"input\":\"...\",\"output\":\"...\",\"explanation\":\"...\"}]",
    "hints": ["hint 1", "hint 2"],
    "key_observations": ["observation 1", "observation 2"],
    "intuition": "Clear explanation.",
    "approach": ["step 1", "step 2"],
    "pseudocode": ["line 1", "line 2"],
    "pitfalls": ["pitfall 1", "pitfall 2"],
    "time_complexity": "O(...)",
    "space_complexity": "O(...)",
    "connection_to_subtopic": "How this connects."
  },
  "code": {
    "cpp": "class Solution {\npublic:\n    ...\n};",
    "python": "# optional",
    "java": "// optional"
  }
}
```

## 4) Final Generated File (`generated/<topic>.json`)

```json
{
  "schemaVersion": 1,
  "topic": {
    "id": "binary-search",
    "title": "Binary Search",
    "summary": "Topic summary",
    "lc_rating_range": [1200, 1600],
    "target_audience": "DSA learners",
    "prerequisites": ["array basics", "loops"],
    "patterns": ["pattern 1", "pattern 2"],
    "subtopics": [],
    "time_complexity": "O(n)",
    "space_complexity": "O(n)",
    "pitfalls": ["topic pitfall 1"],
    "edge_cases": [],
    "content": {
      "introduction": "Intro",
      "key_patterns": "Patterns",
      "common_pitfalls": "Pitfalls",
      "when_to_use": "When to use",
      "related_topics": "Related topics"
    },
    "problemCount": 8
  },
  "problems": [
    "array of Final Problem Object"
  ]
}
```

## Important Notes (verified from current generator behavior)

- `content.examples` is stored as a **string** containing JSON-like examples text, not as an array.
- `content.pitfalls`, `content.time_complexity`, and `content.space_complexity` are present in generated output and should be kept.
- Top-level `pitfalls` in each problem currently exists and is typically `[]`.
- `topic.subtopics` and `topic.edge_cases` are arrays (can be empty).
- `schemaVersion` should stay `1` for current workflow.
- `topic.problemCount` should equal `problems.length`.
- `code.python` and `code.java` are optional (current generator writes only `code.cpp`).
