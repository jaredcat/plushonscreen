const DEFAULT_DIFFICULTY = 4;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

export interface PowChallenge {
  challenge: string;
  signature: string;
  difficulty: number;
}

interface ChallengePayload {
  ts: number;
  rand: string;
  difficulty: number;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signChallenge(
  secret: string,
  challenge: string,
): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(challenge),
  );
  return bytesToHex(new Uint8Array(signature));
}

async function verifyChallengeSignature(
  secret: string,
  challenge: string,
  signature: string,
): Promise<boolean> {
  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(hexToBytes(signature)),
    new TextEncoder().encode(challenge),
  );
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function createPowChallenge(
  secret: string,
  difficulty?: number,
): Promise<PowChallenge> {
  const payload: ChallengePayload = {
    ts: Date.now(),
    rand: crypto.randomUUID(),
    difficulty: difficulty ?? DEFAULT_DIFFICULTY,
  };
  const challenge = btoa(JSON.stringify(payload));
  const signature = await signChallenge(secret, challenge);

  return {
    challenge,
    signature,
    difficulty: payload.difficulty,
  };
}

export async function verifyPowSolution(
  secret: string,
  challenge: string,
  signature: string,
  nonce: string,
): Promise<string | null> {
  if (!/^\d+$/.test(nonce)) {
    return 'Invalid proof-of-work nonce.';
  }

  const validSignature = await verifyChallengeSignature(
    secret,
    challenge,
    signature,
  );
  if (!validSignature) {
    return 'Invalid or expired challenge.';
  }

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(atob(challenge)) as ChallengePayload;
  } catch {
    return 'Invalid challenge payload.';
  }

  if (Date.now() - payload.ts > CHALLENGE_TTL_MS) {
    return 'Challenge expired. Refresh the page and try again.';
  }

  const difficulty = payload.difficulty ?? DEFAULT_DIFFICULTY;
  const prefix = '0'.repeat(difficulty);
  const hash = await sha256Hex(`${challenge}:${nonce}`);
  if (!hash.startsWith(prefix)) {
    return 'Proof-of-work verification failed.';
  }

  return null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}
