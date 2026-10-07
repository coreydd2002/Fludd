import { expect, test } from "@playwright/test";

const SECTIONS = [
  "Language selection",
  "IDE selection and setup",
  "Development strategy",
  "Git strategy and controls",
  "Issue tracking",
  "AI agents and controls",
  "Code quality",
  "Testing frameworks",
  "Other controls, tools and procedures",
];

test("landing page loads with its primary call to action", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Fludd/);
  await expect(page.locator("#early-access")).toBeVisible();
});

test("footer links to the team playbook, which covers all nine areas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Team playbook" }).click();
  await expect(page).toHaveURL(/\/playbook$/);
  for (const name of SECTIONS) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
});
