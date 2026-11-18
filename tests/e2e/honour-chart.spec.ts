import { expect, test } from "@playwright/test";

test("good vs bad chart shows two lines, a legend, ranges and a data table", async ({ page }) => {
  await page.goto("/honour");
  const section = page.getByRole("region", { name: "Good vs bad" });
  await expect(section).toBeVisible();

  // Two series lines (a flat all-zero line has no height, so check the path, not visibility),
  // each with one point per day of the default 30-day range.
  for (const key of ["good", "bad"]) {
    const d = await section.getByTestId(`trend-line-${key}`).getAttribute("d");
    expect(d?.match(/[ML]/g)).toHaveLength(30);
  }
  // Legend (identity never by colour alone)
  const legend = section.getByRole("list", { name: "Legend" });
  await expect(legend.getByText("Good points")).toBeVisible();
  await expect(legend.getByText("Bad points")).toBeVisible();

  // Default range is 30 days → 30 table rows
  await expect(section.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
  await section.getByText("Show data table").click();
  await expect(section.getByRole("table").getByRole("row")).toHaveCount(31); // header + 30 days

  // Switching range updates the URL and the data
  await section.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7/);
  await expect(section.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
});

test("keyboard users can step through days and read the values", async ({ page }) => {
  await page.goto("/honour?range=7");
  const chart = page.getByRole("img", { name: /Line chart of good and bad points/ });
  await chart.focus();
  await page.keyboard.press("End");
  const tip = page.getByRole("status").filter({ hasText: "good" });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("bad");
});

test("an invalid range falls back to 30 days", async ({ page }) => {
  await page.goto("/honour?range=9999");
  await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
});
