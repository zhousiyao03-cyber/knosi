import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("V1 核心路径 A：笔记 → 搜索", () => {
  test("创建笔记并通过 Cmd+K 搜索到", async ({ page }) => {
    const noteTitle = `v1-note-${uid()}`;

    // Create a note
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await page.waitForURL(/\/notes\/.+/);

    // Set title
    const titleInput = page.locator("textarea[placeholder='无标题']");
    await titleInput.fill(noteTitle);
    // Wait for auto-save
    await page.waitForTimeout(2000);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    // Go home and search
    await page.goto("/");
    await page.keyboard.press("Meta+k");
    const searchInput = page.locator(
      "input[placeholder='搜索笔记、收藏、待办...']"
    );
    await expect(searchInput).toBeVisible();
    await searchInput.fill(noteTitle);

    // Should find the note
    await expect(page.getByText(noteTitle).last()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("V1 核心路径 B：收藏 → 搜索", () => {
  test("创建收藏并通过 Cmd+K 搜索到", async ({ page }) => {
    const bmTitle = `v1-bm-${uid()}`;

    // Create a bookmark
    await page.goto("/bookmarks");
    await page.getByText("添加收藏").click();
    await page.locator("input[placeholder='标题']").fill(bmTitle);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(bmTitle).first()).toBeVisible();

    // Search via Cmd+K
    await page.keyboard.press("Meta+k");
    const searchInput = page.locator(
      "input[placeholder='搜索笔记、收藏、待办...']"
    );
    await expect(searchInput).toBeVisible();
    await searchInput.fill(bmTitle);

    // Should find the bookmark
    await expect(page.getByText(bmTitle).last()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("V1 核心路径：Ask AI", () => {
  test("Ask AI 页面可以发送消息", async ({ page }) => {
    await page.goto("/ask");
    const input = page.locator(
      "textarea[placeholder='输入你的问题...（Shift+Enter 换行）']"
    );
    await input.fill("你好");
    await page.locator("button[type='submit']").click();

    // User message should appear
    await expect(page.getByText("你好").first()).toBeVisible({ timeout: 5000 });
    // Input cleared
    await expect(input).toHaveValue("");
  });

  test("chat API endpoint 接受请求", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "hello" }] },
    });
    expect(response.status()).not.toBe(404);
  });

  test("chat API 拒绝非法输入", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("V1 核心路径：Bookmark 搜索/筛选", () => {
  test("收藏列表可以按来源筛选", async ({ page }) => {
    await page.goto("/bookmarks");
    const filter = page.locator("select[aria-label='按来源筛选']");
    await expect(filter).toBeVisible();
    await filter.selectOption("url");
    await filter.selectOption("text");
    await filter.selectOption("all");
  });

  test("收藏列表有搜索框", async ({ page }) => {
    await page.goto("/bookmarks");
    await expect(
      page.locator("input[placeholder='搜索收藏...']")
    ).toBeVisible();
  });
});
