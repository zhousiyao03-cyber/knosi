import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Speak", () => {
  test("sidebar entry leads to /speak with sentence + buttons", async ({ page }) => {
    await page.goto("/");

    const speakLink = page.locator("aside").getByRole("link", { name: "Speak" });
    await expect(speakLink).toBeVisible();
    await speakLink.click();

    await page.waitForURL("**/speak");

    await expect(page.getByTestId("speak-sentence")).toBeVisible();
    await expect(page.getByTestId("speak-play")).toBeVisible();
    await expect(page.getByTestId("speak-next")).toBeVisible();
    await expect(page.getByTestId("speak-position")).toContainText("/ 30");
  });

  test("Next changes the visible sentence", async ({ page }) => {
    await page.goto("/speak");

    const sentence = page.getByTestId("speak-sentence");
    await expect(sentence).toBeVisible();
    const before = (await sentence.textContent())?.trim() ?? "";
    expect(before.length).toBeGreaterThan(0);

    await page.getByTestId("speak-next").click();

    await expect(async () => {
      const now = (await sentence.textContent())?.trim() ?? "";
      expect(now).not.toEqual(before);
    }).toPass({ timeout: 2000 });
  });

  test("practice count persists across reload", async ({ page }) => {
    await page.goto("/speak");
    await expect(page.getByTestId("speak-sentence")).toBeVisible();

    // Play once on the current sentence, then Next — that should flush a
    // recordPractice call for the *previous* sentence.
    await page.getByTestId("speak-play").click();
    await page.waitForTimeout(150);
    await page.getByTestId("speak-next").click();

    // Give the recordPractice mutation time to settle on the server before
    // we reload (otherwise the next page's getCounts query may race the
    // in-flight upsert and miss the row).
    await page.waitForTimeout(800);

    // Reload and walk through the deck looking for any sentence with
    // "Practiced N times". With shuffle this is the previously-played
    // sentence, and we'll find it within the 30-card cycle.
    await page.goto("/speak");
    await expect(page.getByTestId("speak-sentence")).toBeVisible();

    let found = false;
    for (let i = 0; i < 32; i++) {
      const counter = page.getByTestId("speak-practiced");
      if ((await counter.count()) > 0) {
        const text = (await counter.textContent())?.trim() ?? "";
        expect(text).toMatch(/Practiced \d+ times/);
        found = true;
        break;
      }
      await page.getByTestId("speak-next").click();
      await page.waitForTimeout(80);
    }
    expect(found).toBe(true);
  });
});
