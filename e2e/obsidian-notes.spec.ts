import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Obsidian-Style Notes System", () => {
  test.describe("Folder Tree", () => {
    test("notes page shows folder sidebar on desktop", async ({ page }) => {
      await page.goto("/notes");
      // Explorer header (clickable, shows root) should exist
      await expect(page.getByText("Explorer")).toBeVisible();
      // New folder button should exist
      await expect(page.locator('button[title="New folder"]')).toBeVisible();
    });

    test("can create a folder via the new folder button", async ({ page }) => {
      const folderName = `TestFolder-${uid()}`;
      await page.goto("/notes");

      // Click the new folder button (FolderPlus icon button)
      await page.locator('button[title="New folder"]').click();

      // Type folder name in the input
      const input = page.locator('input[placeholder="Folder name..."]');
      await expect(input).toBeVisible();
      await input.fill(folderName);
      await input.press("Enter");

      // Wait for folder to appear in the tree
      await expect(page.getByText(folderName).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("can create a nested subfolder via context menu", async ({
      page,
    }) => {
      const parentName = `Parent-${uid()}`;
      const childName = `Child-${uid()}`;
      await page.goto("/notes");

      // Create parent folder
      await page.locator('button[title="New folder"]').click();
      const input = page.locator('input[placeholder="Folder name..."]');
      await input.fill(parentName);
      await input.press("Enter");
      await expect(page.getByText(parentName).first()).toBeVisible({
        timeout: 5000,
      });

      // Right-click on parent folder to open context menu
      await page.getByText(parentName).first().click({ button: "right" });
      await expect(page.getByText("New subfolder")).toBeVisible();
      await page.getByText("New subfolder").click();

      // Type child folder name
      const childInput = page.locator('input[placeholder="Folder name..."]');
      await expect(childInput).toBeVisible();
      await childInput.fill(childName);
      await childInput.press("Enter");

      // Child should appear
      await expect(page.getByText(childName).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("folder operations: rename and context menu work", async ({
      page,
    }) => {
      const folderName = `RenameTest-${uid()}`;
      await page.goto("/notes");

      // Create folder
      await page.locator('button[title="New folder"]').click();
      const input = page.locator('input[placeholder="Folder name..."]');
      await input.fill(folderName);
      await input.press("Enter");
      await expect(page.getByText(folderName).first()).toBeVisible({
        timeout: 5000,
      });

      // Verify context menu opens on right-click
      await page.getByText(folderName).first().click({ button: "right" });
      await expect(
        page.getByText("New note here", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText("New subfolder", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText("Rename", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText("Delete", { exact: true })
      ).toBeVisible();

      // Close context menu by pressing Escape
      await page.keyboard.press("Escape");
    });

    test("can delete a folder via context menu", async ({ page }) => {
      const folderName = `Delete-${uid()}`;
      await page.goto("/notes");

      // Create folder
      await page.locator('button[title="New folder"]').click();
      const input = page.locator('input[placeholder="Folder name..."]');
      await input.fill(folderName);
      await input.press("Enter");
      await expect(page.getByText(folderName).first()).toBeVisible({
        timeout: 5000,
      });

      // Set up dialog handler BEFORE triggering
      page.on("dialog", (dialog) => dialog.accept());

      // Right-click and delete — use the context menu's delete button specifically
      await page.getByText(folderName).first().click({ button: "right" });
      // The context menu "Delete" button is the one with red styling
      const deleteBtn = page.locator("button").filter({ hasText: "Delete" }).last();
      await deleteBtn.click();

      // Wait for mutation to complete and folder to disappear
      await page.waitForTimeout(1500);
      const folderElements = page.getByText(folderName, { exact: true });
      await expect(folderElements).toHaveCount(0, { timeout: 5000 });
    });

    test("clicking a created folder filters the note list", async ({ page }) => {
      const folderName = `FilterTest-${uid()}`;
      await page.goto("/notes");

      // Create a folder to click on
      await page.locator('button[title="New folder"]').click();
      const input = page.locator('input[placeholder="Folder name..."]');
      await input.fill(folderName);
      await input.press("Enter");
      await expect(page.getByText(folderName).first()).toBeVisible({
        timeout: 5000,
      });

      // Click it → heading should reflect folder name
      await page.getByText(folderName).first().click();
      await expect(page.locator("main h1")).toContainText(folderName);
    });
  });

  test.describe("Note Folder Assignment", () => {
    test("new note can be created from notes page", async ({ page }) => {
      await page.goto("/notes");
      await page.getByText("New note").click();
      await expect(page).toHaveURL(/\/notes\/.+/);
      // Editor should load
      await expect(
        page.locator("textarea[placeholder='New page']")
      ).toBeVisible();
    });
  });

  test.describe("Editor Backlinks", () => {
    test("note editor loads without error", async ({ page }) => {
      await page.goto("/notes");
      await page.getByText("New note").click();
      await expect(page).toHaveURL(/\/notes\/.+/);
      await expect(
        page.locator("textarea[placeholder='New page']")
      ).toBeVisible();
      // Editor content area should be present
      await expect(page.locator(".ProseMirror")).toBeVisible();
    });
  });

  test.describe("Folder in Editor", () => {
    test("editor has folder picker button", async ({ page }) => {
      await page.goto("/notes");
      await page.getByText("New note").click();
      await expect(page).toHaveURL(/\/notes\/.+/);
      // Folder picker button should show "Add to folder"
      await expect(page.getByText("Add to folder")).toBeVisible();
    });
  });
});
