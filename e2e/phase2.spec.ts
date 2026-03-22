import { test, expect } from "@playwright/test";

// Use unique names per test run to avoid cross-test collisions
const uid = () => Math.random().toString(36).slice(2, 8);
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64"
);

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
    const titleInput = page.locator("textarea[placeholder='无标题']");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("无标题笔记");
  });

  test("编辑笔记标题", async ({ page }) => {
    const name = `edit-title-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("textarea[placeholder='无标题']");
    await titleInput.fill(name);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回").click();
    await expect(page).toHaveURL("/notes");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("编辑器和浮动工具栏可用", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    // Editor should be visible
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible();

    // Type some text and select it to trigger bubble toolbar
    await editor.click();
    await editor.pressSequentially("Hello World", { delay: 30 });
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");

    // Bubble toolbar should appear with formatting buttons
    await expect(page.locator("button[title='粗体']")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator("button[title='斜体']")).toBeVisible();
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

  test("悬浮插入按钮支持无序列表", async ({ page }) => {
    const listText = `bullet-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    const firstBlock = page.locator(".ProseMirror p").first();
    await firstBlock.hover();
    await page.getByTestId("editor-insert-trigger").click();
    await page
      .getByTestId("editor-insert-menu")
      .getByRole("button", { name: "无序列表" })
      .click();
    await editor.pressSequentially(listText, { delay: 30 });

    await expect(page.locator(".ProseMirror ul li").first()).toContainText(
      listText
    );
    await expect
      .poll(async () =>
        page.locator(".ProseMirror ul").first().evaluate((element) => {
          return window.getComputedStyle(element).listStyleType;
        })
      )
      .toBe("disc");
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
  });

  test("悬浮插入按钮支持有序列表", async ({ page }) => {
    const orderedText = `ordered-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    const firstBlock = page.locator(".ProseMirror p").first();
    await firstBlock.hover();
    await page.getByTestId("editor-insert-trigger").click();
    await page
      .getByTestId("editor-insert-menu")
      .getByRole("button", { name: "有序列表" })
      .click();
    await editor.pressSequentially(orderedText, { delay: 30 });

    await expect(page.locator(".ProseMirror ol li").first()).toContainText(
      orderedText
    );
    await expect
      .poll(async () =>
        page.locator(".ProseMirror ol").first().evaluate((element) => {
          return window.getComputedStyle(element).listStyleType;
        })
      )
      .toBe("decimal");
  });

  test("悬浮插入按钮会插入新块而不是改写当前块", async ({ page }) => {
    const firstText = `first-${uid()}`;
    const secondText = `second-${uid()}`;

    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially(firstText, { delay: 30 });

    const firstBlock = page.locator(".ProseMirror p").first();
    await firstBlock.hover();
    await page.getByTestId("editor-insert-trigger").click();
    await page
      .getByTestId("editor-insert-menu")
      .getByRole("button", { name: "标题 2" })
      .click();
    await editor.pressSequentially(secondText, { delay: 30 });

    await expect(page.locator(".ProseMirror p").first()).toContainText(firstText);
    await expect(page.locator(".ProseMirror h2").first()).toContainText(secondText);
  });

  test("悬浮插入按钮支持待办列表并可勾选", async ({ page }) => {
    const todoText = `todo-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    const firstBlock = page.locator(".ProseMirror p").first();
    await firstBlock.hover();
    await page.getByTestId("editor-insert-trigger").click();
    await page
      .getByTestId("editor-insert-menu")
      .getByRole("button", { name: "待办列表" })
      .click();
    await editor.pressSequentially(todoText, { delay: 30 });

    const todoItem = page.locator(".ProseMirror ul[data-type='taskList'] li").first();
    await expect(todoItem).toContainText(todoText);

    const checkbox = todoItem.locator("input[type='checkbox']").first();
    await checkbox.check();
    await expect(todoItem).toHaveAttribute("data-checked", "true");
  });

  test("块菜单支持复制和删除", async ({ page }) => {
    const text = `dup-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially(text, { delay: 30 });

    const firstParagraph = page.locator(".ProseMirror p").filter({ hasText: text }).first();
    await firstParagraph.hover();
    await page.getByTestId("editor-block-menu-trigger").click();
    await page
      .getByTestId("editor-block-action-menu")
      .getByRole("button", { name: "复制块" })
      .click();

    await expect(page.locator(".ProseMirror p").filter({ hasText: text })).toHaveCount(2);

    const secondParagraph = page.locator(".ProseMirror p").filter({ hasText: text }).nth(1);
    await secondParagraph.hover();
    await page.getByTestId("editor-block-menu-trigger").click();
    await page
      .getByTestId("editor-block-action-menu")
      .getByRole("button", { name: "删除块" })
      .click();

    await expect(page.locator(".ProseMirror p").filter({ hasText: text })).toHaveCount(1);
  });

  test("块菜单支持上下移动", async ({ page }) => {
    const firstText = `move-a-${uid()}`;
    const secondText = `move-b-${uid()}`;

    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially(firstText, { delay: 30 });
    await page.keyboard.press("Enter");
    await editor.pressSequentially(secondText, { delay: 30 });

    const firstParagraph = page.locator(".ProseMirror p").filter({ hasText: firstText }).first();
    await firstParagraph.hover();
    await page.getByTestId("editor-block-menu-trigger").click();
    await page
      .getByTestId("editor-block-action-menu")
      .getByRole("button", { name: "下移" })
      .click();

    await expect(page.locator(".ProseMirror p").nth(0)).toContainText(secondText);
    await expect(page.locator(".ProseMirror p").nth(1)).toContainText(firstText);
  });

  test("可以插入本地图片并保存", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    await page.getByTestId("editor-image-input").setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });

    await expect(page.locator(".ProseMirror img")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.locator(".ProseMirror img")).toBeVisible({
      timeout: 5000,
    });
  });

  test("切换笔记类型", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    // Open metadata panel
    await page.locator("button[title='笔记属性']").click();

    // Click "日记" type button
    await page.getByRole("button", { name: "日记" }).click();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回").click();
    // Verify the type badge "日记" appears in the note list
    await expect(
      page.locator(".bg-gray-100", { hasText: "日记" }).first()
    ).toBeVisible();
  });

  test("添加和删除标签", async ({ page }) => {
    const tagName = `tag-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    // Open metadata panel
    await page.locator("button[title='笔记属性']").click();

    const tagInput = page.locator("input[placeholder='添加标签...']");
    await tagInput.fill(tagName);
    await tagInput.press("Enter");

    await expect(page.getByText(tagName).first()).toBeVisible();
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回").click();
    await expect(page.getByText(tagName).first()).toBeVisible();
  });

  test("删除笔记", async ({ page }) => {
    const name = `del-${uid()}`;
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("textarea[placeholder='无标题']");
    await titleInput.fill(name);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

    await page.getByText("返回").click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Accept confirm dialog before clicking delete
    page.on("dialog", (dialog) => dialog.accept());

    // Find the specific note row and its delete button
    const noteRow = page
      .locator("[class*='cursor-pointer']")
      .filter({ hasText: name })
      .first();
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
    const t1 = page.locator("textarea[placeholder='无标题']");
    await t1.fill(apple);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
    await page.getByText("返回").click();

    await page.getByText("新建笔记").click();
    const t2 = page.locator("textarea[placeholder='无标题']");
    await t2.fill(banana);
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
    await page.getByText("返回").click();

    // Search
    await page.locator("input[placeholder='搜索笔记...']").fill(apple);
    await expect(page.getByText(apple).first()).toBeVisible();
    await expect(page.getByText(banana)).not.toBeVisible();
  });

  test("自动保存功能", async ({ page }) => {
    await page.goto("/notes");
    await page.getByText("新建笔记").click();
    await expect(page).toHaveURL(/\/notes\/.+/);

    const titleInput = page.locator("textarea[placeholder='无标题']");
    await titleInput.fill(`save-${uid()}`);

    // Auto-save triggers after 1.5s
    await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });
  });
});
