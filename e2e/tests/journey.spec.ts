import { test, expect, type Page } from "@playwright/test";
import { fetchActivationCode } from "./helpers/mailhog";
import { register, enterActivationCode, typeSql } from "./helpers/flows";
import { block1Answer, references, uniqueEmail } from "./helpers/data";

/**
 * THE full end-to-end journey (desktop chromium). One linear test that proves
 * the whole product works against a live stack:
 *
 *   register -> (cannot reach /dashboard) -> activation page
 *   -> read code from MailHog -> activate -> /dashboard (5 NOVICE blocks,
 *      block 1 unlocked, block 2 locked)
 *   -> open block 1 -> submit a WRONG query (error shown)
 *   -> reveal a hint -> submit the CORRECT query (success / COMPLETED)
 *   -> reveal the remaining tasks (each -> SKIPPED) -> block-complete banner
 *   -> back to /dashboard: block 1 COMPLETED, NOVICE XP = 100, block 2 UNLOCKED
 *   -> AI tutor: ask a question, a reply renders, counter decrements, and the
 *      reply does NOT contain the solution
 *   -> /account: update displayName, persists across reload
 *   -> logout -> /login, and /dashboard is no longer reachable.
 */

// The dashboard block titles in NOVICE order (used to assert all 5 render).
const NOVICE_BLOCK_TITLES = [
  "SELECT Basics",
  "Filtering & Sorting",
  "Aggregation",
  "Joins",
  "Subqueries & Sets",
] as const;

// An *interactive* (unlocked) block card is a CardActionArea button whose
// accessible name starts with "Block N". Locked blocks are NOT buttons.
function blockButtonByOrder(page: Page, order: number) {
  return page
    .getByRole("button", { name: new RegExp(`^Block ${order}\\b`) })
    .first();
}

