import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the sign-in form", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("an unknown report link shows a not-found page, not a crash", async ({ page }) => {
  const res = await page.goto("/r/not-a-real-token");
  expect(res?.status()).toBeLessThan(500);
});
