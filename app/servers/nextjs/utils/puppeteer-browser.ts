import puppeteer, { type Browser, type Viewport } from "puppeteer";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=TranslateUI",
  "--disable-ipc-flooding-protection",
];

const DEFAULT_VIEWPORT: Viewport = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
};

const globalForPuppeteer = globalThis as typeof globalThis & {
  __presentonPuppeteerBrowser?: Browser;
  __presentonPuppeteerBrowserPromise?: Promise<Browser>;
};

async function getPuppeteerBrowser(): Promise<Browser> {
  const cachedBrowser = globalForPuppeteer.__presentonPuppeteerBrowser;
  if (cachedBrowser?.connected) {
    return cachedBrowser;
  }

  if (globalForPuppeteer.__presentonPuppeteerBrowserPromise) {
    return globalForPuppeteer.__presentonPuppeteerBrowserPromise;
  }

  const launchPromise = puppeteer
    .launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: PUPPETEER_ARGS,
    })
    .then((browser) => {
      globalForPuppeteer.__presentonPuppeteerBrowser = browser;
      browser.on("disconnected", () => {
        if (globalForPuppeteer.__presentonPuppeteerBrowser === browser) {
          globalForPuppeteer.__presentonPuppeteerBrowser = undefined;
        }
      });
      return browser;
    })
    .finally(() => {
      if (globalForPuppeteer.__presentonPuppeteerBrowserPromise === launchPromise) {
        globalForPuppeteer.__presentonPuppeteerBrowserPromise = undefined;
      }
    });

  globalForPuppeteer.__presentonPuppeteerBrowserPromise = launchPromise;
  return launchPromise;
}

export async function createExportPage(cookieHeader?: string | null) {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();

  await page.setViewport(DEFAULT_VIEWPORT);
  page.setDefaultNavigationTimeout(300000);
  page.setDefaultTimeout(300000);

  if (cookieHeader) {
    await page.setExtraHTTPHeaders({ cookie: cookieHeader });
  }

  return page;
}
