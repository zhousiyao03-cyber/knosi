import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
  test("Terms of Service renders and is linked from landing footer", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
    await expect(page).toHaveURL(/\/legal\/terms$/);
    await expect(page.locator("h1")).toHaveText(/Terms of Service/i);
    await expect(page.getByText(/Effective date/)).toBeVisible();
  });

  test("Privacy Policy renders and is linked from landing footer", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Privacy" })
      .click();
    await expect(page).toHaveURL(/\/legal\/privacy$/);
    await expect(page.locator("h1")).toHaveText(/Privacy Policy/i);
    await expect(page.getByText(/Effective date/)).toBeVisible();
  });

  test("Refund Policy renders and is linked from landing footer", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Refunds" })
      .click();
    await expect(page).toHaveURL(/\/legal\/refund$/);
    await expect(page.locator("h1")).toHaveText(/Refund Policy/i);
    await expect(page.getByText(/14-Day Money-Back Guarantee/i)).toBeVisible();
  });

  test("Pricing page links to Refund Policy", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("link", { name: "Refund Policy" }).click();
    await expect(page).toHaveURL(/\/legal\/refund$/);
  });

  test("Sitemap includes legal routes", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("https://www.knosi.xyz/legal/terms");
    expect(body).toContain("https://www.knosi.xyz/legal/privacy");
    expect(body).toContain("https://www.knosi.xyz/legal/refund");
    expect(body).toContain("https://www.knosi.xyz/pricing");
  });
});
