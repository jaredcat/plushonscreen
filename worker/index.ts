import {
  branchName,
  buildPullRequestBody,
  buildSightingMarkdown,
  imageExtension,
  parseSubmissionForm,
  sightingSlug,
  uniqueSlug,
  validateImageBytes,
} from '../src/lib/submission.ts';
import {
  createSightingPullRequest,
  getInstallationToken,
  githubConfigured,
  listPlushMarkdownNames,
} from './github.ts';
import { createPowChallenge, verifyPowSolution } from './pow.ts';

export interface Env {
  ASSETS: Fetcher;
  POW_SECRET: string;
  POW_DIFFICULTY?: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function parseDifficulty(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '4', 10);
  if (!Number.isInteger(parsed) || parsed < 3 || parsed > 6) {
    return 4;
  }
  return parsed;
}

async function handleChallenge(_request: Request, env: Env): Promise<Response> {
  if (!env.POW_SECRET) {
    return json({ error: 'Submission API is not configured.' }, 503);
  }

  const difficulty = parseDifficulty(env.POW_DIFFICULTY);
  const challenge = await createPowChallenge(env.POW_SECRET, difficulty);
  return json(challenge);
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (!env.POW_SECRET || !githubConfigured(env)) {
    return json(
      {
        error:
          'Submission API is not configured. GitHub App secrets are missing on the worker.',
      },
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Expected multipart form data.' }, 400);
  }

  const challenge = String(form.get('challenge') ?? '');
  const signature = String(form.get('signature') ?? '');
  const nonce = String(form.get('nonce') ?? '');

  const powError = await verifyPowSolution(
    env.POW_SECRET,
    challenge,
    signature,
    nonce,
  );
  if (powError) {
    return json({ error: powError }, 400);
  }

  const parsed = parseSubmissionForm(form);
  if (parsed.errors.length > 0 || !parsed.data || !parsed.screenshot) {
    return json({ error: 'Validation failed.', details: parsed.errors }, 400);
  }

  const screenshotBytes = new Uint8Array(await parsed.screenshot.arrayBuffer());
  const imageError = validateImageBytes(
    screenshotBytes,
    parsed.screenshot.type,
  );
  if (imageError) {
    return json({ error: imageError }, 400);
  }

  const ext = imageExtension(parsed.screenshot.type);
  if (!ext) {
    return json({ error: 'Unsupported screenshot type.' }, 400);
  }

  try {
    const token = await getInstallationToken(env);
    const taken = await listPlushMarkdownNames(env, token, parsed.data.plush);
    const baseSlug = sightingSlug(parsed.data.title, parsed.data.year);
    const slug = uniqueSlug(baseSlug, taken);
    const branch = branchName(slug);
    const markdownPath = `src/content/sightings/${parsed.data.plush}/${slug}.md`;
    const imagePath = `src/content/sightings/${parsed.data.plush}/images/${slug}.${ext}`;
    const markdownContent = buildSightingMarkdown(parsed.data, slug, ext);
    const pullBody = buildPullRequestBody(parsed.data, slug);
    const pullTitle = `[Sighting] ${parsed.data.title} (${parsed.data.year})`;

    const pullRequest = await createSightingPullRequest(env, {
      branch,
      markdownPath,
      markdownContent,
      imagePath,
      imageBytes: screenshotBytes,
      pullTitle,
      pullBody,
    });

    return json({
      ok: true,
      slug,
      pullRequestUrl: pullRequest.html_url,
      pullRequestNumber: pullRequest.number,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to open pull request.';
    return json({ error: message }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/challenge' && request.method === 'GET') {
      return handleChallenge(request, env);
    }

    if (url.pathname === '/api/submit') {
      return handleSubmit(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
