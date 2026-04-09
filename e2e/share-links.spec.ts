import { expect, test } from "@playwright/test";

const DEV_ACCOUNT = {
  email: "test@secondbrain.local",
  password: "test123456",
} as const;

const uid = () => Math.random().toString(36).slice(2, 8);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEV_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill(DEV_ACCOUNT.password);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("Share links", () => {
  test("note share links are viewable without logging in", async ({
    page,
    browser,
  }) => {
    const noteTitle = `Shared note ${uid()}`;
    const noteBody = `Public note body ${uid()}`;

    await login(page);

    await page.goto("/notes");
    await page.getByRole("button", { name: "New note" }).click();
    try {
      await page.waitForURL(/\/notes\/.+/, { timeout: 15000 });
    } catch {
      await page.getByTestId("note-card").first().click();
      await expect(page).toHaveURL(/\/notes\/.+/);
    }
    await page.locator("textarea[placeholder='New page']").fill(noteTitle);
    await page.locator(".ProseMirror").click();
    await page.locator(".ProseMirror").pressSequentially(noteBody, { delay: 20 });
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("note-share-button").click();
    await page.getByRole("button", { name: "Enable link sharing" }).click();

    let shareUrl = "";
    await expect
      .poll(async () => {
        shareUrl = await page.locator('input[readonly]').inputValue().catch(() => "");
        return shareUrl;
      })
      .not.toBe("");

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto(shareUrl);
    await expect(viewerPage).not.toHaveURL(/\/login/);
    await expect(viewerPage.getByRole("heading", { name: noteTitle })).toBeVisible();
    await expect(viewerPage.getByText(noteBody)).toBeVisible();

    await viewerContext.close();
  });

  test("project notes can be shared and viewed without logging in", async ({
    page,
    browser,
  }) => {
    const projectName = `Shared project ${uid()}`;
    const noteTitle = `Shared project note ${uid()}`;
    const noteBody = `Project note body ${uid()}`;

    await login(page);

    await page.goto("/projects");
    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Repository URL").fill("https://github.com/vercel/next.js");
    await page.getByLabel("Language").fill("TypeScript");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page).toHaveURL(/\/projects\/.+\/notes\/.+/);
    await page.locator("textarea[placeholder='New page']").fill(noteTitle);
    await page.locator(".ProseMirror").click();
    await page.locator(".ProseMirror").pressSequentially(noteBody, { delay: 20 });
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("project-note-share-button").click();
    await page.getByRole("button", { name: "Enable link sharing" }).click();

    let shareUrl = "";
    await expect
      .poll(async () => {
        shareUrl = await page.locator('input[readonly]').inputValue().catch(() => "");
        return shareUrl;
      })
      .not.toBe("");

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto(shareUrl);
    await expect(viewerPage).not.toHaveURL(/\/login/);
    await expect(viewerPage.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(
      viewerPage.getByRole("heading", { name: noteTitle, level: 2 })
    ).toBeVisible();
    await expect(viewerPage.getByText(noteBody)).toBeVisible();

    await viewerContext.close();
  });
});
