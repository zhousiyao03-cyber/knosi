import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

// V1 core paths — the cross-feature smoke coverage. Significantly rewritten
// from the original because the underlying UI moved to English copy and
// the Token Usage page is now read-only (no manual entry). The high-value
// flows that survive: note → search, bookmark → search, Ask AI send, API
// endpoint sanity.

test.describe("V1 核心路径 A：笔记 → 搜索", () => {
  test("侧边栏搜索按钮可以打开搜索弹窗", async ({ page }) => {
    await page.goto("/");
    await page
      .locator("aside")
      .getByRole("button", { name: /Search/i })
      .click();

    await expect(
      page.locator("input[placeholder='Search notes...']")
    ).toBeVisible();
  });

  test("创建笔记并通过搜索找到", async ({ page }) => {
    const noteTitle = `v1-note-${uid()}`;

    // Create a note via the real UI flow
    await page.goto("/notes");
    await page.getByRole("button", { name: "New note" }).click();
    await page.waitForURL(/\/notes\/.+/);

    const titleInput = page.locator("textarea[placeholder='New page']");
    await titleInput.fill(noteTitle);
    await titleInput.press("Enter");
    // Wait for the debounced auto-save to land
    await expect(
      page.getByText("Saved", { exact: true }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Go home and open the search dialog
    await page.goto("/");
    await page
      .locator("aside")
      .getByRole("button", { name: /Search/i })
      .click();
    const searchInput = page.locator("input[placeholder='Search notes...']");
    await expect(searchInput).toBeVisible();
    await searchInput.fill(noteTitle);

    // The new note should surface in the search results
    await expect(page.getByText(noteTitle).last()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("V1 核心路径 B：收藏可以搜索到", () => {
  test("创建收藏后可以被搜索到", async ({ page }) => {
    const bmTitle = `v1-bm-${uid()}`;

    await page.goto("/bookmarks");
    await page.getByRole("button", { name: "Add bookmark" }).click();
    await page.locator("input[placeholder='Title']").fill(bmTitle);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(bmTitle).first()).toBeVisible();

    // Bookmarks page has its own search input
    const pageSearch = page.locator("input[placeholder='Search bookmarks...']");
    await expect(pageSearch).toBeVisible();
    await pageSearch.fill(bmTitle);
    await expect(page.getByText(bmTitle).first()).toBeVisible();
  });
});

test.describe("V1 核心路径：Ask AI", () => {
  test("Ask AI 页面可以发送消息", async ({ page }) => {
    // Mock /api/chat so the send doesn't depend on a real provider
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

  test("chat API endpoint 存在", async ({ request }) => {
    const response = await request.get("/api/chat");
    expect(response.status()).toBe(405);
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
    const filter = page.locator("select[aria-label='Filter by source']");
    await expect(filter).toBeVisible();
    await filter.selectOption("url");
    await filter.selectOption("text");
    await filter.selectOption("all");
  });

  test("收藏列表有搜索框", async ({ page }) => {
    await page.goto("/bookmarks");
    await expect(
      page.locator("input[placeholder='Search bookmarks...']")
    ).toBeVisible();
  });
});
