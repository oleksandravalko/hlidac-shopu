import { Actor, log, LogLevel, Dataset } from "apify";
import { uploadToKeboola } from "@hlidac-shopu/actors-common/keboola.js";
import { withPersistedStats } from "@hlidac-shopu/actors-common/stats.js";
import { cleanPrice } from "@hlidac-shopu/actors-common/product.js";
import Rollbar from "@hlidac-shopu/actors-common/rollbar.js";
import { shopName } from "@hlidac-shopu/lib/shops.mjs";
import { PlaywrightCrawler } from "@crawlee/playwright";
import { parseXML, parseHTML } from "@hlidac-shopu/actors-common/dom.js";
import { getInput } from "@hlidac-shopu/actors-common/crawler.js";
import { ActorType } from "@hlidac-shopu/actors-common/actor-type.js";

/** @typedef {import("@crawlee/http").RequestOptions} RequestOptions */

/** @enum {string} */
const Country = {
  CZ: "CZ",
  SK: "SK"
};

/** @enum {string} */
const Currency = {
  CZ: "CZK",
  SK: "EUR"
};

/** @enum {string} */
const Labels = {
  MainSitemap: "MainSitemap",
  CollectionSitemap: "CollectionSitemap",
  List: "List"
};

/**
 * @param {Country} country
 */
function getBaseUrl(country) {
  switch (country) {
    case Country.CZ:
      return "https://www.okay.cz";
    case Country.SK:
      return "https://www.okay.sk";
    default:
      throw new Error(`Unknown country ${country}`);
  }
}

/**
 * @param {string} body
 */
function productsSitemapsUrls(body) {
  const { document } = parseXML(body);
  return document
    .getElementsByTagNameNS("", "sitemap")
    .flatMap(x => x.getElementsByTagNameNS("", "loc"))
    .map(x => x.textContent.trim())
    .filter(url => url.includes("collections"));
}

/**
 * @param {string} body
 */
function productUrlsFromSitemap(body) {
  const { document } = parseXML(body);
  return document
    .getElementsByTagNameNS("", "url")
    .flatMap(x => x.getElementsByTagNameNS("", "loc"))
    .map(x => x.textContent.trim())
    .filter(url => !url.includes("nejprodavanejsi"));
}

export async function getTextFromLocator(locator) {
  try {
    return await (await locator).textContent({ timeout: 1000 });
  } catch (e) {
    return;
  }
}

function extractProducts({ document, page, rootUrl, currency, url, type }) {
  const category = document
    .querySelectorAll(".breadcrumb li")
    .map(x => x.textContent.trim())
    .slice(1, -1)
    .join("/");

  return Promise.all(
    document
      .querySelectorAll(".collection-matrix > [data-id]")
      ?.map(async product => {
        const itemId = product.getAttribute("data-id");
        if (!itemId) {
          log.error("Missing itemId", { url });
          return;
        }

        const originalPrice = cleanPrice(
          await getTextFromLocator(
            type === ActorType.BlackFriday
              ? // For Black Friday we need original price even if it is hidden in the listing
                page.locator(`[data-id="${itemId}"] .was-price .money`)
              : // In normal mode we don't care about original prices and just compute real discount
                page.locator(`[data-id="${itemId}"] .was-price .money:visible`)
          )
        );
        const currentPrice = cleanPrice(
          product.querySelector(".money.final")?.innerText
        );
        console.assert(currentPrice, "Missing currentPrice", { url });

        return {
          itemId,
          itemUrl: `${rootUrl}${product
            .querySelector("a")
            .getAttribute("href")}`,
          img: product.querySelector("img[src]")?.getAttribute("src"),
          itemName: product
            .querySelector(".product-thumbnail__title")
            .textContent.trim(),
          originalPrice,
          currentPrice,
          discounted: Boolean(originalPrice),
          currency,
          category,
          inStock: Boolean(product.querySelector(".in_stock"))
        };
      }) ?? []
  );
}

function blackFridayUrl(country) {
  const collection =
    country === Country.CZ
      ? "to-nejlepsi-z-black-friday"
      : "to-najlepsie-z-black-friday";
  return [
    {
      url: `${getBaseUrl(country)}/collections/${collection}`,
      label: Labels.List
    }
  ];
}

