import { test, expect } from "@playwright/test";

// Smoke test for the Ask AI local-model mode toggle.
//
// The actual in-browser Gemma run requires WebGPU, which Playwright's
// default Chromium can't guarantee. We only verify that:
//   - the Cloud/Local toggle is visible
//   - switching to Local swaps the UI into the local-mode surface
//   - switching back returns to the cloud surface
//   - /api/chat/prepare responds with a system prompt + messages bundle

test.describe("Ask AI — local model toggle", () => {
  test("toggle between cloud and local renders the expected surfaces", async ({
    page,
  }) => {
    await page.goto("/ask");

    const cloudButton = page.getByTestId("ask-mode-cloud");
    const localButton = page.getByTestId("ask-mode-local");

    await expect(cloudButton).toBeVisible();
    await expect(localButton).toBeVisible();
    await expect(cloudButton).toHaveAttribute("aria-pressed", "true");

    // Cloud: composer visible with standard placeholder
    await expect(
      page.locator('textarea[placeholder="Ask AI anything..."]')
    ).toBeVisible();

    // Switch to local
    await localButton.click();
    await expect(localButton).toHaveAttribute("aria-pressed", "true");

    // Local banner should appear
    await expect(
      page.getByText(/Local · Gemma 4 E2B \(WebGPU\)/)
    ).toBeVisible();

    // Local composer shows either local placeholder or WebGPU-unavailable prompt
    const localComposer = page.locator("textarea").first();
    await expect(localComposer).toBeVisible();
    const placeholder = await localComposer.getAttribute("placeholder");
    expect(placeholder).toMatch(
      /Ask AI anything \(local\)|WebGPU unavailable/
    );

    // Toggle back to cloud — persistence via localStorage
    await cloudButton.click();
    await expect(cloudButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('textarea[placeholder="Ask AI anything..."]')
    ).toBeVisible();
  });

  test("local mode selection persists across reloads", async ({ page }) => {
    await page.goto("/ask");
    await page.getByTestId("ask-mode-local").click();
    await expect(page.getByTestId("ask-mode-local")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.reload();

    await expect(page.getByTestId("ask-mode-local")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      page.getByText(/Local · Gemma 4 E2B \(WebGPU\)/)
    ).toBeVisible();
  });

  test("/api/chat/prepare returns system prompt and messages", async ({
    request,
  }) => {
    const res = await request.post("/api/chat/prepare", {
      data: {
        messages: [
          {
            role: "user",
            parts: [{ type: "text", text: "hello world" }],
          },
        ],
        sourceScope: "direct",
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(typeof body.system).toBe("string");
    expect(body.system.length).toBeGreaterThan(0);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBeGreaterThan(0);
    expect(body.messages[0]?.role).toBe("user");
    expect(body.messages[0]?.content).toContain("hello world");
  });
});
