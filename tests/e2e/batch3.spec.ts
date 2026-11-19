import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("money page: starter budgets, add spending, savings goal", async ({ page }) => {
  await page.goto("/money");
  await expect(page.getByRole("heading", { level: 1, name: "Money" })).toBeVisible();
  const starter = page.getByRole("button", { name: "Add starter categories" });
  if (await starter.count()) await starter.click();
  await expect(page.getByTestId("budget-Groceries")).toBeVisible();

  const desc = `Test shop ${Date.now()}`;
  const form = page.getByRole("form", { name: "Add transaction" });
  await form.getByLabel("Amount (£)").fill("12.50");
  await form.getByLabel("Description").fill(desc);
  await form.getByLabel("Category").selectOption({ label: "🛒 Groceries" });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByTestId("transactions")).toContainText(desc);

  const goal = page.getByRole("form", { name: "New savings goal" });
  const goalName = `Goal ${Date.now() % 100000}`;
  await goal.getByLabel("Goal name").fill(goalName);
  await goal.getByLabel("Target (£)").fill("100");
  await goal.getByRole("button", { name: "New goal" }).click();
  await expect(page.getByTestId(`goal-${goalName}`)).toContainText("£0.00 of £100.00");

  await page.getByRole("button", { name: `Remove ${desc}` }).click();
  await expect(page.getByTestId("transactions").or(page.getByText("Nothing yet this month."))).not.toContainText(desc);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("money page month navigation", async ({ page }) => {
  await page.goto("/money?m=2026-01");
  await expect(page.getByRole("heading", { name: "January 2026", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /December 2025/ }).click();
  await expect(page.getByRole("heading", { name: "December 2025", exact: true })).toBeVisible();
});
