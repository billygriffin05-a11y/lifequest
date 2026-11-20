import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

test("mind page: check-in, book, and accessibility", async ({ page }) => {
  await page.goto("/mind");
  await expect(page.getByRole("heading", { level: 1, name: "Mind" })).toBeVisible();

  const checkIn = page.getByRole("form", { name: "Mood and journal" });
  await checkIn.getByText("Good", { exact: true }).click();
  await checkIn.getByLabel(/Journal/).fill("Testing the journal.");
  await checkIn.getByRole("button", { name: "Save today" }).click();
  await expect(page.getByTestId("banner")).toContainText("Saved for today");
  await expect(page.getByTestId("mood-strip")).toContainText("Good");

  const title = `Book ${Date.now() % 100000}`;
  const add = page.getByRole("form", { name: "Add a book" });
  await add.getByLabel("Title").fill(title);
  await add.getByLabel("Total pages").fill("50");
  await add.getByRole("button", { name: "Add book" }).click();
  await expect(page.getByTestId(`book-${title}`)).toContainText("0 / 50 pages");
  await page.getByLabel(`Pages read in ${title}`).fill("50");
  await page.getByTestId(`book-${title}`).getByRole("button", { name: "Log pages" }).click();
  await expect(page.getByTestId("banner")).toContainText("Book finished");
  await expect(page.getByTestId("finished-books")).toContainText(title);

  expect((await axe(page)).violations).toEqual([]);
});

test("focus timer logs a session when it ends", async ({ page }) => {
  await page.clock.install();
  await page.goto("/mind");
  await page.getByText("15 min", { exact: true }).click();
  await expect(page.getByTestId("focus-clock")).toHaveText("15:00");
  await page.getByRole("button", { name: "Start focus" }).click();
  await page.clock.fastForward(15 * 60_000 + 1000);
  await expect(page.getByTestId("focus-message")).toContainText("15 minutes of focus logged");
});

test("security+ cards: seed, reveal, review", async ({ page }) => {
  await page.goto("/mind/cards");
  await expect(page.getByRole("heading", { level: 1, name: "Security+ cards" })).toBeVisible();
  const seed = page.getByRole("button", { name: "Add Security+ starter deck" });
  // The page streams in: wait for one of its states before deciding.
  await expect(seed.or(page.getByTestId("card-under-review")).or(page.getByTestId("all-done"))).toBeVisible();
  if (await seed.count()) {
    await seed.click();
    await expect(page.getByTestId("banner")).toContainText("Security+ cards");
  }
  const card = page.getByTestId("card-under-review");
  await expect(card.or(page.getByTestId("all-done"))).toBeVisible();
  if (await card.count()) {
    const question = await card.locator("p").nth(1).textContent();
    await card.getByText("Show answer").click();
    await expect(page.getByTestId("card-answer")).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
    await card.getByRole("button", { name: "✓ Got it" }).click();
    await expect(page.getByTestId("card-under-review").or(page.getByTestId("all-done"))).toBeVisible();
    await expect(page.getByTestId("card-under-review").locator("p").nth(1)).not.toHaveText(question ?? "");
  } else {
    await expect(page.getByTestId("all-done")).toBeVisible();
  }
});
