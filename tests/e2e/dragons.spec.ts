import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const NAMES = ["Emberclaw", "Verdantfang", "Aurumscale", "Runewing", "Inkwyrm", "Moonveil", "Jadeheart", "Ashsilver"];

test("the lair shows all eight area dragons with growth and mood", async ({ page }) => {
  await page.goto("/dragons");
  await expect(page.getByRole("heading", { level: 1, name: "Dragon Lair" })).toBeVisible();
  for (const name of NAMES) await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(8);
  await expect(page.getByRole("img", { name: /Emberclaw, the Fitness dragon/ })).toBeVisible();
});

test("logging a good Fitness deed feeds Emberclaw XP", async ({ page }, info) => {
  const name = `Squats ${info.project.name.slice(0, 6)} ${Date.now().toString(36)}`;
  await page.goto("/dragons");
  const card = page.getByTestId("dragon-fitness");
  const xpBefore = Number((await card.getByText(/^[\d,]+ XP$/).textContent())!.replace(/[^\d]/g, ""));

  await page.goto("/honour");
  const form = page.getByRole("form", { name: "Create action" });
  await form.getByLabel("Name").fill(name);
  await form.getByText("Good (adds Honour + XP)").click();
  await form.getByLabel("Points").fill("5");
  await form.getByLabel("Icon (emoji)").fill("🦵");
  await form.getByLabel("Category").fill("Fitness");
  await form.getByRole("button", { name: "Add action" }).click();
  await page.getByRole("button", { name: `Log ${name}: plus 5 Honour` }).click();
  await expect(page.getByTestId("today-list").getByText(name)).toBeVisible();

  await page.goto("/dragons");
  const xpAfter = Number((await card.getByText(/^[\d,]+ XP$/).textContent())!.replace(/[^\d]/g, ""));
  expect(xpAfter).toBeGreaterThanOrEqual(xpBefore + 5);
});

test("the gallery shows 80 sprites plus 4 moods", async ({ page }) => {
  await page.goto("/dragons/gallery");
  await expect(page.getByRole("img")).toHaveCount(84);
});

for (const path of ["/dragons", "/dragons/gallery"]) {
  test(`${path} has no WCAG A/AA violations and no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
