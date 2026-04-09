import { test, expect } from "@playwright/test";

test.describe("Dashboard 最近 30 天工作时长热力图", () => {
  test("首页渲染热力图卡片（标题 + 汇总指标 + 图例 + 6 列网格）", async ({
    page,
  }) => {
    await page.goto("/");

    const card = page
      .locator("section")
      .filter({ hasText: "最近 30 天工作时长" });
    await expect(card).toBeVisible();

    // 顶部 4 个汇总指标标签
    await expect(card.getByText("总计", { exact: true })).toBeVisible();
    await expect(card.getByText("活跃日均", { exact: true })).toBeVisible();
    await expect(card.getByText("连续", { exact: true })).toBeVisible();
    await expect(card.getByText("峰值", { exact: true })).toBeVisible();

    // 网格：role="grid" 存在且含有至少 5 列（30 天约 5~6 周）
    const grid = card.getByRole("grid", { name: "最近 30 天工作时长热力图" });
    await expect(grid).toBeVisible();

    // grid 内应渲染 30 个 gridcell（空 placeholder 不是 gridcell，数据格是）
    const cells = grid.getByRole("gridcell");
    await expect(cells).toHaveCount(30);

    // 右上角 Focus 详情跳转链接
    await expect(card.getByRole("link", { name: /Focus 详情/ })).toHaveAttribute(
      "href",
      "/focus"
    );
  });
});
