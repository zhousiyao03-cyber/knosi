import { test, expect } from "@playwright/test";

// Phase 4 spec — the /ask page has been reskinned toward the Notion Ask
// AI look: the h1 is now a dynamic "今日事，我来帮。" greeting, the scope
// buttons were replaced by a ScopeDropdown (English labels), the empty
// state heading "今天想处理什么？" is gone, and bookmarks no longer have
// a simple "添加收藏" → "保存" dialog. Update assertions to target the
// stable surface.

test.describe("Phase 4: Ask AI 页面", () => {
  test("Ask AI 页面加载成功（显示 greeting heading）", async ({ page }) => {
    await page.goto("/ask");
    await expect(
      page.getByRole("heading", { name: "今日事，我来帮。" })
    ).toBeVisible();
  });

  test("显示空状态快捷提示", async ({ page }) => {
    await page.goto("/ask");
    // The "总结最近笔记" quick prompt is still rendered on the empty state.
    await expect(
      page.getByRole("button", { name: /总结最近笔记/ })
    ).toBeVisible();
  });

  test("输入框和发送按钮存在", async ({ page }) => {
    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='使用 AI 处理各种任务...']"
    );
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    // Send button is labelled "发送" inside the composer.
    const sendBtn = page.getByRole("button", { name: "发送" });
    await expect(sendBtn).toBeDisabled();
  });

  test("输入文字后发送按钮启用", async ({ page }) => {
    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='使用 AI 处理各种任务...']"
    );
    await input.fill("测试问题");

    const sendBtn = page.getByRole("button", { name: "发送" });
    await expect(sendBtn).toBeEnabled();
  });

  test("发送消息后显示用户消息", async ({ page }) => {
    // Mock /api/chat so the send doesn't hang on a real provider
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "ok",
      });
    });

    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='使用 AI 处理各种任务...']"
    );
    await input.fill("你好");
    await page.getByRole("button", { name: "发送" }).click();

    await expect(page.getByText("你好").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(input).toHaveValue("");
  });

  test("来源注释不会直接显示给用户", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: '这是基于知识库的回答。\n\n<!-- sources:[{"id":"note-1","type":"note","title":"测试笔记"}] -->',
      });
    });

    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='使用 AI 处理各种任务...']"
    );
    await input.fill("测试来源");
    await page.getByRole("button", { name: "发送" }).click();

    await expect(page.getByText("这是基于知识库的回答。")).toBeVisible();
    // The raw <!-- sources: --> marker is parsed out and never rendered
    await expect(page.locator("main")).not.toContainText("<!-- sources:");
  });

  test("保存为笔记按钮（action row）可见", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: '这是可保存的回答。\n\n<!-- sources:[{"id":"note-2","type":"note","title":"保存测试"}] -->',
      });
    });

    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='使用 AI 处理各种任务...']"
    );
    await input.fill("把这段保存下来");
    await page.getByRole("button", { name: "发送" }).click();

    await expect(page.getByText("这是可保存的回答。")).toBeVisible();
    // "保存为笔记" survives as an IconActionButton aria-label
    await expect(
      page.getByRole("button", { name: /保存为笔记/ })
    ).toBeVisible();
  });
});

test.describe("Phase 4: Ask AI API 端点", () => {
  test("chat API endpoint 存在", async ({ request }) => {
    const response = await request.get("/api/chat");
    // GET should be rejected because only POST is implemented, but the
    // route must exist.
    expect(response.status()).toBe(405);
  });

  test("summarize API endpoint 存在", async ({ request }) => {
    const response = await request.post("/api/summarize", {
      data: { bookmarkId: "nonexistent" },
    });
    // Should return a non-405 (route exists, handler runs)
    expect(response.status()).not.toBe(405);
  });
});
