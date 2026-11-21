import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("☰ menu opens, lists every area, navigates and closes", async ({ page }) => {
  await page.goto("/honour");
  const button = page.getByRole("button", { name: "Open menu" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  const menu = page.getByRole("navigation", { name: "Main menu" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "Honour" })).toHaveAttribute("aria-current", "page");
  for (const name of ["Home", "Dragons", "Money", "Body", "Mind", "Calendar", "Settings", "Search", "Dragon gallery"]) {
    await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await menu.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toHaveCount(0);
});

test("☰ menu closes with Escape and returns focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
