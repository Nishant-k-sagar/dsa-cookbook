import type {
  SeedFile,
  GeneratedFile
} from './types.js';
import {
  SEED_SCHEMA_VERSION,
  GENERATED_SCHEMA_VERSION
} from './types.js';

export function decodeHtmlEntities(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&apos;": "'",
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&ndash;": "-",
    "&mdash;": "--",
    "&hellip;": "...",
    "&copy;": "(c)",
    "&reg;": "(R)",
    "&trade;": "(TM)",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": "\"",
    "&rdquo;": "\"",
    "&bull;": "*",
    "&middot;": ".",
    "&laquo;": "<<",
    "&raquo;": ">>",
    "&le;": "<=",
    "&ge;": ">=",
    "&ne;": "!=",
    "&plusmn;": "+/-",
    "&deg;": "degrees",
    "&sum;": "sum",
    "&prod;": "product",
    "&radic;": "sqrt",
    "&infin;": "infinity",
    "&pi;": "pi",
    "&tau;": "tau",
    "&lambda;": "lambda",
    "&sigma;": "sigma",
    "&omega;": "omega",
    "&alpha;": "alpha",
    "&beta;": "beta",
    "&gamma;": "gamma",
    "&delta;": "delta",
    "&epsilon;": "epsilon",
    "&theta;": "theta",
    "&phi;": "phi",
    "&psi;": "psi",
    "&Delta;": "Delta",
    "&Gamma;": "Gamma",
    "&Lambda;": "Lambda",
    "&Omega;": "Omega",
    "&Phi;": "Phi",
    "&Pi;": "Pi",
    "&Psi;": "Psi",
    "&Sigma;": "Sigma",
    "&Theta;": "Theta",
    "&Prime;": "prime",
    "&prime;": "prime",
    "&sect;": "section",
    "&uml;": "umlaut",
    "&tilde;": "~",
    "&circ;": "^",
    "&zwj;": "",
    "&zwnj;": "",
    "&lrm;": "",
    "&rlm;": "",
    "&shy;": "-",
  };

  let decoded = text;

  const sortedEntities = Object.entries(htmlEntities).sort((a, b) => b[0].length - a[0].length);
  for (const [entity, char] of sortedEntities) {
    decoded = decoded.split(entity).join(char);
  }

  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

export function removeInvisibleChars(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF\u180E]/g, '');
}

export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  sanitized = removeInvisibleChars(sanitized);

  sanitized = decodeHtmlEntities(sanitized);

  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

