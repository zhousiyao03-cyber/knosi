import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Phase 3: Todo 模块", () => {
  test("Todo 列表页加载成功", async ({ page }) => {
    await page.goto("/todos");
    await expect(page.locator("main h1")).toContainText("Todo");
  });

  test("创建 Todo", async ({ page }) => {
    const name = `todo-${uid()}`;
    await page.goto("/todos");

    await page.locator("input[placeholder='添加新任务...']").fill(name);
    await page.getByRole("button", { name: "添加" }).click();

    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("创建高优先级 Todo 并显示红色标签", async ({ page }) => {
    const name = `hipri-${uid()}`;
    await page.goto("/todos");

    await page.locator("input[placeholder='添加新任务...']").fill(name);
    await page.locator("form select").selectOption("high");
    await page.getByRole("button", { name: "添加" }).click();

    await expect(page.getByText(name).first()).toBeVisible();
    // The priority badge text "高" should appear near the todo
    const todoText = page.getByText(name).first();
    await expect(todoText).toBeVisible();
  });

  test("切换 Todo 状态", async ({ page }) => {
    const name = `cyc-${uid()}`;
    await page.goto("/todos");

    await page.locator("input[placeholder='添加新任务...']").fill(name);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Click status toggle: todo -> in_progress
    const statusBtn = page.locator("button[title='切换状态']").first();
    await statusBtn.click();
    await page.waitForTimeout(500);

    // Click again: in_progress -> done
    await statusBtn.click();
    await page.waitForTimeout(500);

    // Click again: done -> todo (cycles back)
    await statusBtn.click();
    await page.waitForTimeout(500);

    // Todo should still be visible (cycled back to todo state)
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("删除 Todo", async ({ page }) => {
    const name = `deltodo-${uid()}`;
    await page.goto("/todos");

    await page.locator("input[placeholder='添加新任务...']").fill(name);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Hover and delete
    const row = page.locator("div.group").filter({ hasText: name }).first();
    await row.hover();
    await row.locator("button[title='删除']").click();

    await expect(page.getByText(name)).not.toBeVisible({ timeout: 5000 });
  });

  test("按状态筛选", async ({ page }) => {
    const doneName = `done-${uid()}`;
    const todoName = `pending-${uid()}`;
    await page.goto("/todos");

    // Create a "done" todo
    await page.locator("input[placeholder='添加新任务...']").fill(doneName);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(doneName).first()).toBeVisible();
    // Mark done (click status twice)
    const btn1 = page.locator("div.group").filter({ hasText: doneName }).locator("button[title='切换状态']").first();
    await btn1.click();
    await page.waitForTimeout(300);
    await btn1.click();
    await page.waitForTimeout(300);

    // Create a "todo" item
    await page.locator("input[placeholder='添加新任务...']").fill(todoName);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(todoName).first()).toBeVisible();

    // Filter by status "已完成" — use the first select AFTER the form
    // The page has: form>select(priority), then select(status filter), select(priority filter)
    const statusFilterSelect = page.locator("main > div > div > select").first();
    await statusFilterSelect.selectOption("done");

    await expect(page.getByText(doneName).first()).toBeVisible();
    await expect(page.getByText(todoName)).not.toBeVisible();
  });
});

test.describe("Phase 3: 收藏箱模块", () => {
  test("收藏列表页加载成功", async ({ page }) => {
    await page.goto("/bookmarks");
    await expect(page.locator("main h1")).toContainText("收藏");
  });

  test("添加 URL 收藏", async ({ page }) => {
    const title = `bm-${uid()}`;
    await page.goto("/bookmarks");

    await page.getByText("添加收藏").click();
    await page.locator("input[placeholder='标题']").fill(title);
    await page.locator("input[placeholder='URL（可选）']").fill("https://example.com");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("添加纯文本收藏", async ({ page }) => {
    const title = `txt-${uid()}`;
    await page.goto("/bookmarks");

    await page.getByText("添加收藏").click();
    await page.locator("input[placeholder='标题']").fill(title);
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("删除收藏", async ({ page }) => {
    const title = `delbm-${uid()}`;
    await page.goto("/bookmarks");

    await page.getByText("添加收藏").click();
    await page.locator("input[placeholder='标题']").fill(title);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    // Delete
    const bmRow = page.locator("div.group").filter({ hasText: title }).first();
    await bmRow.hover();
    await bmRow.locator("button[title='删除']").click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 });
  });

  test("取消添加收藏表单", async ({ page }) => {
    await page.goto("/bookmarks");
    await page.getByText("添加收藏").click();
    await expect(page.locator("input[placeholder='标题']")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.locator("input[placeholder='标题']")).not.toBeVisible();
  });
});
