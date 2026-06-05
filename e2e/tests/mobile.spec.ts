import { test, expect, type Page } from "@playwright/test";
import { registerAndActivate } from "./helpers/flows";
import { references } from "./helpers/data";

/**
 * Mobile / responsive checks (Pixel-5 viewport, ~393px wide). We register and
 * activate a fresh user, then verify:
 *  - the dashboard and a study page render with NO horizontal overflow,
 *  - the hamburger nav opens a drawer and can navigate to Account.
 */

/** Assert the document does not scroll horizontally at the current viewport. */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // Allow a 2px fudge for sub-pixel rounding.
  expect(scrollWidth, "document should not overflow horizontally").toBeLessThanOrEqual(
    clientWidth + 2,
  );
}

test.describe("mobile responsive", () => {
  test("dashboard and study render without horizontal overflow; hamburger works", async ({
    page,
  }) => {
    await registerAndActivate(page, "mobile");

    // --- Dashboard ---------------------------------------------------------
    await expect(
      page.getByRole("heading", { name: "Your learning path" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // --- Hamburger nav -> drawer -> Account --------------------------------
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    // The drawer nav items are ListItemButtons rendered via NextLink, so they
    // expose role="link". Scope to the drawer paper to avoid the (hidden)
    // desktop nav links.
    const drawer = page.locator(".MuiDrawer-paper");
    const drawerAccount = drawer.getByRole("link", { name: "Account" });
    await expect(drawerAccount).toBeVisible();
    await drawerAccount.click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // --- A study page ------------------------------------------------------
    await page.goto(`/study/NOVICE/${references().block1.id}`);
    await expect(
      page.getByRole("heading", { name: "SELECT Basics", level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // The SQL editor and submit control are reachable on a phone.
    const firstTask = page.getByTestId(/^task-card-/).first();
    await expect(
      firstTask.getByRole("button", { name: "Submit" }),
    ).toBeVisible();
  });
});
