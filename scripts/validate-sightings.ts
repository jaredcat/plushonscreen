import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plushes } from '../src/plushes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sightingsDir = join(root, 'src/content/sightings');
const plushIds = new Set(plushes.map((p) => p.id));

const errors: string[] = [];
const warnings: string[] = [];

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const fieldMatch = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (fieldMatch) {
      fields[fieldMatch[1]] = fieldMatch[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return fields;
}

function collectMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

const markdownFiles = collectMarkdownFiles(sightingsDir).filter(
  (filePath) => !filePath.split('/').pop()?.startsWith('example-'),
);

for (const filePath of markdownFiles) {
  const relativePath = filePath.replace(`${root}/`, '');
  const content = readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);

  const plush = frontmatter.plush;
  if (!plush) {
    errors.push(`${relativePath}: missing required frontmatter field "plush"`);
    continue;
  }

  if (!plushIds.has(plush)) {
    errors.push(
      `${relativePath}: unknown plush id "${plush}" (valid ids: ${[...plushIds].join(', ')})`,
    );
  }

  const sightingsRelative = relativePath.replace(
    /^src\/content\/sightings\//,
    '',
  );
  const folderPlush = sightingsRelative.split('/')[0];
  if (folderPlush !== plush) {
    errors.push(
      `${relativePath}: file is under "${folderPlush}/" but frontmatter plush is "${plush}" — keep them in sync`,
    );
  }

  const screenshot = frontmatter.screenshot;
  if (screenshot) {
    const screenshotPath = resolve(dirname(filePath), screenshot);
    if (!existsSync(screenshotPath)) {
      errors.push(
        `${relativePath}: screenshot "${screenshot}" not found at ${screenshotPath.replace(`${root}/`, '')}`,
      );
    }
  }

  if (frontmatter.submittedBy === 'YOUR_USERNAME') {
    warnings.push(
      `${relativePath}: submittedBy is still the placeholder YOUR_USERNAME`,
    );
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${markdownFiles.length} sighting file(s).`);
