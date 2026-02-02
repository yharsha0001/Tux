import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 20,            // keep low for debugging
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
  sleep(Math.random() * 2);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // -------------------------------
  // ✅ SAFE DEBUG LISTENERS
  // -------------------------------

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
    await page.goto('https://alientux.com/join/431914', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `debug_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    console.log(`User ${vmName}_${__VU} joined quiz successfully`);

    // Keep session alive
    const totalSeconds = 10 * 60;
    const intervalSeconds = 5;

    for (let elapsed = 0; elapsed < totalSeconds; elapsed += intervalSeconds) {
      await page.mouse.move(
        200 + Math.random() * 400,
        200 + Math.random() * 300
      );
      await sleep(intervalSeconds);
    }
  } finally {
    await page.close();
    await context.close();
  }
}
