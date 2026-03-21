import { test, expect } from "@playwright/test";

// Use unique names per test run to avoid cross-test collisions
const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Phase 2: 笔记本模块", () => {
  test("笔记列表页加载成功", async ({ page }) => {
    await page.goto("/notes");
    await expect(page.locator("main h1")).toContainText("笔记");
    await expect(page.getByText("新建笔记")).toBeVisible();
  });

  test("创建新笔记并跳转到编辑页", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();

    // Should navigate to /notes/[id]
    await expect(page).toHaveURL(/\/notes\/.+/);
    const titleInput = page.locator("input[placeholder='笔记标题']");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("无标题笔记");
  });

  test("编辑笔记标题", async ({ page }) => {
    const name = `edit-title-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("input[placeholder='笔记标题']");
    await titleInput.fill(name);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回列表").click();
    await expect(page).toHaveURL("/notes");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("Tiptap 编辑器工具栏可见且可操作", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    await expect(page.locator("button[title='粗体']")).toBeVisible();
    await expect(page.locator("button[title='斜体']")).toBeVisible();
    await expect(page.locator("button[title='标题 1']")).toBeVisible();
    await expect(page.locator("button[title='无序列表']")).toBeVisible();
    await expect(page.locator("button[title='引用']")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toBeVisible();
  });

  test("在编辑器中输入内容并自动保存", async ({ page }) => {
    const text = `hello-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially(text, { delay: 30 });

    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText(text);
  });

  test("切换笔记类型", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const typeSelect = page.locator("select");
    await typeSelect.selectOption("journal");
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回列表").click();
    // Verify the type badge "日记" appears in the note list
    await expect(page.locator(".bg-gray-100", { hasText: "日记" }).first()).toBeVisible();
  });

  test("添加和删除标签", async ({ page }) => {
    const tagName = `tag-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const tagInput = page.locator("input[placeholder='添加标签...']");
    await tagInput.fill(tagName);
    await tagInput.press("Enter");

    await expect(page.getByText(tagName).first()).toBeVisible();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回列表").click();
    await expect(page.getByText(tagName).first()).toBeVisible();
  });

  test("删除笔记", async ({ page }) => {
    const name = `del-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("input[placeholder='笔记标题']");
    await titleInput.fill(name);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回列表").click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Accept confirm dialog before clicking delete
    page.on("dialog", (dialog) => dialog.accept());

    // Find the specific note row and its delete button
    const noteRow = page.locator("[class*='cursor-pointer']").filter({ hasText: name }).first();
    await noteRow.hover();
    await noteRow.locator("button[title='删除']").click({ force: true });

    // Wait for the deletion to take effect
    await page.waitForTimeout(500);

    // Verify it's gone from the list
    await expect(noteRow).not.toBeVisible({ timeout: 5000 });
  });

  test("搜索笔记", async ({ page }) => {
    const apple = `apple-${uid()}`;
    const banana = `banana-${uid()}`;

    // Create two notes
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    const t1 = page.locator("input[placeholder='笔记标题']");
    await t1.fill(apple);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
    await page.getByText("返回列表").click();

    await page.getByText("新建笔记").click();
    const t2 = page.locator("input[placeholder='笔记标题']");
    await t2.fill(banana);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
    await page.getByText("返回列表").click();

    // Search
    await page.locator("input[placeholder='搜索笔记...']").fill(apple);
    await expect(page.getByText(apple).first()).toBeVisible();
    await expect(page.getByText(banana)).not.toBeVisible();
  });

  test("手动保存按钮", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("input[placeholder='笔记标题']");
    await titleInput.fill(`save-${uid()}`);

    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
  });
});
