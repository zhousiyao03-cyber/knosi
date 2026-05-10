import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "samples");
mkdirSync(outDir, { recursive: true });

// One representative "section" (~1KB). We repeat it to hit target sizes.
function makeSection(i) {
  return `## Section ${i}: Notes on Markdown Performance

This is a paragraph with **bold**, *italic*, \`inline code\`, and a [link](https://example.com).
We are testing how fast different parsers handle realistic notes content with mixed structures.

### Subsection ${i}.1

- First bullet about ${i}
- Second bullet with [a wiki link](#wiki) inside
- Third bullet with \`code\` and **emphasis**
  - Nested item one
  - Nested item two

### Subsection ${i}.2 — Code

\`\`\`typescript
function process${i}(input: string): number {
  const tokens = input.split(/\\s+/);
  return tokens.reduce((acc, t) => acc + t.length, 0);
}
\`\`\`

> A blockquote with a thought about section ${i}. It can wrap multiple lines and contains
> additional commentary that the parser must handle without breaking flow.

| Col A | Col B | Col C |
| ----- | ----- | ----- |
| ${i}-a | ${i}-b | ${i}-c |
| row 2  | row 2  | row 2  |
| row 3  | row 3  | row 3  |

---

`;
}

function buildToSize(targetBytes) {
  let out = "# Knosi Markdown Benchmark Sample\n\n";
  let i = 0;
  while (Buffer.byteLength(out, "utf8") < targetBytes) {
    out += makeSection(i++);
  }
  return out;
}

const targets = [
  ["small-10kb.md", 10 * 1024],
  ["medium-50kb.md", 50 * 1024],
  ["large-200kb.md", 200 * 1024],
];

for (const [name, size] of targets) {
  const content = buildToSize(size);
  const actual = Buffer.byteLength(content, "utf8");
  writeFileSync(join(outDir, name), content);
  console.log(`${name}: target=${size}B actual=${actual}B`);
}
