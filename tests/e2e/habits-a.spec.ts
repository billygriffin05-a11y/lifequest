import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("an action can have an if-then plan that shows on its log button", async ({ page }) => {
  const name = `Plan ${test.info().project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Points").fill("5");
  await form.getByLabel("Icon (emoji)").fill("📚");
  await form.getByLabel("Category").fill("Study");
  await form.getByLabel("When…").fill("After my morning coffee");
  await form.getByLabel("Remind me at").fill("07:30");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText(`Added “${name}”.`)).toBeVisible();
  const button = page.getByRole("button", { name: new RegExp(`^Log ${name}`) });
  await expect(button.getByTestId("cue")).toHaveText("↳ After my morning coffee");
});

test("settings shows phone reminders with a per-device switch", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Reminders on your phone" })).toBeVisible();
  await expect(page.getByTestId("push-toggle")).not.toHaveAttribute("data-status", "checking");
  const form = page.getByRole("form", { name: "Reminder settings" });
  await form.getByLabel("Streak at risk time").fill("21:00");
  await form.getByRole("button", { name: "Save reminders" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByLabel("Streak at risk time")).toHaveValue("21:00");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
