import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';
const TOTAL_QUESTIONS = 2;

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
    await page.goto('https://alientux.com/join/944500', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.fill('#name', `user_${vmName}_${__VU}`);
    await page.click('//button[text()="Join Quiz"]');

    const options = page.locator('//div/button');

    // wait until first question appears
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll('span'))
          .some(s => s.textContent && s.textContent.includes('Question'));
      },
      { timeout: 90000 }
    );

    for (let q = 0; q < TOTAL_QUESTIONS; q++) {
      // read current question number text
      const currentQuestion = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span'))
          .find(s => s.textContent && s.textContent.includes('Question'));
        return span ? span.textContent : null;
      });

      // click answer
      const answerIndex = q % 4;
      await options.nth(answerIndex).click();

      // wait until question number changes
      await page.waitForFunction(
        (prevText) => {
          const span = Array.from(document.querySelectorAll('span'))
            .find(s => s.textContent && s.textContent.includes('Question'));
          return span && span.textContent !== prevText;
        },
        currentQuestion,
        { timeout: 90000 }
      );
    }
    await page.waitForTimeout(6 * 60 * 1000);

  } finally {
    await page.close();
    await context.close();
  }
}
