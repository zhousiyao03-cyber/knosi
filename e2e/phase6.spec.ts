import { test, expect } from "@playwright/test";

// Phase 6 coverage — originally authored with Chinese labels that have
// since been refactored to English ("首页" → dashboard Focus card, search
// placeholder "搜索笔记..." → "Search notes...", "深色模式" → "Dark mode",
// etc.) and some long-gone testids (dashboard-content-grid /
// dashboard-notes-panel). Reassertions target the stable surface only.

test.describe("Phase 6: 首页仪表盘", () => {
  test("仪表盘加载成功（Focus 卡片可见）", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("dashboard-focus-card")).toBeVisible();
  });

  test("首页显示最近笔记分区", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "最近笔记", exact: true })
    ).toBeVisible();
  });

  test("首页显示 Focus 卡片上的今日专注标题", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("今日专注", { exact: true })).toBeVisible();
  });

  test("Notes 侧边栏链接直接跳转", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside a[href='/notes']").first().click();
    await expect(page).toHaveURL("/notes");
  });
});

test.describe("Phase 6: 全局搜索", () => {
  test("点击侧边栏 Search 按钮打开搜索面板", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: /Search/i }).click();
    await expect(
      page.locator("input[placeholder='Search notes...']")
    ).toBeVisible({ timeout: 5000 });
  });

  test("ESC 关闭搜索面板", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: /Search/i }).click();
    const input = page.locator("input[placeholder='Search notes...']");
    await expect(input).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).not.toBeVisible();
  });

  test("搜索空状态提示", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: /Search/i }).click();
    await expect(page.getByText("Start typing to search")).toBeVisible();
  });

  test("搜索无结果提示", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: /Search/i }).click();
    const input = page.locator("input[placeholder='Search notes...']");
    await expect(input).toBeVisible();
    await input.fill("zzzznonexistent999");
    await expect(page.getByText("No results found")).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Phase 6: 深色模式", () => {
  test("侧边栏有深色模式切换按钮", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Dark mode", { exact: true }).first()).toBeVisible();
  });

  test("点击切换深色模式", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Dark mode", { exact: true }).first().click();

    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("dark");

    await expect(
      page.getByText("Light mode", { exact: true }).first()
    ).toBeVisible();
  });

  test("再次点击切回浅色模式", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Dark mode", { exact: true }).first().click();
    await expect(
      page.getByText("Light mode", { exact: true }).first()
    ).toBeVisible();

    await page.getByText("Light mode", { exact: true }).first().click();
    await expect(
      page.getByText("Dark mode", { exact: true }).first()
    ).toBeVisible();

    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).not.toContain("dark");
  });
});

test.describe("Phase 6: 搜索 tRPC endpoint", () => {
  test("search endpoint 存在", async ({ request }) => {
    // tRPC batch format
    const input = encodeURIComponent(
      JSON.stringify({ "0": { query: "test" } })
    );
    const response = await request.get(
      `/api/trpc/dashboard.search?batch=1&input=${input}`
    );
    // Endpoint exists and responds (not 404)
    expect(response.status()).not.toBe(404);
  });
});
