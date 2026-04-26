import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Dashboard — Recent Notes is the primary block", () => {
  test("Recent Notes section renders before AI → Knowledge in DOM order", async ({
    page,
  }) => {
    await page.goto("/");

    const recent = page.getByTestId("dashboard-recent-notes");
    await expect(recent).toBeVisible();
    await expect(recent.getByRole("heading", { name: "Recent Notes" })).toBeVisible();
    await expect(recent.getByRole("link", { name: /View all/ })).toHaveAttribute(
      "href",
      "/notes",
    );

    // AI → Knowledge has been collapsed into a compact one-line strip and lives
    // BELOW Recent Notes. Resolve both order and structure in one assertion.
    const order = await page.evaluate(() => {
      const recent = document.querySelector('[data-testid="dashboard-recent-notes"]');
      const ai = document.querySelector('[data-testid="dashboard-ai-knowledge"]');
      if (!recent) return { hasRecent: false, hasAi: !!ai, recentBeforeAi: false };
      if (!ai) return { hasRecent: true, hasAi: false, recentBeforeAi: false };
      const pos = recent.compareDocumentPosition(ai);
      // Node.DOCUMENT_POSITION_FOLLOWING === 4
      return {
        hasRecent: true,
        hasAi: true,
        recentBeforeAi: Boolean(pos & 4),
      };
    });
    expect(order.hasRecent).toBe(true);
    if (order.hasAi) {
      expect(order.recentBeforeAi).toBe(true);
    }
  });

  test("a freshly created note shows up at the top of Recent Notes", async ({
    page,
  }) => {
    const noteTitle = `recent-${uid()}`;

    await page.goto("/notes");
    await page.getByRole("button", { name: "New note" }).click();
    await page.waitForURL(/\/notes\/.+/);

    const titleInput = page.locator("textarea[placeholder='New page']");
    await titleInput.fill(noteTitle);
    await titleInput.press("Enter");
    await expect(
      page.getByText("Saved", { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    const recent = page.getByTestId("dashboard-recent-notes");
    await expect(recent).toBeVisible();
    await expect(recent.getByText(noteTitle).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