export function sanitizeHtmlContent(html: string): string {
  let text = html;

  text = removeInvisibleChars(text);

  text = text.replace(/<[^>]+>/g, '');

  text = decodeHtmlEntities(text);

  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export function sanitizeHtmlArray(items: string[]): string[] {
  return items.map(item => sanitizeHtmlContent(item));
}

export function extractPureStatement(content: string): string {
  // Cut off in raw HTML at the first example/constraints marker
  // LeetCode HTML uses: <p><strong class="example">Example 1:</strong></p> and <p><strong>Constraints:</strong></p>
  const htmlCutoffPatterns = [
    /<p><strong\s+class=["']?example/i,
    /<strong\s+class=["']?example/i,
    /<p><strong>Constraints/i,
    /<strong>Constraints/i,
  ];
  let cutoff = content.length;
  for (const pattern of htmlCutoffPatterns) {
    const m = content.match(pattern);
    if (m?.index !== undefined) cutoff = Math.min(cutoff, m.index);
  }
  let statement = content.substring(0, cutoff);
  statement = statement.replace(/<[^>]+>/g, ' ');
  statement = decodeHtmlEntities(statement);
  statement = statement.replace(/\s+/g, ' ').trim();
  return statement;
}

export function extractConstraints(content: string): string {
  // Match the <ul> block following the Constraints header
  // LeetCode HTML uses: <p><strong>Constraints:</strong></p> followed by <ul>
  const constraintsMatch = content.match(/<p><strong>Constraints?:<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/i);

  if (constraintsMatch) {
    const listHtml = constraintsMatch[1];
    const items = [...listHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi)];
    const constraints = items
      .map(m => {
        let text = m[1];
        // Convert <sup>X</sup> to ^X before removing HTML tags
        text = text.replace(/<sup>(\d+)<\/sup>/g, '^$1');
        text = text.replace(/<sup>([^<]+)<\/sup>/g, '^$1');
        text = text.replace(/<[^>]+>/g, '').trim();
        return text;
      })
      .map(decodeHtmlEntities)
      .filter(Boolean)
      .join('\n');
    return constraints;
  }

  const lines = content.split('\n');
  const constraintLines: string[] = [];
  let inConstraints = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('constraint')) {
      inConstraints = true;
      continue;
    }

    if (inConstraints) {
      let cleanLine = line.trim();
      // Convert <sup>X</sup> to ^X before removing HTML tags
      cleanLine = cleanLine.replace(/<sup>(\d+)<\/sup>/g, '^$1');
      cleanLine = cleanLine.replace(/<sup>([^<]+)<\/sup>/g, '^$1');
      cleanLine = cleanLine.replace(/<[^>]+>/g, '');
      cleanLine = decodeHtmlEntities(cleanLine);
      if (cleanLine && !cleanLine.toLowerCase().includes('<h')) {
        constraintLines.push(cleanLine);
      }
    }
  }

  return constraintLines.join('\n');
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export function checkSchemaVersion(
  data: { schemaVersion?: number },
  expectedVersion: number,
  fileType: string
): void {
  if (!data.schemaVersion) {
    throw new Error(`${fileType} is missing schemaVersion field`);
  }

  if (data.schemaVersion !== expectedVersion) {
    throw new Error(
      `${fileType} has schemaVersion ${data.schemaVersion}, expected ${expectedVersion}. ` +
      `Please regenerate the ${fileType}.`
    );
  }
}

export function validateSeedFile(data: unknown): SeedFile {
  const seed = data as SeedFile;

  checkSchemaVersion(seed, SEED_SCHEMA_VERSION, 'Seed file');

  if (!seed.topic || typeof seed.topic !== 'string') {
    throw new Error('Seed file is missing or has invalid topic field');
  }

  if (!seed.topicSlug || typeof seed.topicSlug !== 'string') {
    throw new Error('Seed file is missing or has invalid topicSlug field');
  }

  if (!Array.isArray(seed.problems)) {
    throw new Error('Seed file is missing problems array');
  }

  for (const problem of seed.problems) {
    if (!problem.id || !problem.slug || !problem.title) {
      throw new Error('Seed problem is missing required fields (id, slug, title)');
    }
  }

  return seed;
}

export function validateGeneratedFile(data: unknown): GeneratedFile {
  const generated = data as GeneratedFile;

  checkSchemaVersion(generated, GENERATED_SCHEMA_VERSION, 'Generated file');

  if (!generated.topic) {
    throw new Error('Generated file is missing topic field');
  }

  if (!Array.isArray(generated.problems)) {
    throw new Error('Generated file is missing problems array');
  }

  return generated;
}

export function validateRequiredFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const value = obj[field];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

export function stripMarkdownCodeFences(code: string): string {
  let result = code;
  result = result.trim();
  // Remove opening fence ```cpp or ``` - using explicit string matching
  if (result.startsWith('```cpp')) {
    result = result.substring(6);  // 6 chars: 3 backticks + "cpp"
  } else if (result.startsWith('```c++')) {
    result = result.substring(5);  // 5 chars: 3 backticks + "c++"
  } else if (result.startsWith('```')) {
    result = result.substring(3);  // 3 backticks
  }
  // Handle newline after opening fence
  if (result.startsWith('\n')) {
    result = result.substring(1);
  }
  // Remove closing fence ```
  if (result.endsWith('```')) {
    result = result.substring(0, result.length - 3);
  } else if (result.endsWith('``')) {
    result = result.substring(0, result.length - 2);
  } else if (result.endsWith('`')) {
    result = result.substring(0, result.length - 1);
  }
  // Clean up any trailing whitespace after fence removal
  result = result.trim();
  return result;
}

export function hasHtmlTags(text: string): boolean {
  return /<[^>]+>/g.test(text);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toKebabCase(text: string): string {
  return slugify(text);
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export function parseExamplesFromContent(content: string): Example[] {
  const examples: Example[] = [];

  // Match Example blocks - capture everything from "Example X:" to before the next "Example" or "Constraints:" or end
  // The key fix: stop at the next "Example N:" pattern, not just at Constraints
  const examplePattern = /Example\s*(\d+)[^:]*:([\s\S]*?)(?=(?:Example\s*\d)|(?:Constraints?:)|(?:Note:)|(?:Solution:)|(?:$))/gi;
  let match;

  while ((match = examplePattern.exec(content)) !== null) {
    const exampleText = match[2];

    let input = '';
    let output = '';
    let explanation = '';

    const inputMatch = exampleText.match(/Input:\s*([^\n]+)/i);
    if (inputMatch) {
      input = sanitizeHtmlContent(inputMatch[1].trim());
    }

    const outputMatch = exampleText.match(/Output:\s*([^\n]+)/i);
    if (outputMatch) {
      output = sanitizeHtmlContent(outputMatch[1].trim());
    }

    // Match explanation - capture everything after "Explanation:" until Constraints/Note/Solution/end or next Example
    const explanationMatch = exampleText.match(/Explanation:\s*([\s\S]*?)(?=(?:Constraints?:)|(?:Note:)|(?:Solution:)|(?:Example\s*\d)|(?:$))/i);
    if (explanationMatch) {
      explanation = sanitizeHtmlContent(explanationMatch[1].trim());
    }

    if (input || output) {
      examples.push({
        input: input || '',
        output: output || '',
        explanation: explanation || undefined
      });
    }
  }

  return examples;
}

export function examplesToString(examples: Example[]): string {
  return JSON.stringify(examples);
}

export function examplesFromString(str: string): Example[] {
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
