import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

async function addAction(page: Page, name: string) {
  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Points").fill("5");
  await form.getByLabel("Icon (emoji)").fill("🧪");
  await form.getByLabel("Category").fill("Testing");
  await form.getByRole("button", { name: "Add action" }).click();
  await expect(form.getByText(`Added “${name}”.`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Archive ${name}` })).toBeVisible();
}

test("home dashboard shows today, areas and search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("today-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's quests" })).toBeVisible();
  await expect(page.getByTestId("cards-due")).toContainText("due");
  await expect(page.getByRole("navigation", { name: "Areas" }).getByRole("link")).toHaveCount(10);
  expect((await axe(page)).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("search finds an action and filters by type", async ({ page }) => {
  const name = `Zephyr ${test.info().project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await addAction(page, name);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search everything" }).fill("zephyr");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=zephyr/);
  await expect(page.getByTestId("search-results")).toContainText(name);
  await page.getByRole("link", { name: /^Actions · \d+/ }).click();
  await expect(page.getByTestId("search-results")).toContainText(name);
  expect((await axe(page)).violations).toEqual([]);
  await page.goto("/search?q=qqqqzzzz");
  await expect(page.getByTestId("no-results")).toBeVisible();
});

test("actions can be reordered", async ({ page }) => {
  const name = `Mover ${test.info().project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await addAction(page, name);
  // Other browser projects share this database, so compare with the row just above ours.
  const names = async () => page.getByTestId("manage-action").allInnerTexts();
  const before = await names();
  const i = before.findIndex((t) => t.includes(name));
  expect(i).toBeGreaterThan(0);
  const above = before[i - 1];
  await page.getByRole("button", { name: `Move ${name} up` }).click();
  await expect
    .poll(async () => {
      const now = await names();
      return now.findIndex((t) => t.includes(name)) < now.indexOf(above);
    })
    .toBe(true);
  await expect(page.getByRole("button", { name: `Move ${name} down` })).toBeEnabled();
});

test("weekly report renders and pages back", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { level: 1, name: "Weekly report" })).toBeVisible();
  await expect(page.getByTestId("week-range")).toContainText("this week so far");
  await expect(page.getByTestId("boss-result")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  await page.getByRole("link", { name: "← Previous week" }).click();
  await expect(page.getByTestId("week-range")).not.toContainText("this week so far");
  await expect(page.getByRole("link", { name: "Next week →" })).toBeVisible();
});

test("offline: the service worker shows the offline page", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait until the worker controls this page (clients.claim on activate).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto("/honour").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "The castle is out of reach" })).toBeVisible();
  await context.setOffline(false);
});
