import { expect, type APIRequestContext } from "@playwright/test";
import { MAILHOG_ORIGIN } from "../../playwright.config";

/**
 * MailHog test helper.
 *
 * The API publishes the activation email to RabbitMQ; a consumer delivers it to
 * MailHog over SMTP. We poll MailHog's HTTP API for the latest message addressed
 * to a given mailbox, then pull the 6-character activation code out of the
 * plain-text MIME part (the cleanest source — the HTML part has quoted-printable
 * soft line-breaks).
 */

interface MailHogPart {
  Headers: Record<string, string[]>;
  Body: string;
}

interface MailHogMessage {
  ID: string;
  Created: string;
  To: Array<{ Mailbox: string; Domain: string }>;
  Content: { Body: string; Headers: Record<string, string[]> };
  MIME?: { Parts?: MailHogPart[] };
}

interface MailHogList {
  total: number;
  items: MailHogMessage[];
}

const CODE_RE = /activation code is\s*<?(?:strong>)?\s*([A-Z0-9]{6})/i;

/** Delete every stored message so a run starts from a clean inbox. */
export async function clearMailbox(api: APIRequestContext): Promise<void> {
  await api.delete(`${MAILHOG_ORIGIN}/api/v1/messages`);
}

function partText(part: MailHogPart): string {
  // Undo quoted-printable soft breaks ("=\r\n") so split tokens re-join.
  return (part.Body ?? "").replace(/=\r?\n/g, "");
}

/** True if a message was addressed to `email` (case-insensitive). */
function isForEmail(msg: MailHogMessage, email: string): boolean {
  const [mailbox, domain] = email.toLowerCase().split("@");
  return (msg.To ?? []).some(
    (t) =>
      t.Mailbox?.toLowerCase() === mailbox &&
      t.Domain?.toLowerCase() === domain,
  );
}

/** Pull the activation code from a single message, or null if absent. */
function extractCode(msg: MailHogMessage): string | null {
  const candidates: string[] = [];
  for (const part of msg.MIME?.Parts ?? []) {
    candidates.push(partText(part));
  }
  // Fall back to the raw combined body if MIME parts are missing.
  candidates.push((msg.Content?.Body ?? "").replace(/=\r?\n/g, ""));

  for (const text of candidates) {
    const m = text.match(CODE_RE);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Poll MailHog until an activation email for `email` arrives, then return its
 * 6-character code. Picks the NEWEST matching message so re-sends never return
 * a stale code.
 */
export async function fetchActivationCode(
  api: APIRequestContext,
  email: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastSeen = 0;

  while (Date.now() < deadline) {
    const res = await api.get(`${MAILHOG_ORIGIN}/api/v2/messages?limit=200`);
    if (res.ok()) {
      const list = (await res.json()) as MailHogList;
      lastSeen = list.total;
      const matches = (list.items ?? [])
        .filter((m) => isForEmail(m, email))
        .sort((a, b) => (a.Created < b.Created ? 1 : -1)); // newest first
      for (const msg of matches) {
        const code = extractCode(msg);
        if (code) return code;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `No activation code for ${email} within ${timeoutMs}ms ` +
      `(MailHog held ${lastSeen} message(s)).`,
  );
}

/**
 * Convenience for tests that want a strong, readable failure if the inbox never
 * yields a code. Returns the code.
 */
export async function expectActivationCode(
  api: APIRequestContext,
  email: string,
): Promise<string> {
  const code = await fetchActivationCode(api, email);
  expect(code, `activation code for ${email}`).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}
