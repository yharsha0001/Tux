import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 20,            // keep low
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

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://alientux.com/join/431914', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `debug_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    console.log(`JOINED ${vmName}_${__VU}`);

    // -----------------------------------
    // HEARTBEAT CHECK (EVERY 5 SECONDS)
    // -----------------------------------

    for (let i = 0; i < 120; i++) { // 10 minutes
      try {
        // Simple DOM read – if page is alive, this works
        await page.evaluate(() => document.title);
        console.log(`HEARTBEAT OK ${vmName}_${__VU}`);
      } catch (err) {
        console.error(`HEARTBEAT FAILED ${vmName}_${__VU}`, err);
        break;
      }

      await sleep(5);
    }
  } finally {
    await page.close();
    await context.close();
  }
}
