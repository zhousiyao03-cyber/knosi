import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Phase 3: Todo 模块", () => {
  test("Todo 列表页加载成功", async ({ page }) => {
    await page.goto("/todos");
    await expect(page.locator("main h1")).toContainText("Todo");
    await expect(page.getByText("先把任务录进来")).toBeVisible();
    await expect(page.getByRole("button", { name: "表格" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  });

  test("创建带时间和分类的 Todo", async ({ page }) => {
    const name = `todo-${uid()}`;
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dueInput = new Date(
      due.getTime() - due.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 10);

    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "更多字段" }).click();
    await page.getByLabel("Todo 分类").selectOption("工作");
    await page.getByLabel("Todo 截止时间").fill(dueInput);
    await page.getByRole("button", { name: "添加" }).click();

    const row = page.locator("tbody tr").filter({ hasText: name }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("工作");

    await page.getByRole("button", { name: "Dashboard" }).click();
    await expect(
      page.locator("section").filter({ hasText: "即将到来" }).getByText(name)
    ).toBeVisible();
  });

  test("可以在详情面板编辑 Todo", async ({ page }) => {
    const name = `edit-${uid()}`;
    const updatedName = `${name}-updated`;
    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dueInput = new Date(
      due.getTime() - due.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 10);

    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByText(name).first().click();
    await expect(page.getByText("任务详情")).toBeVisible();

    await page.getByLabel("编辑任务标题").fill(updatedName);
    await page.getByLabel("编辑任务描述").fill("补充上下文");
    await page.getByLabel("编辑任务分类").selectOption("学习");
    await page.getByLabel("编辑任务优先级").selectOption("high");
    await page.getByLabel("编辑任务截止时间").fill(dueInput);
    await page.getByRole("button", { name: "保存修改" }).click();

    await expect(page.getByText(updatedName).first()).toBeVisible();
    await expect(page.getByText("补充上下文").first()).toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: updatedName }).first();
    await expect(row).toContainText("学习");
  });

  test("可以清空 Todo 的截止时间", async ({ page }) => {
    const name = `clear-due-${uid()}`;
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dueInput = new Date(
      due.getTime() - due.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 10);

    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "更多字段" }).click();
    await page.getByLabel("Todo 截止时间").fill(dueInput);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByText(name).first().click();
    await page.getByRole("button", { name: "清空时间" }).click();
    await page.getByRole("button", { name: "保存修改" }).click();

    const row = page.locator("tbody tr").filter({ hasText: name }).first();
    await expect(row).toContainText("未设置时间");

    await page.getByRole("button", { name: "Dashboard" }).click();
    await expect(
      page.locator("section").filter({ hasText: "无时间" }).getByText(name)
    ).toBeVisible();
  });

  test("切换 Todo 状态并按状态筛选", async ({ page }) => {
    const name = `done-${uid()}`;
    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    const row = page.locator("tbody tr").filter({ hasText: name }).first();
    const toggle = row.locator("button[title='标记完成']");
    await toggle.click();
    await page.waitForTimeout(300);

    await page.getByLabel("按状态筛选").selectOption("done");
    await expect(page.locator("tbody tr").filter({ hasText: name }).first()).toBeVisible();
  });

  test("按分类筛选 Todo", async ({ page }) => {
    const name = `category-${uid()}`;
    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "更多字段" }).click();
    await page.getByLabel("Todo 分类").selectOption("生活");
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByLabel("按分类筛选").selectOption("生活");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("删除 Todo", async ({ page }) => {
    const name = `deltodo-${uid()}`;
    await page.goto("/todos");

    await page.getByLabel("Todo 标题").fill(name);
    await page.getByRole("button", { name: "添加" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    const row = page.locator("tbody tr").filter({ hasText: name }).first();
    await row.locator("button[title='删除']").click();

    await expect(row).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("Phase 3: 收藏箱模块", () => {
  test("收藏列表页加载成功（Bookmarks h1）", async ({ page }) => {
    await page.goto("/bookmarks");
    await expect(page.locator("main h1")).toContainText("Bookmarks");
  });

  test("添加 URL 收藏", async ({ page }) => {
    const title = `bm-${uid()}`;
    await page.goto("/bookmarks");

    await page.getByRole("button", { name: "Add bookmark" }).click();
    await page.locator("input[placeholder='Title']").fill(title);
    await page
      .locator("input[placeholder='URL (optional)']")
      .fill("https://example.com");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("添加纯文本收藏", async ({ page }) => {
    const title = `txt-${uid()}`;
    await page.goto("/bookmarks");

    await page.getByRole("button", { name: "Add bookmark" }).click();
    await page.locator("input[placeholder='Title']").fill(title);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("取消添加收藏表单", async ({ page }) => {
    await page.goto("/bookmarks");
    await page.getByRole("button", { name: "Add bookmark" }).click();
    await expect(page.locator("input[placeholder='Title']")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("input[placeholder='Title']")).not.toBeVisible();
  });
});