test("full learner journey: register → study → complete block → AI → account → logout", async ({
  page,
}) => {
  const email = uniqueEmail("journey");

  // --- Register -----------------------------------------------------------
  await test.step("register routes to activation, not dashboard", async () => {
    await register(page, email);
    await expect(page).toHaveURL(/\/activate/);
    // Hard proof the guard holds: trying the dashboard bounces us back out.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login|\/activate/);
  });

  // --- Activate -----------------------------------------------------------
  await test.step("activate with the emailed code lands on the dashboard", async () => {
    await page.goto(`/activate?email=${encodeURIComponent(email)}`);
    const code = await fetchActivationCode(page.request, email);
    await enterActivationCode(page, code);
    const btn = page.getByRole("button", { name: "Activate account" });
    if (await btn.isEnabled().catch(() => false)) await btn.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  // --- Dashboard: 5 NOVICE blocks, block1 unlocked, block2 locked ---------
  await test.step("dashboard shows 5 NOVICE blocks with the right lock state", async () => {
    await expect(
      page.getByRole("heading", { name: "Your learning path" }),
    ).toBeVisible();

    // NOVICE tab is selected by default; assert all 5 block titles render.
    for (const title of NOVICE_BLOCK_TITLES) {
      await expect(
        page.getByRole("heading", { name: title, level: 3 }),
      ).toBeVisible();
    }

    // Block 1 is interactive (a CardActionArea button), block 2+ are locked
    // (non-button boxes carrying a `block-card-locked-*` testid).
    const block1 = page.getByTestId(`block-card-${references().block1.id}`);
    await expect(block1).toBeVisible();
    await expect(
      page.locator('[data-testid^="block-card-locked-"]').first(),
    ).toBeVisible();
    // Starting XP is 0 for a brand-new user (rendered as a "0 XP" chip).
    await expect(page.getByText(/\b0 XP\b/).first()).toBeVisible();
  });

  // --- Open block 1 -------------------------------------------------------
  await test.step("open block 1", async () => {
    await page.getByTestId(`block-card-${references().block1.id}`).click();
    await expect(page).toHaveURL(/\/study\/NOVICE\//);
    await expect(
      page.getByRole("heading", { name: "SELECT Basics", level: 1 }),
    ).toBeVisible();
  });

  // The first task card on the page is block-1 task 1.
  const firstTask = page.getByTestId(/^task-card-/).first();

  // --- Wrong submission shows an error ------------------------------------
  await test.step("a wrong query is rejected with an error result", async () => {
    await typeSql(page, firstTask, "SELECT * FROM departments");
    await firstTask.getByRole("button", { name: "Submit" }).click();
    // WRONG_RESULT renders a "Not quite" warning; other errors render too.
    await expect(
      firstTask.getByText(/Not quite|Incorrect|error|not allowed/i).first(),
    ).toBeVisible();
    // The status chip must NOT be Completed.
    await expect(firstTask.getByText("Correct!")).toHaveCount(0);
  });

  // --- Hint reveal --------------------------------------------------------
  await test.step("a hint can be revealed", async () => {
    await firstTask.getByRole("button", { name: "Show hint" }).click();
    await expect(firstTask.getByRole("button", { name: "Hide hint" })).toBeVisible();
  });

  // --- Correct submission marks the task COMPLETED ------------------------
  await test.step("the correct query is accepted (COMPLETED)", async () => {
    await typeSql(page, firstTask, block1Answer(1));
    await firstTask.getByRole("button", { name: "Submit" }).click();
    await expect(firstTask.getByText("Correct!")).toBeVisible({ timeout: 20_000 });
    await expect(firstTask.getByText("Completed")).toBeVisible();
  });

  // --- Complete the block by revealing every remaining task ---------------
  await test.step("reveal the remaining tasks to complete the block", async () => {
    const cards = page.getByTestId(/^task-card-/);
    const total = await cards.count();
    expect(total).toBe(references().block1.tasks.length);

    for (let i = 1; i < total; i++) {
      const card = cards.nth(i);
      await card.getByRole("button", { name: "Reveal answer" }).click();
      // Confirm dialog -> confirm.
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Reveal answer" }).click();
      // The reference answer block appears and the task is now Skipped.
      await expect(card.getByText("Reference answer")).toBeVisible({
        timeout: 15_000,
      });
    }

    // Block-complete banner appears once everything is resolved.
    await expect(page.getByText("Block complete!")).toBeVisible({
      timeout: 15_000,
    });
  });

  // --- AI tutor: reply renders, counter decrements, no solution leak ------
  await test.step("AI tutor replies, decrements its counter, and never leaks the answer", async () => {
    // The FAB shows "Ask the tutor" but its aria-label ("Open SQL tutor") is
    // the accessible name, so target that.
    await page.getByRole("button", { name: "Open SQL tutor" }).click();
    await expect(page.getByText("SQL Tutor")).toBeVisible();

    // Counter starts at 10.
    await expect(page.getByText(/10 questions left/)).toBeVisible();

    const input = page.getByLabel("Message the tutor");
    await input.fill("How should I approach selecting columns in this task?");
    await page.getByRole("button", { name: "Send message" }).click();

    // A non-empty assistant reply renders and the counter decrements to 9.
    await expect(page.getByText(/9 questions left/)).toBeVisible({
      timeout: 20_000,
    });

    // The reply must NOT contain the literal solution for task 1. Scope to the
    // tutor drawer so we don't match the answer the learner typed into the
    // task-1 editor (which legitimately contains it).
    const tutorDrawer = page.locator(".MuiDrawer-paper");
    const answer = block1Answer(1).replace(/;$/, "");
    await expect(tutorDrawer.getByText(answer, { exact: false })).toHaveCount(0);

    // Close the drawer.
    await page.keyboard.press("Escape");
  });

  // --- Back to dashboard: block 1 COMPLETED, XP=100, block 2 unlocked -----
  await test.step("dashboard reflects completion: XP 100 and block 2 unlocked", async () => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Your learning path" }),
    ).toBeVisible();

    // NOVICE XP is now 100.
    await expect(page.getByText(/\b100\b/).first()).toBeVisible({
      timeout: 15_000,
    });

    // Block 1 card now reads "Review" / "Completed" (COMPLETED state).
    await expect(blockButtonByOrder(page, 1)).toContainText(/Review|Completed/i);

    // Block 2 is now an interactive card (no longer in the locked set).
    const block2 = blockButtonByOrder(page, 2);
    await expect(block2).toBeVisible();
    await block2.click();
    await expect(page).toHaveURL(/\/study\/NOVICE\//);
    await expect(
      page.getByRole("heading", { name: "Filtering & Sorting", level: 1 }),
    ).toBeVisible();
  });

  // --- Account: update displayName, persists across reload ----------------
  await test.step("account displayName update persists across reload", async () => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    const newName = `Ada ${Date.now().toString().slice(-5)}`;
    const field = page.getByLabel("Display name");
    await field.fill(newName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue(newName);
  });

  // --- Logout: redirect to /login, dashboard no longer reachable ----------
  await test.step("logout returns to /login and protects the dashboard", async () => {
    // Account page has an explicit Log out button.
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
