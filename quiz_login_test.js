import { browser } from 'k6/browser';
import { sleep } from 'k6';

const vmName = __ENV.K6_VM_NAME || 'unknown_vm';
const TOTAL_QUESTIONS = 2;

export const options = {
  scenarios: {
    quizUsers: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '6m',
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

    let lastQuestion = null;

    for (let q = 0; q < TOTAL_QUESTIONS; q++) {
      // wait for a NEW question
      const currentQuestion = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(
          (s) => s.textContent && s.textContent.includes('Question')
        );
        return span ? span.textContent : null;
      });

      lastQuestion = currentQuestion;

      // ensure options are interactable for this question
      await options.first().waitFor({
        state: 'visible',
        timeout: 90000,
      });

      // small settle delay (critical under load)
      await page.waitForTimeout(500);

      // random answer
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

    // keep users connected after last question
    await page.waitForTimeout(6 * 60 * 1000);

  } finally {
    await page.close();
    await context.close();
  }
}
