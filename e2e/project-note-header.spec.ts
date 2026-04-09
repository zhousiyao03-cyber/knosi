import { expect, test } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test("project note header keeps share and save pills on one row on narrow screens", async ({
  page,
}) => {
  const projectName = `Project header ${uid()}`;
  const noteTitle = `Project note ${uid()}`;
  const noteBody = `Project note body ${uid()}`;

  await page.setViewportSize({ width: 375, height: 900 });
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

  const shareButton = page.getByTestId("project-note-share-button");
  await shareButton.click();
  await page.getByRole("button", { name: "Enable link sharing" }).click();
  await expect(shareButton).toContainText("Shared", { timeout: 5000 });
  await shareButton.click();

  const editedPill = page.locator("span").filter({ hasText: /^Edited / }).first();
  const savedPill = page.locator("span").filter({ hasText: /^Saved$/ }).first();

  await expect(editedPill).toBeVisible();
  await expect(savedPill).toBeVisible();

  const [shareBox, editedBox, savedBox] = await Promise.all([
    shareButton.boundingBox(),
    editedPill.boundingBox(),
    savedPill.boundingBox(),
  ]);

  expect(shareBox).not.toBeNull();
  expect(editedBox).not.toBeNull();
  expect(savedBox).not.toBeNull();

  const tops = [shareBox!.y, editedBox!.y, savedBox!.y];
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(6);
});
