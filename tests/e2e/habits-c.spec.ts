import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations;

test("sit a short mock exam and see a score by domain", async ({ page }) => {
  // Make sure there are cards (the starter deck is idempotent).
  await page.goto("/mind/cards");
  const seed = page.getByRole("button", { name: "Add Security+ starter deck" });
  if (await seed.count()) await seed.click();

  await page.goto("/mind/exam");
  await page.getByRole("button", { name: "Start the mock exam" }).click();
  await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: i ? "✗ I didn't" : "✓ I had it" }).click();
  }
  await page.getByRole("button", { name: "Hand in now" }).click();
  const result = page.getByTestId("exam-result");
  await expect(result).toContainText("of 2");
  await expect(result.getByRole("list", { name: "Score by domain" }).getByRole("listitem").first()).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("money shows bills; body suggests the next session", async ({ page }) => {
  await page.goto("/money");
  await expect(page.getByTestId("bills").getByRole("heading", { name: "Bills & subscriptions" })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.goto("/body");
  const form = page.getByRole("form", { name: "Log exercise" });
  await form.getByLabel("Exercise", { exact: true }).fill(`Press ${test.info().project.name.slice(0, 4)}`);
  await form.getByLabel("Sets").fill("3");
  await form.getByLabel("Reps").fill("10");
  await form.getByLabel("Weight (kg)").fill("40");
  await form.getByRole("button", { name: "Log exercise" }).click();
  await expect(page.getByTestId("lift-suggestions")).toContainText("3×6 @ 42.5 kg");
});
