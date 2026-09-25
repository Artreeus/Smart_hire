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

test('public pages render live marketplace data without runtime errors', async ({ page }, testInfo) => {
  const errors = monitorRuntimeErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const overviewResponse = await page.request.get('/api/public/overview');
  expect(overviewResponse.ok()).toBeTruthy();
  const overview = await overviewResponse.json();
  expect(overview.stats.activeJobs).toBeGreaterThanOrEqual(12);
  expect(overview.stats.companies).toBeGreaterThanOrEqual(6);
  expect(overview.latestJobs.length).toBeGreaterThan(0);
  await assertRoutes(page, [
    ['/', 'Find the right job. Smarter.'],
    ['/jobs', 'Find work that fits you.'],
    ['/login', 'Log in to SmartHire'],
    ['/signup', 'Create your account'],
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Meet teams hiring on SmartHire' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('public-home-1920.png'), fullPage: true });
  const liveJob = overview.latestJobs[0];
  await page.goto(`/jobs/${liveJob._id}`);
  await expect(page.getByRole('heading', { name: liveJob.title, exact: true })).toBeVisible();
  await expect(page.getByText('Safety checked')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find the right job. Smarter.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opportunity should feel clear, not overwhelming.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Create account' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: 'Find work that fits you.' })).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /live opportunities/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('public-jobs-mobile.png'), fullPage: true });
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