function sitemapUrl(country) {
  return [
    {
      url: `${getBaseUrl(country)}/sitemap.xml`,
      userData: { label: Labels.MainSitemap }
    }
  ];
}

/**
 * @param {Country|string} country
 * @param {ActorType|string} type
 * @param {RequestOptions[]} urls
 * @return {RequestOptions[]}
 */
function startRequests(country, type, urls) {
  if (urls?.length) return urls;
  if (type === ActorType.BlackFriday) {
    return blackFridayUrl(country);
  }
  return sitemapUrl(country);
}

async function main() {
  const rollbar = Rollbar.init();

  const stats = await withPersistedStats(x => x, {
    urls: 0,
    items: 0,
    failed: 0
  });

  const {
    development,
    debug,
    proxyGroups,
    maxRequestRetries,
    country = Country.CZ,
    customTableName = null,
    type = ActorType.Full,
    urls
  } = await getInput();

  if (debug) {
    log.setLevel(LogLevel.DEBUG);
  }

  const rootUrl = getBaseUrl(country);
  const currency = Currency[country];

  const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: proxyGroups,
    useApifyProxy: !development
  });

  async function loadLazyImages({ page }) {
    await page.keyboard.down("End");

    await page.evaluate(() => {
      /* global window, document */
      if (!document.body) return;
      document.body.scrollIntoView(false);
      const height = document.body.scrollHeight;
      window.scrollTo(0, height);
    });

    await page.waitForLoadState("networkidle");
  }

  function navigationBehavior(timeoutSec) {
    return async (context, gotoOptions) => {
      log.info(`Navigation to ${context.request.url}`);
      gotoOptions.waitUntil = "networkidle";
      gotoOptions.timeout = 1000 * timeoutSec;
    };
  }

  const crawler = new PlaywrightCrawler({
    maxRequestRetries,
    useSessionPool: true,
    persistCookiesPerSession: true,
    proxyConfiguration,
    browserPoolOptions: {
      useFingerprints: true,
      fingerprintOptions: {
        fingerprintGeneratorOptions: { locales: ["cs-CZ", "sk-SK"] }
      }
    },
    preNavigationHooks: [navigationBehavior(60)],
    postNavigationHooks: [loadLazyImages],
    async requestHandler({ request, page, enqueueLinks, log, saveSnapshot }) {
      log.info(`Processing ${request.url}`);
      stats.inc("urls");
      const { label } = request.userData;
      const body = await page.content();

      switch (label) {
        case Labels.MainSitemap:
          {
            const urls = productsSitemapsUrls(body);
            log.info(`Found ${urls.length} collection sitemaps`);
            await enqueueLinks({
              urls,
              userData: { label: Labels.CollectionSitemap }
            });
          }
          break;
        case Labels.CollectionSitemap:
          {
            const urls = productUrlsFromSitemap(body);
            log.info(`Found ${urls.length} collection urls`);
            await enqueueLinks({
              urls,
              userData: { label: Labels.List }
            });
          }
          break;
        case Labels.List:
          {
            await saveSnapshot({
              key: new URL(request.url).pathname
                .split("/")
                .filter(Boolean)
                .at(-1)
                ?.replace(/[^a-zA-Z0-9!\-_\.\'\(\)]/g, "!")
            });
            const { document } = parseHTML(body.toString());
            const products = await extractProducts({
              document,
              page,
              rootUrl,
              currency,
              url: request.url,
              type
            });
            stats.add("items", products.length);
            await Dataset.pushData(products);

            const nextPage = document.querySelector(
              `.paginate:not(.non-boost-pagination) .pagination-next`
            )?.href;
            if (nextPage) {
              await enqueueLinks({ urls: [nextPage], label: Labels.List });
            }
          }
          break;
      }
    },
    async failedRequestHandler({ request, log }, error) {
      log.error(`Request ${request.url} failed multiple times`, request);
      rollbar.error(error, request);
      stats.inc("failed");
    }
  });

  await crawler.run(startRequests(country, type, urls));
  await stats.save(true);

  if (!development) {
    const tableName = customTableName ?? `${shopName(rootUrl)}-browser`;
    await uploadToKeboola(tableName);
  }
}

await Actor.main(main, { statusMessage: "DONE" });
