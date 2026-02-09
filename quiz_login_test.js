import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';
const TOTAL_QUESTIONS = 20;

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 10,               
      iterations: 1,
      maxDuration: '10m',
      options: {
        browser: {
          type: 'chromium',
          launchOptions: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-software-rasterizer',
              '--disable-extensions',
              '--disable-background-networking',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-features=TranslateUI,site-per-process',
              '--disable-default-apps',
              '--disable-sync',
              '--metrics-recording-only',
              '--mute-audio',
              '--no-first-run',
              '--disable-breakpad',
              '--disable-component-update',
              '--disable-notifications',
              '--disable-logging',
              '--disable-permissions-api',
              '--disable-accelerated-2d-canvas',
              '--js-flags=--max-old-space-size=512', // safe heap cap
            ],
          },
        },
      },
    },
  },
};

export default async function () {
  // Stagger joins to avoid bursts
  sleep(Math.random() * 5);

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[${vmName}_${__VU}] joining quiz`);

    // ------------------------------------------------
    // JOIN QUIZ
    // ------------------------------------------------
    await page.goto(
      'https://alientux.com/join/544350',
      { waitUntil: 'networkidle', timeout: 60000 }
    );

    await page.fill('#name', `user_${vmName}_${__VU}`);
    await page.fill('#email', `${vmName}_${__VU}@gmail.com`);
    await page.click('//button[text()="Join Quiz"]');

    // ------------------------------------------------
    // WAIT FOR FIRST QUESTION
    // ------------------------------------------------
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('span')).some(
          (s) => s.textContent && s.textContent.includes('Question')
        ),
      { timeout: 120000 }
    );

    // ------------------------------------------------
    // MAIN QUESTION LOOP
    // ------------------------------------------------
    for (let q = 0; q < TOTAL_QUESTIONS; q++) {
      const currentQuestionText = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(
          (s) => s.textContent && s.textContent.includes('Question')
        );
        return span ? span.textContent : null;
      });

      await page.waitForTimeout(500);

      const mcqOptions = page.locator('//div/button');
      let answered = false;

      // -------- Fill-in-the-blank --------
      try {
        await page.waitForFunction(() => {
          const input = document.querySelector(
            "input[placeholder='Type your answer...']"
          );
          return input && !input.disabled && input.offsetParent !== null;
        }, { timeout: 5000 });

        await page.click("//input[@placeholder='Type your answer...']");
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(`user_${vmName}_${__VU}`, { delay: 60 });
        await page.keyboard.press('Enter');

        await page.waitForFunction(() => {
          const btn = document.querySelector('button');
          return btn && !btn.disabled;
        }, { timeout: 5000 });

        await page.click('//button');
        answered = true;
      } catch (_) {
        // not a text question
      }

      // -------- MCQ fallback --------
      if (!answered) {
        await page.waitForFunction(() => {
          const buttons = Array.from(document.querySelectorAll('div button'));
          return buttons.some(
            (btn) => !btn.disabled && btn.offsetParent !== null
          );
        }, { timeout: 120000 });

        const optionCount = await mcqOptions.count();
        const enabled = [];

        for (let i = 0; i < optionCount; i++) {
          const disabled = await mcqOptions.nth(i).evaluate(
            (el) => el.disabled
          );
          if (!disabled) enabled.push(i);
        }

        const idx = enabled[Math.floor(Math.random() * enabled.length)];
        await mcqOptions.nth(idx).click();
      }

      await page.waitForTimeout(1000);

      // -------- Wait for next question --------
      if (q < TOTAL_QUESTIONS - 1) {
        await page.waitForFunction(
          (prev) => {
            const span = Array.from(document.querySelectorAll('span')).find(
              (s) => s.textContent && s.textContent.includes('Question')
            );
            return span && span.textContent !== prev;
          },
          currentQuestionText,
          { timeout: 120000 }
        );
      }
    }

    // ------------------------------------------------
    // KEEP USER CONNECTED (WEBSOCKET STAYS ALIVE)
    // ------------------------------------------------
    await page.waitForTimeout(10 * 60 * 1000);

    console.log(`[${vmName}_${__VU}] quiz completed`);

  } finally {
    await page.close();
    await context.close();
  }
}
