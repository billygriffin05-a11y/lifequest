import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The e2e database is shared between projects, so each test uses unique names
// and only asserts on its own rows.
function uniqueName(prefix: string, project: string) {
  return `${prefix} ${project.slice(0, 6)} ${Date.now().toString(36)}`;
}

async function createAction(page: Page, name: string, kind: "good" | "bad", points: number, icon: string) {
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByText(kind === "good" ? "Good (adds Honour + XP)" : "Bad (costs Honour)").click();
  await form.getByLabel("Points").fill(String(points));
  await form.getByLabel("Icon (emoji)").fill(icon);
  await form.getByLabel("Category").fill("Testing");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText(`Added “${name}”.`)).toBeVisible();
}

test("create custom good and bad actions, log them, and undo", async ({ page }, info) => {
  const good = uniqueName("Stretching", info.project.name);
  const bad = uniqueName("Doomscrolling", info.project.name);
  await page.goto("/honour");
  await expect(page.getByRole("heading", { level: 1, name: "Honour" })).toBeVisible();

  await createAction(page, good, "good", 7, "🧘");
  await createAction(page, bad, "bad", 3, "📱");

  // Both appear as log buttons in the right columns.
  const goodButton = page.getByRole("button", { name: `Log ${good}: plus 7 Honour` });
  const badButton = page.getByRole("button", { name: `Log ${bad}: minus 3 Honour` });
  await expect(page.getByRole("region", { name: "Good deeds" }).getByRole("button", { name: `Log ${good}: plus 7 Honour` })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bad habits" }).getByRole("button", { name: `Log ${bad}: minus 3 Honour` })).toBeVisible();

  await goodButton.click();
  const today = page.getByTestId("today-list");
  await expect(today.getByText(good)).toBeVisible();
  await badButton.click();
  await expect(today.getByText(bad)).toBeVisible();

  // Undo the bad one: it stays in history, marked as undone.
  await today.getByRole("button", { name: `Undo ${bad}` }).click();
  await expect(today.getByRole("listitem").filter({ hasText: bad }).getByText("Undone")).toBeVisible();

  // Persists after reload (it's in the local database, not the browser).
  await page.reload();
  await expect(page.getByRole("button", { name: `Log ${good}: plus 7 Honour` })).toBeVisible();
});

test("archive hides an action from logging and restore brings it back", async ({ page }, info) => {
  const name = uniqueName("Late night", info.project.name);
  await page.goto("/honour");
  await createAction(page, name, "bad", 5, "🌙");
  await page.getByRole("button", { name: `Archive ${name}` }).click();
  await expect(page.getByRole("button", { name: `Restore ${name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Log ${name}: minus 5 Honour` })).toHaveCount(0);
  await page.getByRole("button", { name: `Restore ${name}` }).click();
  await expect(page.getByRole("button", { name: `Log ${name}: minus 5 Honour` })).toBeVisible();
});

test("validation errors are shown without losing what was typed", async ({ page }) => {
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill("Too generous");
  await form.getByLabel("Points").evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
  await form.getByLabel("Points").fill("5000");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText("Points must be 1000 or fewer")).toBeVisible();
  await expect(form.getByLabel("Name")).toHaveValue("Too generous");
});

test("honour page has no detectable WCAG A/AA violations", async ({ page }) => {
  await page.goto("/honour");
  await expect(page.getByRole("heading", { name: "Customise your actions" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("honour page does not scroll horizontally", async ({ page }) => {
  await page.goto("/honour");
  await expect(page.getByRole("heading", { name: "Customise your actions" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
