import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("body page: water, workout PB, run, sleep, weight", async ({ page }) => {
  await page.goto("/body");
  await expect(page.getByRole("heading", { level: 1, name: "Body" })).toBeVisible();

  const water = page.getByTestId("water-count");
  const before = Number((await water.textContent())?.split(" ")[0]);
  await page.getByRole("button", { name: "+ Glass 💧" }).click();
  // Other browser projects share this database, so only check the count went up.
  await expect.poll(async () => Number((await water.textContent())?.split(" ")[0])).toBeGreaterThanOrEqual(Math.min(30, before + 1));

  const lift = `Lift ${Date.now() % 100000}`;
  const wo = page.getByRole("form", { name: "Log exercise" });
  await wo.getByLabel("Exercise").fill(lift);
  await wo.getByLabel("Weight (kg)").fill("42.5");
  await wo.getByRole("button", { name: "Log exercise" }).click();
  await expect(page.getByRole("status")).toContainText("Workout logged");
  await expect(page.getByTestId("lift-pbs")).toContainText(`${lift}`);
  await expect(page.getByTestId("lift-pbs")).toContainText("42.5 kg × 10");

  const run = page.getByRole("form", { name: "Log run" });
  await run.getByLabel("Distance (km)").fill("5");
  await run.getByLabel("Time (mm:ss)").fill("25:00");
  await run.getByRole("button", { name: "Log run" }).click();
  await expect(page.getByRole("status")).toContainText("Run logged");
  await expect(page.getByTestId("recent-runs")).toContainText("5.00 km in 25:00");

  await page.getByRole("form", { name: "Log sleep" }).getByRole("button", { name: "Save night" }).click();
  await expect(page.getByRole("status")).toContainText("Sleep saved");
  await expect(page.getByTestId("sleep-avg")).toContainText("7-day average");

  const wt = page.getByRole("form", { name: "Log weight" });
  await wt.getByLabel("Weight (kg)").fill("80.4");
  await wt.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByRole("status")).toHaveText("Weight saved.");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("body page rejects a bad run time", async ({ page }) => {
  await page.goto("/body");
  const run = page.getByRole("form", { name: "Log run" });
  await run.getByLabel("Distance (km)").fill("5");
  await run.getByLabel("Time (mm:ss)").fill("soon");
  await run.getByRole("button", { name: "Log run" }).click();
  await expect(page.getByRole("status")).toContainText("Enter time like");
});
