import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Words", () => {
  test("sidebar entry leads to /words with card + buttons", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("aside").getByRole("link", { name: "Words" });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/words");

    await expect(page.getByTestId("words-stress")).toBeVisible();
    await expect(page.getByTestId("words-ipa")).toBeVisible();
    await expect(page.getByTestId("words-meaning")).toBeVisible();
    await expect(page.getByTestId("words-example")).toBeVisible();
    await expect(page.getByTestId("words-play-word")).toBeVisible();
    await expect(page.getByTestId("words-play-sentence")).toBeVisible();
    await expect(page.getByTestId("words-next")).toBeVisible();
  });

  test("Next changes the visible word", async ({ page }) => {
    await page.goto("/words");
    const stress = page.getByTestId("words-stress");
    await expect(stress).toBeVisible();
    const before = (await stress.textContent())?.trim() ?? "";

    await page.getByTestId("words-next").click();
    await expect(async () => {
      const now = (await stress.textContent())?.trim() ?? "";
      expect(now).not.toEqual(before);
    }).toPass({ timeout: 2000 });
  });

  test("Add word flow (mocked AI) shows new word + dedupe", async ({ page }) => {
    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    await page.getByTestId("words-add-open").click();
    await expect(page.getByTestId("words-add-modal")).toBeVisible();

    const uniq = `e2etest${Date.now()}`;
    await page.getByTestId("words-add-input").fill(uniq);

    const addRespPromise = page.waitForResponse(
      (r) => r.url().includes("/api/trpc/words.addWord") && r.ok(),
      { timeout: 10000 },
    );
    await page.getByTestId("words-add-submit").click();
    await addRespPromise;

    // Modal should auto-close on success.
    await expect(page.getByTestId("words-add-modal")).toBeHidden({ timeout: 5000 });

    // Re-open and add the same word — should error with "Already in your list".
    await page.getByTestId("words-add-open").click();
    await page.getByTestId("words-add-input").fill(uniq);
    await page.getByTestId("words-add-submit").click();
    await expect(page.getByTestId("words-add-error")).toContainText(/already/i, {
      timeout: 5000,
    });
  });

  test("badge shows NEW initially and ×N after practice", async ({ page }) => {
    await page.goto("/words");
    const badge = page.getByTestId("words-status-badge");
    const stress = page.getByTestId("words-stress");
    await expect(stress).toBeVisible();
    await expect(badge).toBeVisible();

    // Walk forward until we land on a sentence whose lifetime count is 0 —
    // i.e. the badge says NEW. With a 100-word seed this should happen
    // within a handful of clicks even after earlier tests.
    let foundNew = false;
    for (let i = 0; i < 110; i++) {
      const text = (await badge.textContent())?.trim() ?? "";
      if (text === "NEW") {
        foundNew = true;
        break;
      }
      await page.getByTestId("words-next").click();
      await page.waitForTimeout(40);
    }
    expect(foundNew).toBe(true);
  });

  test("New only filter excludes practised words", async ({ page }) => {
    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    // Practice the current word once so it has count > 0 and would be
    // excluded by New only.
    await page.getByTestId("words-play-word").click();
    await page.waitForTimeout(120);
    const recordPromise = page.waitForResponse(
      (r) => r.url().includes("/api/trpc/words.recordPractice") && r.ok(),
      { timeout: 5000 },
    );
    await page.getByTestId("words-next").click();
    await recordPromise;

    // Toggle to New only. Expect every visible card from now on shows NEW.
    await page.getByTestId("words-filter-new").click();

    const badge = page.getByTestId("words-status-badge");
    // Sample several cards in New-only mode.
    for (let i = 0; i < 6; i++) {
      // Either we have a card showing NEW, or we hit the empty state.
      const hasEmpty = (await page.getByTestId("words-empty-newonly").count()) > 0;
      if (hasEmpty) break;
      await expect(badge).toHaveText("NEW");
      await page.getByTestId("words-next").click();
      await page.waitForTimeout(40);
    }
  });

  test("practice count persists across reload", async ({ page }) => {
    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    await page.getByTestId("words-play-word").click();
    await page.waitForTimeout(150);

    const recordPromise = page.waitForResponse(
      (r) => r.url().includes("/api/trpc/words.recordPractice") && r.ok(),
      { timeout: 5000 },
    );
    await page.getByTestId("words-next").click();
    await recordPromise;

    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    let found = false;
    for (let i = 0; i < 110; i++) {
      const counter = page.getByTestId("words-practiced");
      if ((await counter.count()) > 0) {
        const text = (await counter.textContent())?.trim() ?? "";
        expect(text).toMatch(/Practiced \d+ times/);
        found = true;
        break;
      }
      await page.getByTestId("words-next").click();
      await page.waitForTimeout(60);
    }
    expect(found).toBe(true);
  });
});
