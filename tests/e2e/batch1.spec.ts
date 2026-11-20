import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function addGood(page: import("@playwright/test").Page, name: string) {
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Points").fill("2");
  await form.getByLabel("Category").fill("Habits");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText(`Added “${name}”.`)).toBeVisible();
}

test("log a deed for yesterday", async ({ page }, info) => {
  const name = `Floss ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/honour");
  await addGood(page, name);
  await page.getByRole("link", { name: "Forgot something yesterday?" }).click();
  await expect(page.getByTestId("day-toggle").getByRole("status")).toContainText("yesterday");
  await page.getByRole("button", { name: `Log ${name} for yesterday: plus 2 Honour` }).click();
  await expect(page.getByRole("button", { name: `${name}: done yesterday` })).toBeDisabled();
  // Today is still free.
  await page.getByRole("link", { name: "Back to today" }).click();
  await expect(page.getByRole("button", { name: `Log ${name}: plus 2 Honour` })).toBeEnabled();
});

test("daily quests are shown when there are good actions", async ({ page }, info) => {
  await page.goto("/honour");
  // Make sure at least one good action exists (CI starts from an empty database).
  await addGood(page, `Quest seed ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`);
  await page.reload();
  const quests = page.getByTestId("quests");
  await expect(quests.getByRole("heading", { name: "Today's quests" })).toBeVisible();
  const count = await quests.getByRole("listitem").count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
});

test("habit heatmap page", async ({ page }) => {
  await page.goto("/honour");
  await page.getByRole("link", { name: "Habit heatmap" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Habit heatmap" })).toBeVisible();
  // On an empty database (tests run in any order) there are no actions yet.
  const first = page.getByRole("list", { name: "Habit heatmaps" }).getByRole("listitem").first();
  const empty = page.getByText("No actions yet — add some on the Honour page.");
  await expect(first.or(empty)).toBeVisible();
  if (await first.count()) await expect(first).toContainText("days in the last 12 weeks");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("CSV export downloads the ledger", async ({ request }) => {
  const res = await request.get("/api/export/ledger");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="lifequest-ledger-\d{4}-\d{2}-\d{2}\.csv"/);
  expect((await res.text()).replace(/^﻿/, "").split("\r\n")[0]).toBe(
    "date,time_utc,action,icon,kind,category,honour,xp,note,undone,is_undo",
  );
});
