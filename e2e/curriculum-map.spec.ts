import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Curriculum Map", () => {
  test("sidebar entry leads to /learn/map and renders both tracks", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("aside").getByRole("link", { name: "Map", exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/learn/map");

    await expect(page.getByText("Curriculum Map")).toBeVisible();

    const tabs = page.getByTestId("track-tabs");
    await expect(tabs).toBeVisible();
    await expect(tabs.locator("button", { hasText: "AI Engineer" })).toBeVisible();
    await expect(tabs.locator("button", { hasText: "Backend Architect" })).toBeVisible();
  });

  test("track switch updates the visible topics", async ({ page }) => {
    await page.goto("/learn/map");
    const tabs = page.getByTestId("track-tabs");
    await expect(tabs).toBeVisible();

    // Start: AI Engineer (default first track) should show some AI-specific topic.
    await expect(page.getByText("Foundations", { exact: true })).toBeVisible();

    // Switch to Backend Architect
    await tabs.locator("button", { hasText: "Backend Architect" }).click();
    await expect(page.getByText("Computer Fundamentals", { exact: true })).toBeVisible();
  });

  test("clicking a topic opens side panel with mastery toggle", async ({ page }) => {
    await page.goto("/learn/map");

    const firstTopic = page.locator("[data-topic-id]").first();
    await expect(firstTopic).toBeVisible();
    await firstTopic.click();

    const panel = page.getByTestId("topic-side-panel");
    await expect(panel).toBeVisible();

    const masteryToggle = page.getByTestId("mastery-toggle");
    await expect(masteryToggle).toBeVisible();
    await expect(panel.getByText(/Linked notes/)).toBeVisible();
  });

  test("changing mastery state persists across reload", async ({ page }) => {
    await page.goto("/learn/map");

    const firstTopic = page.locator("[data-topic-id]").first();
    const topicId = await firstTopic.getAttribute("data-topic-id");
    expect(topicId).toBeTruthy();

    await firstTopic.click();
    await page.getByTestId("mastery-toggle").locator('[data-mastery-option="mastered"]').click();

    // Wait for the underlying card to reflect new state.
    await expect.poll(async () => {
      const card = page.locator(`[data-topic-id="${topicId}"]`);
      return card.getAttribute("data-mastery");
    }).toBe("mastered");

    await page.reload();
    const cardAfter = page.locator(`[data-topic-id="${topicId}"]`);
    await expect(cardAfter).toHaveAttribute("data-mastery", "mastered");
  });
});
