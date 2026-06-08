interface ChallengeResponse {
  challenge: string;
  signature: string;
  difficulty: number;
}

interface SubmitSuccess {
  ok: true;
  pullRequestUrl: string;
  pullRequestNumber: number;
}

interface SubmitFailure {
  error: string;
  details?: string[];
}

function getFormElements(): {
  form: HTMLFormElement;
  status: HTMLElement;
  submitButton: HTMLButtonElement;
  powStatus: HTMLElement;
} {
  const form = document.getElementById('sighting-form');
  const status = document.getElementById('submit-status');
  const submitButton = document.getElementById('submit-button');
  const powStatus = document.getElementById('pow-status');

  if (
    !(form instanceof HTMLFormElement) ||
    !(status instanceof HTMLElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(powStatus instanceof HTMLElement)
  ) {
    throw new Error('Submit form markup is missing required elements.');
  }

  return { form, status, submitButton, powStatus };
}

function setStatus(
  element: HTMLElement,
  message: string,
  tone: 'neutral' | 'error' | 'success' = 'neutral',
): void {
  element.textContent = message;
  element.dataset.tone = tone;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchChallenge(): Promise<ChallengeResponse> {
  const response = await fetch('/api/challenge');
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as SubmitFailure | null;
    throw new Error(body?.error ?? 'Could not fetch submission challenge.');
  }
  return (await response.json()) as ChallengeResponse;
}

async function solvePow(
  challenge: string,
  difficulty: number,
  onProgress: (attempts: number) => void,
): Promise<string> {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const hash = await sha256Hex(`${challenge}:${nonce}`);
    if (hash.startsWith(prefix)) {
      return String(nonce);
    }

    nonce += 1;
    if (nonce % 2500 === 0) {
      onProgress(nonce);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

function previewScreenshot(input: HTMLInputElement): void {
  const preview = document.getElementById('screenshot-preview');
  if (!(preview instanceof HTMLImageElement)) {
    return;
  }

  const file = input.files?.[0];
  if (!file) {
    preview.hidden = true;
    preview.removeAttribute('src');
    return;
  }

  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
}

export function initSubmitForm(): void {
  const { form, status, submitButton, powStatus } = getFormElements();
  const screenshotInput = form.elements.namedItem('screenshot');

  if (screenshotInput instanceof HTMLInputElement) {
    screenshotInput.addEventListener('change', () => {
      previewScreenshot(screenshotInput);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus(status, 'Preparing anti-spam check…');
    setStatus(powStatus, 'Starting proof-of-work…');

    try {
      const challenge = await fetchChallenge();
      setStatus(
        powStatus,
        `Finding proof (${challenge.difficulty} leading zero hex digits)…`,
      );

      const nonce = await solvePow(
        challenge.challenge,
        challenge.difficulty,
        (attempts) => {
          setStatus(
            powStatus,
            `Crunching… ${attempts.toLocaleString()} hashes tried`,
          );
        },
      );

      setStatus(powStatus, 'Proof found. Uploading sighting…');
      setStatus(status, 'Opening pull request…');

      const payload = new FormData(form);
      payload.set('challenge', challenge.challenge);
      payload.set('signature', challenge.signature);
      payload.set('nonce', nonce);

      const response = await fetch('/api/submit', {
        method: 'POST',
        body: payload,
      });

      const body = (await response.json()) as SubmitSuccess | SubmitFailure;

      if (!response.ok || !('ok' in body)) {
        const failure = body as SubmitFailure;
        const details = failure.details?.length
          ? ` ${failure.details.join(' ')}`
          : '';
        throw new Error(`${failure.error}${details}`);
      }

      setStatus(
        status,
        `Pull request #${body.pullRequestNumber} opened successfully.`,
        'success',
      );
      setStatus(powStatus, 'Done.');
      form.hidden = true;

      const success = document.getElementById('submit-success');
      const link = document.getElementById('pull-request-link');
      if (success instanceof HTMLElement && link instanceof HTMLAnchorElement) {
        link.href = body.pullRequestUrl;
        link.textContent = `View pull request #${body.pullRequestNumber} on GitHub`;
        success.hidden = false;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Submission failed.';
      setStatus(status, message, 'error');
      setStatus(powStatus, 'Ready to retry.');
      submitButton.disabled = false;
    }
  });
}
