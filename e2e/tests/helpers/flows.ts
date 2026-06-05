import { expect, type Page } from "@playwright/test";
import { fetchActivationCode } from "./mailhog";
import { TEST_PASSWORD, uniqueEmail } from "./data";

/**
 * High-level page flows shared by the specs. Selectors prefer
 * role/label/text; the CodeMirror editor and a couple of cards use the stable
 * `data-testid`s present in the web components.
 */

/** Fill and submit the registration form for a fresh unique email. */
export async function register(
  page: Page,
  email: string,
  password = TEST_PASSWORD,
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  // Two password fields share the visible label text; target by exact label.
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

/** Type a 6-char code into the segmented CodeInput, one cell at a time. */
export async function enterActivationCode(
  page: Page,
  code: string,
): Promise<void> {
  const chars = code.toUpperCase().split("");
  for (let i = 0; i < chars.length; i++) {
    await page.getByLabel(`Digit ${i + 1}`, { exact: true }).fill(chars[i]);
  }
}

/**
 * Full register -> read MailHog code -> activate -> land on /dashboard.
 * Returns the email used. The MailHog reader uses the page's request context.
 */
export async function registerAndActivate(
  page: Page,
  emailPrefix = "e2e",
): Promise<string> {
  const email = uniqueEmail(emailPrefix);
  await register(page, email);

  // Registration must route to the activation page, NOT the dashboard.
  await expect(page).toHaveURL(/\/activate/);

  const code = await fetchActivationCode(page.request, email);
  await enterActivationCode(page, code);
  // The CodeInput auto-submits on the 6th char, but click to be deterministic.
  const activateBtn = page.getByRole("button", { name: "Activate account" });
  if (await activateBtn.isEnabled().catch(() => false)) {
    await activateBtn.click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  return email;
}

/**
 * Type SQL into the CodeMirror editor inside a given task card. Clears any
 * existing content first. The editor is lazy-loaded (`dynamic(ssr:false)`), so
 * `.cm-content` can mount a beat after a re-render — wait for it before typing.
 * The jsdom/SSR fallback is a <textarea>; handle it too.
 */
export async function typeSql(
  page: Page,
  taskCard: ReturnType<Page["locator"]>,
  sql: string,
): Promise<void> {
  const cm = taskCard.locator(".cm-content").first();
  // CodeMirror mounts asynchronously; give it a moment to appear.
  try {
    await cm.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    // Fall through to the textarea fallback below.
  }

  if (await cm.count()) {
    await cm.click();
    // Select-all + delete to clear, then type fresh.
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type(sql);
  } else {
    const textarea = taskCard.locator("textarea").first();
    await textarea.click();
    await textarea.fill(sql);
  }
}
