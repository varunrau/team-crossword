import { test, expect } from "@playwright/test";

test("playwright runner and browser work", async ({ page }) => {
  await page.goto("about:blank");
  await expect(page).toBeDefined();
});

