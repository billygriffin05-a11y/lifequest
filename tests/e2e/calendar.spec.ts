import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
const views = (page: Page) => page.getByRole("navigation", { name: "Calendar view" });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("calendar month view from the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Areas" }).getByRole("link", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(views(page).getByRole("link", { name: "Month", exact: true })).toHaveAttribute("aria-current", "page");
  const grid = page.getByTestId("month-grid");
  await expect(grid.locator("tbody tr").first().locator("td")).toHaveCount(7);
  await expect(grid.locator('[aria-current="date"]')).toHaveCount(1);
  // No Google client in the test environment: a clear notice, LIFEQUEST activity still shown.
  await expect(page.getByTestId("google-notice")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  expect(await noSideScroll(page)).toBe(false);
});

test("calendar switches between month, week and day", async ({ page }) => {
  await page.goto("/calendar?view=month&d=2026-01-14");
  await expect(page.getByTestId("period-title")).toHaveText("January 2026");
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByTestId("period-title")).toHaveText("December 2025");

  await views(page).getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByTestId("week-grid").getByRole("listitem")).toHaveCount(7);
  await expect(page.getByTestId("period-title")).toContainText("–");
  expect((await axe(page)).violations).toEqual([]);
  expect(await noSideScroll(page)).toBe(false);
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page.getByRole("link", { name: "Back to today" })).toBeVisible();

  await page.goto("/calendar?view=month&d=2025-12-01");
  await page.getByRole("link", { name: /^Thursday 25 December/ }).click();
  await expect(views(page).getByRole("link", { name: "Day", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("period-title")).toHaveText("Thursday 25 December");
  await expect(page.getByRole("heading", { name: "Your calendar" })).toBeVisible();
  await expect(page.getByTestId("day-panel")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page.getByTestId("period-title")).toHaveText("Friday 26 December");
});

test("page link rows stay on one line", async ({ page }) => {
  await page.goto("/honour");
  const nav = page.getByRole("navigation", { name: "Breadcrumb" });
  const box = await nav.boundingBox();
  expect(box?.height ?? 0).toBeLessThanOrEqual(48);
  await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
});
