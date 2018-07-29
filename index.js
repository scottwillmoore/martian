const puppeteer = require('puppeteer');
const { username, password } = require('./secret.json');

const browserOptions = {
    headless: false,
    slowMo: 100,
};

const questions = [
    { type: 'freeTextResponse', selector: '[ng-controller="FreeTextResponsePollViewController as vm"]', handler: handleFreeTextResponse },
    { type: 'multipleChoice', selector: '[ng-controller="MultipleChoicePollViewController as vm"]', handler: handleMultipleChoice },
    { type: 'questionAndAnswer', selector: '[ng-controller="QAndAPollViewController as vm"]', handler: handleQuestionAndAnswer },
    { type: 'wordCloud', selector: '[ng-controller="WordCloudPollViewController as vm"]', handler: handleWordCloud },
]

// TODO: Create a better name for this function.
async function screenshot(page, info) {
    // TODO: Construct a proper timestamp.
    const timestamp = '180801-21250001';
    const filename = timestamp + info;
    await page.screenshot({ path: './screenshots/' + filename });
}

async function login(page, username, password) {
    console.log('navigate to: http://mars.mu/');
    await page.goto('http://mars.mu/');
    await page.waitFor('.primary-auth-form');

    console.log('attempt to login as: ' + username);
    await page.type('#okta-signin-username', username);
    await page.type('#okta-signin-password', password);
    await page.click('#okta-signin-submit');
}

async function handleQuestion(page, questions) {
    const types = questions.map(question => question.type).join(', ');
    const selectors = questions.map(question => question.selector).join(', ');

    console.log('search for questions: ' + types);
    await page.waitFor(selectors).catch(error => console.log('no questions found.'));

    for (const question of questions) {
        const exists = await page.$(question.selector) !== null;
        if (exists) {
            console.log('found question: ' + question.type);
            await screenshot(page, question.type);

            await question.handler(page);
        }
    }
}

async function handleFreeTextResponse(page) {}

async function handleMultipleChoice(page) {
    const choices = await page.$$('.mc-choice');
    console.log(choices);

    // TODO: Choose a random choice.
    const choice = choices[0];

    await choice.click();
}

async function handleQuestionAndAnswer(page) {}
async function handleWordCloud(page) {}

(async () => {
    const browser = await puppeteer.launch(browserOptions);
    const page = await browser.newPage();

    await login(page, username, password);
    await handleQuestion(page, questions);

    // while (true) ... handleQuestion, sleep

    await browser.close();
})();
