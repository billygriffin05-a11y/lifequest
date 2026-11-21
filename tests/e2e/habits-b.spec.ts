import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations;

test("weekly review can be filled in and saved", async ({ page }) => {
  await page.goto("/report");
  const form = page.getByRole("form", { name: "Weekly review" });
  await form.getByLabel("What was your best win this week?").fill(`Win ${test.info().project.name}`);
  await form.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByLabel("What was your best win this week?")).toHaveValue(/^Win /);
  expect(await axe(page)).toEqual([]);
});

test("dragon lair shows party stats; boss shows damage sources", async ({ page }) => {
  await page.goto("/dragons");
  await expect(page.getByTestId("party-stats").getByRole("progressbar")).toHaveCount(5);
  expect(await axe(page)).toEqual([]);
  await page.goto("/honour");
  await expect(page.getByTestId("boss-damage")).toContainText("Training");
});

test("shop shows the current seasonal festival; dragon page explains paths", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByTestId("season").getByRole("heading")).toBeVisible();
  await expect(page.getByRole("list", { name: "Seasonal items" }).getByRole("listitem")).not.toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  await page.goto("/dragons/fitness");
  await expect(page.getByTestId("evolution-path")).toContainText("Evolution path");
});
