import { browser } from 'k6/browser';
import { sleep } from 'k6';

// Read VM name from environment variable
const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 20,              // adjust per VM (40 recommended for stability)
      iterations: 1,       // each VU runs once
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
  // ✅ FIX 1: stagger browser startup (CRITICAL)
  sleep(Math.random() * 2); // 0–2 seconds random delay

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Open quiz join page
    await page.goto('https://alientux.com/join/052374', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Enter username (VM name + VU)
    await page.fill('#name', `user_${vmName}_${__VU}`);

    // Click Join Quiz
    await page.click('//button[text()="Join Quiz"]');

    console.log(`User ${vmName}_${__VU} joined quiz successfully`);
    // -----------------------------
    // ✅ SIMULATE REAL USER ACTIVITY
    // -----------------------------

    const sessionDurationSeconds = 10 * 60; // 10 minutes
    const activityIntervalSeconds = 5;      // move mouse every 5 seconds

    for (let elapsed = 0; elapsed < sessionDurationSeconds; elapsed += activityIntervalSeconds) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 300;

      await page.mouse.move(x, y);
      await sleep(activityIntervalSeconds);
    }

    console.log(`User ${vmName}_${__VU} session completed`);
  } finally {
    // Always close browser cleanly
    await page.close();
    await context.close();
  }
}
