import { expect, test } from "@playwright/test";

test.describe("Page performance governance", () => {
  test("critical routes render without falling back to /login", async ({
    page,
  }) => {
    const routes = [
      { path: "/", text: "所有笔记" },
      { path: "/notes", text: "New note" },
      { path: "/ask", text: "今日事，我来帮。" },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page).toHaveURL(route.path);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page.locator("main")).toContainText(route.text);
    }
  });

  test("notes can create and mount the editor shell", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "New note" }).click();

    await expect(page).toHaveURL(/\/notes\/.+/);
    await expect(page.getByTestId("note-editor-back")).toBeVisible();
    await expect(page.locator("textarea[placeholder='New page']")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toBeVisible();
  });

  test("search dialog opens on demand", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Search Cmd K" }).click();

    await expect(
      page.locator("input[placeholder='Search notes...']")
    ).toBeVisible();
    await expect(page.locator("text=Start typing to search")).toBeVisible();
  });
});
