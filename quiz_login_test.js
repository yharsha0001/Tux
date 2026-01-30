import { browser } from 'k6/browser';

// Read VM name from environment variable
const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 80,              // change to 300 later
      iterations: 1,       // each user runs only once
      maxDuration: '10m',  // safety timeout
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
};

export default async function () {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Open quiz join page
  await page.goto('https://alientux.com/join/126551');

  // Enter username (VM name + VU)
  await page.fill('#name', `user_${vmName}_${__VU}`);

  // Click Join Quiz
  await page.click('//button[text()="Join Quiz"]');

  console.log(`User ${vmName}_${__VU} joined quiz successfully`);

  // Stay inside quiz for 5 minutes (adjust if needed)
  await page.waitForTimeout(10 * 60 * 1000);

  await context.close();
}
