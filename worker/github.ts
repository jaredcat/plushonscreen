import { importPKCS8, SignJWT } from 'jose';

interface GitHubEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

interface GitHubRef {
  object: {
    sha: string;
  };
}

interface GitHubContentEntry {
  name: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
}

interface GitHubPullRequest {
  html_url: string;
  number: number;
}

interface GitHubRepo {
  default_branch: string;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n').trim();
}

function encodeDerLength(length: number): number[] {
  if (length < 0x80) {
    return [length];
  }

  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }

  return [0x80 | bytes.length, ...bytes];
}

function wrapDer(tag: number, content: Uint8Array): Uint8Array {
  const lengthBytes = encodeDerLength(content.length);
  const output = new Uint8Array(1 + lengthBytes.length + content.length);
  output[0] = tag;
  output.set(lengthBytes, 1);
  output.set(content, 1 + lengthBytes.length);
  return output;
}

function concatDer(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function chunkPem(base64: string): string {
  return base64.match(/.{1,64}/g)?.join('\n') ?? base64;
}

function rsaPrivateKeyToPkcs8Pem(pem: string): string {
  const normalized = normalizePrivateKey(pem);
  if (normalized.includes('BEGIN PRIVATE KEY')) {
    return normalized;
  }

  const base64 = normalized
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const pkcs1Der = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

  const rsaOid = Uint8Array.from([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  ]);
  const algorithmIdentifier = wrapDer(
    0x30,
    concatDer([wrapDer(0x06, rsaOid), new Uint8Array([0x05, 0x00])]),
  );
  const privateKey = wrapDer(0x04, pkcs1Der);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const privateKeyInfo = wrapDer(
    0x30,
    concatDer([version, algorithmIdentifier, privateKey]),
  );

  const body = chunkPem(btoa(String.fromCharCode(...privateKeyInfo)));
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

async function createAppJwt(env: GitHubEnv): Promise<string> {
  const pkcs8Pem = rsaPrivateKeyToPkcs8Pem(env.GITHUB_APP_PRIVATE_KEY);
  const key = await importPKCS8(pkcs8Pem, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(env.GITHUB_APP_ID)
    .sign(key);
}

export async function getInstallationToken(env: GitHubEnv): Promise<string> {
  const jwt = await createAppJwt(env);
  const response = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'plushonscreen-submit-worker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub installation token failed (${response.status}): ${body}`,
    );
  }

  const json = (await response.json()) as { token: string };
  return json.token;
}

async function githubRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'plushonscreen-submit-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${path} failed (${response.status}): ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getDefaultBranch(
  env: GitHubEnv,
  token: string,
): Promise<{ name: string; sha: string }> {
  const repo = await githubRequest<GitHubRepo>(
    token,
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`,
  );
  const ref = await githubRequest<GitHubRef>(
    token,
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/git/ref/heads/${repo.default_branch}`,
  );

  return {
    name: repo.default_branch,
    sha: ref.object.sha,
  };
}

export async function listPlushMarkdownNames(
  env: GitHubEnv,
  token: string,
  plushId: string,
): Promise<Set<string>> {
  try {
    const entries = await githubRequest<GitHubContentEntry[]>(
      token,
      `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/src/content/sightings/${plushId}`,
    );
    return new Set(
      entries
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
        .map((entry) => entry.name),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) {
      return new Set();
    }
    throw error;
  }
}

async function createBranch(
  env: GitHubEnv,
  token: string,
  branch: string,
  sha: string,
): Promise<void> {
  await githubRequest(
    token,
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/git/refs`,
    {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha,
      }),
    },
  );
}

async function putFile(
  env: GitHubEnv,
  token: string,
  branch: string,
  path: string,
  content: Uint8Array,
  message: string,
): Promise<void> {
  await githubRequest(
    token,
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: uint8ToBase64(content),
        branch,
      }),
    },
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export interface CreateSightingPullRequestInput {
  branch: string;
  markdownPath: string;
  markdownContent: string;
  imagePath: string;
  imageBytes: Uint8Array;
  pullTitle: string;
  pullBody: string;
}

export async function createSightingPullRequest(
  env: GitHubEnv,
  input: CreateSightingPullRequestInput,
): Promise<GitHubPullRequest> {
  const token = await getInstallationToken(env);
  const defaultBranch = await getDefaultBranch(env, token);

  await createBranch(env, token, input.branch, defaultBranch.sha);

  const markdownBytes = new TextEncoder().encode(input.markdownContent);
  await putFile(
    env,
    token,
    input.branch,
    input.markdownPath,
    markdownBytes,
    `Add sighting: ${input.pullTitle}`,
  );
  await putFile(
    env,
    token,
    input.branch,
    input.imagePath,
    input.imageBytes,
    `Add screenshot for ${input.pullTitle}`,
  );

  return githubRequest<GitHubPullRequest>(
    token,
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: input.pullTitle,
        head: input.branch,
        base: defaultBranch.name,
        body: input.pullBody,
      }),
    },
  );
}

export function githubConfigured(env: GitHubEnv): boolean {
  return Boolean(
    env.GITHUB_APP_ID &&
      env.GITHUB_APP_PRIVATE_KEY &&
      env.GITHUB_INSTALLATION_ID &&
      env.GITHUB_REPO_OWNER &&
      env.GITHUB_REPO_NAME,
  );
}
