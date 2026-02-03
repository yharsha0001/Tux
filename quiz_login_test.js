import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 20,              // keep low while debugging
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

  try {
    // Join quiz
    await page.goto('https://alientux.com/join/837352', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `debug_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    console.log(`JOINED ${vmName}_${__VU}`);

    // ----------------------------------
    // HEARTBEAT LOOP (10 minutes total)
    // ----------------------------------
    for (let i = 0; i < 120; i++) {
      try {
        // If this fails → Chromium renderer crashed
        await page.evaluate(() => document.title);
        console.log(`HEARTBEAT OK ${vmName}_${__VU}`);
      } catch (err) {
        console.error(`HEARTBEAT FAILED ${vmName}_${__VU}: Target crashed`);
        break;
      }

      await sleep(5);
    }
  } finally {
    // Clean shutdown
    try { await page.close(); } catch (_) {}
    try { await context.close(); } catch (_) {}
  }
}
