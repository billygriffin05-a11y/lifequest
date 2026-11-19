import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("achievements page lists badges with progress", async ({ page }) => {
  await page.goto("/achievements");
  await expect(page.getByRole("heading", { level: 1, name: "Achievements" })).toBeVisible();
  await expect(page.getByTestId("achievement-count")).toContainText(/\d+ of 11 unlocked/);
  await expect(page.getByTestId("badge-streak-7")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("open a dragon's page from the lair and rename it", async ({ page }, info) => {
  const name = `Ash ${info.project.name.slice(0, 4)}${Date.now().toString(36).slice(-4)}`;
  await page.goto("/dragons");
  await page.getByTestId("dragon-other").getByRole("link").click();
  await expect(page).toHaveURL(/\/dragons\/other$/);
  await expect(page.getByTestId("timeline").getByRole("listitem")).toHaveCount(20);
  const form = page.getByRole("form", { name: "Rename dragon" });
  await form.getByLabel("Name your dragon").fill(name);
  await form.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // Reset so other runs start from the default name.
  await form.getByLabel("Name your dragon").fill("");
  await form.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Duskshade" })).toBeVisible();
});

test("unknown dragon areas show a 404", async ({ page }) => {
  const res = await page.goto("/dragons/not-a-dragon");
  expect(res?.status()).toBe(404);
});

test("a weekly goal shows progress on the log button", async ({ page }, info) => {
  const name = `Swim ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Points").fill("5");
  await form.getByLabel("Weekly goal (optional)").fill("3");
  await form.getByLabel("Category").fill("Fitness");
  await form.getByRole("button", { name: "Add action" }).click();
  const button = page.getByRole("button", { name: `Log ${name}: plus 5 Honour` });
  await expect(button.getByTestId("weekly")).toHaveText("📅 0/3 this week");
  await button.click();
  await expect(page.getByRole("button", { name: `${name}: done today` }).getByTestId("weekly")).toHaveText("📅 1/3 this week");
});
