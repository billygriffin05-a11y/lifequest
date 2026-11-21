import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("widgets page gives a script for this address; feed is JSON", async ({ page, request }) => {
  await page.goto("/widgets");
  await expect(page.getByRole("heading", { level: 1, name: "Widgets" })).toBeVisible();
  await expect(page.getByLabel("Widget script")).toHaveValue(/const FEED = "http:\/\/127\.0\.0\.1:3100\/api\/widget";/);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  const res = await request.get("/api/widget");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ rank: { level: expect.any(Number) }, quests: expect.any(Object), events: expect.any(Array) });
});
