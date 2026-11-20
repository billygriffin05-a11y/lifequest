import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("calendar shows the month and today's details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Areas" }).getByRole("link", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  const grid = page.getByTestId("month-grid");
  await expect(grid.locator("tbody tr").first().locator("td")).toHaveCount(7);
  await expect(grid.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(page.getByTestId("day-panel")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("calendar navigates months and opens a day", async ({ page }) => {
  await page.goto("/calendar?m=2026-01");
  await expect(page.getByRole("heading", { name: "January 2026" })).toBeVisible();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByRole("heading", { name: "December 2025" })).toBeVisible();
  await page.getByRole("link", { name: /^Thursday 25 December/ }).click();
  await expect(page.getByRole("heading", { name: "Thursday 25 December" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to today" })).toBeVisible();
});

test("page link rows stay on one line", async ({ page }) => {
  await page.goto("/honour");
  const nav = page.getByRole("navigation", { name: "Breadcrumb" });
  const box = await nav.boundingBox();
  expect(box?.height ?? 0).toBeLessThanOrEqual(48);
  await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
});
