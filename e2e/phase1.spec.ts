import { test, expect } from "@playwright/test";

// Phase 1 shell coverage — originally authored with Chinese nav labels
// ("首页" / "笔记" / "Ask AI") and "首页" dashboard heading. Both have
// since been rewritten to English navigation + dynamic greeting-based
// dashboard heading, so the assertions now target the stable surface:
// sidebar English labels, dashboard Focus card, and mobile nav drawer.

test.describe("Phase 1: 项目骨架 + 基础布局", () => {
  test("首页加载成功，显示 dashboard Focus 卡片", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("dashboard-focus-card")).toBeVisible();
  });

  test("侧边栏显示核心导航项（英文 label）", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");

    await expect(sidebar.getByText("Home", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Notes", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Ask AI", { exact: true })).toBeVisible();
  });

  test("移动端菜单里也显示核心导航项", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const mobileNav = page.locator("nav").filter({ hasText: "Home" }).last();
    await expect(mobileNav.getByText("Home", { exact: true })).toBeVisible();
    await expect(mobileNav.getByText("Notes", { exact: true })).toBeVisible();
    await expect(mobileNav.getByText("Ask AI", { exact: true })).toBeVisible();
  });

  test.describe("侧边栏导航跳转", () => {
    const routes = [
      { label: "Notes", path: "/notes" },
      { label: "Ask AI", path: "/ask" },
    ];

    for (const route of routes) {
      test(`点击 "${route.label}" 跳转到 ${route.path}`, async ({ page }) => {
        await page.goto("/");
        await page
          .locator("aside")
          .getByText(route.label, { exact: true })
          .click();
        await expect(page).toHaveURL(route.path);
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
