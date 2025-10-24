import { test, expect } from "@playwright/test";

test("home page shows title", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Team Crossword" })
  ).toBeVisible();
});

