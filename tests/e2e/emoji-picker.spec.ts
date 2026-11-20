import { expect, test } from "@playwright/test";

test("pick an emoji for a new action from the picker", async ({ page }, info) => {
  const name = `Swim ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByText("Pick an emoji").click();
  await form.getByRole("button", { name: "Swimming" }).click();
  await expect(form.getByLabel("Icon (emoji)")).toHaveValue("🏊");
  await expect(form.getByRole("button", { name: "Swimming" })).toHaveAttribute("aria-pressed", "true");
  await form.getByLabel("Category").fill("Fitness");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText(`Added “${name}”.`)).toBeVisible();
  // The new action shows the picked emoji, and the form resets to the default icon.
  await expect(page.getByRole("button", { name: new RegExp(`Log ${name}`) })).toContainText("🏊");
  await expect(form.getByLabel("Icon (emoji)")).toHaveValue("⭐");
});

test("typing a custom emoji still works", async ({ page }) => {
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Icon (emoji)").fill("🦄");
  await form.getByText("Pick an emoji").click();
  await expect(form.getByRole("button", { name: "Swimming" })).toHaveAttribute("aria-pressed", "false");
  await expect(form.getByLabel("Icon (emoji)")).toHaveValue("🦄");
});
