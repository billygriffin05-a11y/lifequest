import { expect, test } from "@playwright/test";

test("home and honour pages show the player rank", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("rank-card")).toContainText(/Rank · Level \d/);
  await page.goto("/honour");
  await expect(page.getByTestId("rank-card")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /Progress to|Highest rank/ })).toBeVisible();
});

test("add a note to a logged deed", async ({ page }, info) => {
  const name = `Run ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByText("Good (adds Honour + XP)").click();
  await form.getByLabel("Points").fill("4");
  await form.getByLabel("Category").fill("Fitness");
  await form.getByRole("button", { name: "Add action" }).click();
  await page.getByRole("button", { name: `Log ${name}: plus 4 Honour` }).click();

  const row = page.getByTestId("today-list").getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: `Add note for ${name}` }).click();
  await row.getByLabel(`Note for ${name}`).fill("5k in 28 min");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByTestId("entry-note")).toHaveText("“5k in 28 min”");
  await expect(row.getByRole("button", { name: `Edit note for ${name}` })).toBeVisible();
});
