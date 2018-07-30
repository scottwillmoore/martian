const fs = require('fs');
const moment = require('moment');
const puppeteer = require('puppeteer');
const winston = require('winston');
const { username, password } = require('./secret.json');

//
const timestamp = () => moment().format('YYMMDD-HHmmss_SSSS');

// Create a directory for the log files.
const startTimestamp = timestamp();
const logPath = `./logs/${startTimestamp}`;
const logFile = `${logPath}/app.log`;
fs.mkdirSync(logPath);

// Create a winston logger to output to console and file.
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
            )
        }),
        new winston.transports.File({ filename: logFile })
    ]
});

// Create short-hand functions for logging messages.
const debug = message => logger.debug(message);
const error = message => logger.error(message);
const info = message => logger.info(message);
const warn = message => logger.warn(message);

// Create short-hand function for logging screenshots.
const screenshot = async (page, message) => {
    const screenshotTimestamp = timestamp();
    await page.screenshot({ path: `${logPath}/${screenshotTimestamp}-${message}.png` });
}

// Create a simple sleep functon.
const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

// Define array of various question handlers.
const questionHandlers = [
    { type: 'free-text-response', selector: '[ng-controller="FreeTextResponsePollViewController as vm"]', handler: null },
    {
        type: 'multiple-choice',
        selector: '[ng-controller="MultipleChoicePollViewController as vm"]',
        handler: (page) => {
            // TODO: Detect if choice has already been made.
            const choices = await page.$$('.mc-choice');
            info('choices found: ' + choices);

            // TODO: Choose a random choice.
            const choice = choices[0];

            await choice.click();
        }
    },
    { type: 'question-and-answer', selector: '[ng-controller="QAndAPollViewController as vm"]', handler: null },
    { type: 'word-cloud', selector: '[ng-controller="WordCloudPollViewController as vm"]', handler: null },
]

// Attempt to navigate and login to the mars application.
async function login(page, username, password) {
    info('navigate to: http://mars.mu/');
    try {
        await page.goto('http://mars.mu/');
        await page.waitFor('.primary-auth-form');
    } catch (e) {
        error(e);
        throw 'could not navigate to login form.';
    }

    info('attempt to login as: ' + username);
    try {
        await screenshot(page, 'pre-login');
        await page.type('#okta-signin-username', username);
        await page.type('#okta-signin-password', password);

        await screenshot(page, 'post-login');
        await page.click('#okta-signin-submit');
    } catch (e) {
        error(e);
        throw 'could not sign-in to login form.';
    }
}

// Wait for a question to appear and then resolve the correct handler to answer the question.
async function handleQuestion(page, questionHandlers) {
    const types = questionHandlers.map(question => question.type).join(', ');
    const selectors = questionHandlers.map(question => question.selector).join(', ');

    // Wait until any of the possible selector triggers are fired.
    info('search for questions: ' + types);
    try {
        await page.waitFor(selectors);
    } catch (error) {
        info('no questions found.');
        return;
    }

    // Find the question handler which fired the trigger.
    for (const question of questionHandlers) {
        const exists = await page.$(question.selector) !== null;
        if (exists) {
            // Execute the corrosponding handler for the question.
            info('found question: ' + question.type);
            await screenshot(page, 'question-' + question.type);
            if (question.handler) {
                await question.handler(page);
            } else {
                warn('no handler implemeted: ' + question.type);
            }
        }
    }
}

(async () => {
    const browserOptions = {
        headless: false,
        slowMo: 25,
    };

    info('create browser with options: ' + JSON.stringify(browserOptions));
    const browser = await puppeteer.launch(browserOptions);
    const page = await browser.newPage();

    await login(page, username, password);

    // TODO: Make this loop finite in order to prevent the session expiring.
    while (true) {
        await handleQuestion(page, questionHandlers);
        await sleep(15);
    }

    await browser.close();
})();
