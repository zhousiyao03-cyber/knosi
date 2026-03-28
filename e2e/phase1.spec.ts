import { test, expect } from "@playwright/test";

test.describe("Phase 1: 项目骨架 + 基础布局", () => {
  test("首页加载成功，显示首页标题", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main h1")).toContainText("首页");
  });

  test("未开放的导航项默认隐藏", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");

    await expect(sidebar.getByText("Second Brain")).toBeVisible();
    await expect(sidebar.getByText("首页")).toBeVisible();
    await expect(sidebar.getByText("笔记")).toBeVisible();
    await expect(sidebar.getByText("Ask AI")).toBeVisible();
    await expect(sidebar.getByText("收藏")).toHaveCount(0);
    await expect(sidebar.getByText("Todo")).toHaveCount(0);
    await expect(sidebar.getByText("AI 探索")).toHaveCount(0);
  });

  test("移动端菜单里也不会显示未开放的导航项", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "打开菜单" }).click();

    const mobileNav = page.locator("nav").filter({ hasText: "首页" }).last();
    await expect(mobileNav.getByText("首页")).toBeVisible();
    await expect(mobileNav.getByText("笔记")).toBeVisible();
    await expect(mobileNav.getByText("Ask AI")).toBeVisible();
    await expect(mobileNav.getByText("收藏")).toHaveCount(0);
    await expect(mobileNav.getByText("Todo")).toHaveCount(0);
    await expect(mobileNav.getByText("AI 探索")).toHaveCount(0);
  });

  test("首页不显示未开放模块的入口卡片或快捷链接", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("a[href='/todos']")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("今日任务");
  });

  test.describe("侧边栏导航跳转", () => {
    const routes = [
      { label: "笔记", path: "/notes", heading: "笔记" },
      { label: "Ask AI", path: "/ask", heading: "Ask AI" },
    ];

    for (const route of routes) {
      test(`点击 "${route.label}" 跳转到 ${route.path}`, async ({ page }) => {
        await page.goto("/");
        await page.locator("aside").getByText(route.label, { exact: true }).click();
        await expect(page).toHaveURL(route.path);
        await expect(page.locator("main h1")).toContainText(route.heading);
      });
    }
  });

  test("tRPC API 端点可访问", async ({ request }) => {
    // tRPC batch endpoint should respond (even if no procedure is called)
    const response = await request.get("/api/trpc");
    // tRPC returns 404 for unknown procedures, but the endpoint itself works
    expect(response.status()).toBeLessThan(500);
  });

  test("当前页面侧边栏高亮正确", async ({ page }) => {
    await page.goto("/notes");
    const notesLink = page.locator("aside a[href='/notes']");
    // Active item uses ring-1 styling
    await expect(notesLink).toHaveClass(/ring-1/);

    // Dashboard link should NOT be highlighted (no ring)
    const dashboardLink = page.locator("aside a[href='/']");
    await expect(dashboardLink).not.toHaveClass(/ring-1/);
  });
});
