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
            args: [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-background-networking',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-features=TranslateUI',
              '--disable-features=site-per-process',
            ],
          },
        },
      },
    },
  },
};

export default async function () {
  // Slight stagger to avoid bursts
  sleep(Math.random() * 2);

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ------------------------------------------------
    // JOIN QUIZ
    // ------------------------------------------------
    await page.goto('https://staging.d3hp8qpuooif92.amplifyapp.com/join/138284', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `user_${vmName}_${__VU}`);
    await page.fill('#email', `${vmName}@gmail.com`);
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
      // Capture current question text
      const currentQuestionText = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(
          (s) => s.textContent && s.textContent.includes('Question')
        );
        return span ? span.textContent : null;
      });

      // Small settle delay for SPA re-renders
      await page.waitForTimeout(300);

      const mcqOptions = page.locator('//div/button');
      let answered = false;

      // ------------------------------------------------
      // FILL-IN-THE-BLANK (REAL USER INPUT + STATE COMMIT)
      // ------------------------------------------------
      try {
        // Wait until input is truly usable
        await page.waitForFunction(() => {
          const input = document.querySelector(
            "input[placeholder='Type your answer...']"
          );
          return (
            input &&
            !input.disabled &&
            !input.readOnly &&
            input.offsetParent !== null
          );
        }, { timeout: 5000 });

        const answerText = `user_${vmName}_${__VU}`;

        // Focus input
        await page.click("//input[@placeholder='Type your answer...']");

        // Clear existing value (important for reused component)
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');

        // Type like a real human
        await page.keyboard.type(answerText, { delay: 60 });

        // 🔑 CRITICAL STEP: commit React state
        await page.keyboard.press('Enter');

        // Wait until submit becomes enabled
        await page.waitForFunction(() => {
          const btn = document.querySelector('button');
          return btn && !btn.disabled;
        }, { timeout: 5000 });

        // Submit
        await page.click('//button');

        answered = true;
      } catch (_) {
        // Not a fill-in-the-blank question
      }

      // ------------------------------------------------
      // MCQ FALLBACK (WAIT UNTIL OPTIONS ARE ENABLED)
      // ------------------------------------------------
      if (!answered) {
        await page.waitForFunction(() => {
          const buttons = Array.from(document.querySelectorAll('div button'));
          return buttons.some(
            (btn) => !btn.disabled && btn.offsetParent !== null
          );
        }, { timeout: 90000 });

        const optionCount = await mcqOptions.count();
        const enabledIndexes = [];

        for (let i = 0; i < optionCount; i++) {
          const isDisabled = await mcqOptions.nth(i).evaluate(
            (el) => el.disabled
          );
          if (!isDisabled) {
            enabledIndexes.push(i);
          }
        }

        if (enabledIndexes.length === 0) {
          throw new Error('No enabled MCQ options found');
        }

        const answerIndex =
          enabledIndexes[Math.floor(Math.random() * enabledIndexes.length)];

        await mcqOptions.nth(answerIndex).click();
      }

      // Let submission register
      await page.waitForTimeout(800);

      // ------------------------------------------------
      // WAIT FOR NEXT QUESTION
      // ------------------------------------------------
      await page.waitForFunction(
        (prevText) => {
          const span = Array.from(document.querySelectorAll('span')).find(
            (s) => s.textContent && s.textContent.includes('Question')
          );
          return span && span.textContent !== prevText;
        },
        currentQuestionText,
        { timeout: 90000 }
      );
    }

    // ------------------------------------------------
    // KEEP USERS CONNECTED AFTER LAST QUESTION
    // ------------------------------------------------
    await page.waitForTimeout(10 * 60 * 1000);

  } finally {
    await page.close();
    await context.close();
  }
}
