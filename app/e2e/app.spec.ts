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

test("the team screen is not reachable signed out", async ({ page }) => {
  await page.goto("/settings/team");
  await expect(page).toHaveURL(/\/login/);
});

test("an invitation link is public and survives a dead token", async ({ page }) => {
  // Public on purpose: the recipient usually has no account yet. A dead token
  // must explain itself rather than 500, because this is the first thing a new
  // teammate ever sees of Fludd.
  const res = await page.goto("/invite/not-a-real-token");
  expect(res?.status()).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/login/);
});
