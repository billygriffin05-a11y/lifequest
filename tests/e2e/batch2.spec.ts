import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("treasure shop lists items with gold and previews", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1, name: "Treasure Shop" })).toBeVisible();
  await expect(page.getByTestId("gold")).toContainText("gold");
  await expect(page.getByRole("list", { name: "Shop items" }).getByRole("listitem")).toHaveCount(8);
  await expect(page.getByTestId("item-royal-crown").getByTestId("accessory")).toBeAttached();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("weekly boss shows on the Honour page", async ({ page }) => {
  await page.goto("/honour");
  const boss = page.getByTestId("boss");
  await expect(boss.getByText("Weekly boss")).toBeVisible();
  await expect(boss.getByRole("progressbar")).toBeVisible();
  await expect(boss.getByTestId("boss-status")).toContainText(/HP left|Defeated/);
});

test("home shows a hero dragon with gold, and a dragon can be made favourite", async ({ page }) => {
  await page.goto("/dragons/reading");
  const fav = page.getByRole("button", { name: "☆ Make favourite" });
  if (await fav.count()) await fav.click();
  await expect(page.getByText("★ Your favourite dragon")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("home-hero")).toContainText("★ favourite");
  await expect(page.getByTestId("home-gold")).toContainText("gold");
});
