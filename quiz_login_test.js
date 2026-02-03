import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';
const TOTAL_QUESTIONS = 5;

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 40,
      iterations: 1,
      maxDuration: '6m',
      options: {
        browser: {
          type: 'chromium',
          launchOptions: {
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
          },
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
    // Join quiz
    await page.goto('https://alientux.com/join/785030', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `user_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    const options = page.locator('//div/button');

    // wait for first question
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('span')).some(
          (s) => s.textContent && s.textContent.includes('Question')
        ),
      { timeout: 90000 }
    );

    for (let q = 0; q < TOTAL_QUESTIONS; q++) {
      // wait until a question is active
      const currentQuestion = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(
          (s) => s.textContent && s.textContent.includes('Question')
        );
        return span ? span.textContent : null;
      });

      // select random answer (0–3)
      const answerIndex = Math.floor(Math.random() * 4);
      await options.nth(answerIndex).click({ timeout: 90000 });

      // wait until admin presents next question
      await page.waitForFunction(
        (prevText) => {
          const span = Array.from(document.querySelectorAll('span')).find(
            (s) => s.textContent && s.textContent.includes('Question')
          );
          return span && span.textContent !== prevText;
        },
        currentQuestion,
        { timeout: 90000 }
      );
    }
    await page.waitForTimeout(2 * 60 * 1000);
  } finally {
    await page.close();
    await context.close();
  }
}
