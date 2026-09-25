import { expect, test } from '@playwright/test';

function monitorRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function login(page, identity, password) {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(identity);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function assertRoutes(page, routes, navigateInApp = false) {
  for (const [path, heading] of routes) {
    if (navigateInApp) {
      await page.locator(`.sidebar a[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    } else {
      await page.goto(path);
    }
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.loading-state')).toHaveCount(0);
  }
}

test('public pages render without runtime errors', async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  await assertRoutes(page, [
    ['/', 'Find the right job. Smarter.'],
    ['/jobs', 'Find work that fits you.'],
    ['/login', 'Log in to SmartHire'],
    ['/signup', 'Create your account'],
  ]);
  expect(errors).toEqual([]);
});

test('admin can navigate every workspace without a white screen', async ({ page }, testInfo) => {
  const errors = monitorRuntimeErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page, 'admin', 'admin');
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-dashboard-1920.png'), fullPage: true });
  await assertRoutes(page, [
    ['/admin/users', 'Users'],
    ['/admin/companies', 'Companies'],
    ['/admin/jobs', 'Jobs'],
    ['/admin/reports', 'Reported jobs'],
    ['/admin/verification', 'Company verification'],
    ['/notifications', 'Notifications'],
    ['/profile', 'Account settings'],
    ['/admin', 'Admin dashboard'],
  ], true);
  expect(errors).toEqual([]);
});

test('company can navigate every workspace without a white screen', async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  await login(page, 'recruiter@technova.demo', 'Demo12345');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await assertRoutes(page, [
    ['/post-job', 'Post a new job'],
    ['/company/jobs', 'My jobs'],
    ['/applicants', 'Applicants'],
    ['/verification', 'Company verification'],
    ['/company/profile', 'Company profile'],
    ['/notifications', 'Notifications'],
    ['/profile', 'Account settings'],
    ['/company', /Welcome back/],
  ], true);
  expect(errors).toEqual([]);
});

test('job seeker can navigate every workspace without a white screen', async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  const email = 'browser-smoke@smarthire.test';
  let response = await page.request.post('/api/auth/signup', {
    data: {
      role: 'seeker',
      name: 'Browser Smoke',
      email,
      password: 'BrowserSmoke123!',
      location: 'Dhaka',
    },
  });
  if (response.status() === 409) {
    response = await page.request.post('/api/auth/login', {
      data: { email, password: 'BrowserSmoke123!' },
    });
  }
  expect(response.ok()).toBeTruthy();
  const { token } = await response.json();
  await page.addInitScript(value => localStorage.setItem('smarthire-token', value), token);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  await assertRoutes(page, [
    ['/recommended', 'Recommended jobs'],
    ['/saved', 'Saved jobs'],
    ['/applications', 'Your applications'],
    ['/cv-analysis', 'CV analysis'],
    ['/notifications', 'Notifications'],
    ['/profile', 'Account settings'],
    ['/dashboard', /Good morning/],
  ], true);
  expect(errors).toEqual([]);
});
