import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("settings shows Google Calendar setup steps when no OAuth client is configured", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByTestId("gcal-status")).toHaveText("Not set up");
  await expect(page.getByText("One-time setup")).toBeVisible();
  await expect(page.getByRole("link", { name: "Link Google Calendar" })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("starting OAuth without configuration goes back to settings (never to Google)", async ({ page }) => {
  await page.goto("/api/integrations/google/start");
  await expect(page).toHaveURL(/\/settings\?google=not-configured$/);
  await expect(page.getByRole("status")).toContainText("Add your Google OAuth client");
});

test("a forged callback is rejected", async ({ request }) => {
  const res = await request.get("/api/integrations/google/callback?code=x&state=forged", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toMatch(/google=not-configured|google=invalid-state/);
});

test("a deed can be logged once per day", async ({ page }, info) => {
  const name = `Plank ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByText("Good (adds Honour + XP)").click();
  await form.getByLabel("Points").fill("3");
  await form.getByLabel("Icon (emoji)").fill("🧱");
  await form.getByLabel("Category").fill("Fitness");
  await form.getByRole("button", { name: "Add action" }).click();
  await page.getByRole("button", { name: `Log ${name}: plus 3 Honour` }).click();
  const done = page.getByRole("button", { name: `${name}: done today` });
  await expect(done).toBeDisabled();
  // Undo frees it again for today.
  await page.getByTestId("today-list").getByRole("button", { name: `Undo ${name}` }).click();
  await expect(page.getByRole("button", { name: `Log ${name}: plus 3 Honour` })).toBeEnabled();
});
