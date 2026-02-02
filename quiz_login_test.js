import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 20,             // keep LOW for debugging
      iterations: 1,
      maxDuration: '15m',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
};

export default async function () {
  // Stagger startup to avoid Chromium race
  sleep(Math.random() * 2);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // -------------------------------
  // 🔴 CRITICAL DEBUG LISTENERS
  // -------------------------------

  page.on('close', () => {
    console.error(`PAGE CLOSED for ${vmName}_${__VU}`);
  });

  page.on('framenavigated', frame => {
    console.error(`NAVIGATION detected for ${vmName}_${__VU}: ${frame.url()}`);
  });

  page.on('requestfailed', request => {
    console.error(
      `REQUEST FAILED for ${vmName}_${__VU}: ${request.url()} - ${request.failure()?.errorText}`
    );
  });

  page.on('console', msg => {
    console.log(`[BROWSER ${vmName}_${__VU}] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[PAGE ERROR ${vmName}_${__VU}]`, err);
  });

  try {
    // Open quiz join page
    await page.goto('https://alientux.com/join/052374', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Join quiz
    await page.fill('#name', `debug_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    console.log(`User ${vmName}_${__VU} joined quiz successfully`);

    // -----------------------------------
    // KEEP SESSION ALIVE (10 MINUTES)
    // -----------------------------------

    const totalSeconds = 10 * 60;
    const intervalSeconds = 5;

    for (let elapsed = 0; elapsed < totalSeconds; elapsed += intervalSeconds) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 300;

      await page.mouse.move(x, y);
      await sleep(intervalSeconds);
    }

    console.log(`User ${vmName}_${__VU} finished session`);
  } finally {
    await page.close();
    await context.close();
  }
}
