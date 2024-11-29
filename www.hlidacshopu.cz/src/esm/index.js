import { render } from "lit-html";
import { Workbox } from "workbox-window";
import * as rollbar from "./rollbar.js";
import { resultsEmbed } from "./templates.js";

rollbar.init();

const isProduction = () => ["localhost", "127"].indexOf(location.hostname) === -1;
if ("serviceWorker" in navigator && isProduction()) {
  const wb = new Workbox("/assets/esm/sw.js", { type: "module", scope: "/" });
  wb.register().catch(err => console.error(err));
}

const form = document.getElementById("compare-form");
const modal = document.getElementById("hlidac-shopu-modal");
const modalRenderRoot = document.getElementById("hlidac-shopu-modal__placeholder");
const installationGuide = document.getElementById("extension-install-guide");

const haveToCloseModal = t =>
  t === modal || t.classList.contains("modal__close") || t.parentElement.classList.contains("modal__close");

form.addEventListener("submit", e => {
  e.preventDefault();
  const detailUri = e.target["url"].value;
  history.pushState({ showModal: true, detailUri }, null, `?url=${encodeURIComponent(detailUri)}`);
  renderResultsModal(detailUri);
});

modal.addEventListener("click", e => {
  const target = e.target;
  if (haveToCloseModal(target)) {
    e.preventDefault();
    history.pushState({ showModal: false }, null, "/");
    hideResultsModal();
    clearAndFocusInput();
  }
});

addEventListener("keydown", e => {
  if (e.key === "Escape" && history.state && history.state.showModal) {
    history.pushState({ showModal: false }, null, "/");
    hideResultsModal();
    clearAndFocusInput();
  }
});

addEventListener("DOMContentLoaded", async e => {
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has("url")) {
    const detailUri = searchParams.get("url");
    history.replaceState({ showModal: true, detailUri }, null);
    renderResultsModal(detailUri);
  }
  setStoreUrls(searchParams);
  const installationGuideUrl = getInstallationGuideUrl(searchParams);
  if (installationGuideUrl) {
    const client = await import(installationGuideUrl);
    render(client.installationGuide(), installationGuide);
  }
});

addEventListener("popstate", e => {
  if (!history.state) {
    hideResultsModal();
    return;
  }
  const { showModal, detailUri } = history.state;
  if (showModal) {
    renderResultsModal(detailUri);
  } else {
    hideResultsModal();
  }
});

function clearAndFocusInput() {
  form["url"].value = "";
  form["url"].focus();
}

function showResultsModal() {
  modal.classList.remove("modal--hidden");
  document.body.classList.add("no-scroll");
}

function hideResultsModal() {
  modal.classList.add("modal--hidden");
  document.body.classList.remove("no-scroll");
}

async function renderResultsModal(detailUrl) {
  render(resultsEmbed(detailUrl), modalRenderRoot);
  showResultsModal();
}

const tabList = document.querySelector(".tab-list");
const tabs = document.querySelector(".tabs");
let activeTab = "tab-1";
tabList.addEventListener("click", e => {
  if (e.target.tagName === "A") {
    e.preventDefault();
    const targetTab = e.target.hash.substring(1);
    tabs.classList.remove(`tabs--open-${activeTab}`);
    tabs.classList.add(`tabs--open-${targetTab}`);
    activeTab = targetTab;
  }
});

const storeLinks = new Map([
  ["firefox", "https://addons.mozilla.org/cs-CZ/firefox/addon/hl%C3%ADda%C4%8D-shop%C5%AF/"],
  ["chrome", "https://chrome.google.com/webstore/detail/hl%C3%ADda%C4%8D-shop%C5%AF/plmlonggbfebcjelncogcnclagkmkikk"],
  ["safari", "https://apps.apple.com/cz/app/hl%C3%ADda%C4%8D-shop%C5%AF/id1488295734"]
]);

function setStoreUrls(searchParams) {
  const browsers = Array.from(storeLinks.keys());
  const browser = findActiveBrowser(browsers, searchParams);
  const links = document.querySelectorAll(".store-link");
  for (let link of links) {
    link.dataset.browser = browser ?? link.dataset.browser;
    link.href = storeLinks.get(browser) ?? link.href;
  }
}

// explicit map of URLs for guides, to be rev-updated in production build
const guides = new Map([
  ["firefox", "./firefox.js"],
  ["android", "./android.js"],
  ["chrome", "./chrome.js"],
  ["safari", "./safari.js"]
]);

function getInstallationGuideUrl(searchParams) {
  const browsers = Array.from(guides.keys());
  const browser = findActiveBrowser(browsers, searchParams);
  return guides.get(browser);
}

function findActiveBrowser(browsers, searchParams) {
  // forcing UA via get parameters has precedence
  let browser = browsers.filter(x => searchParams.has(x)).pop();
  if (browser) return browser;
  const ua = navigator.userAgent.toLowerCase();
  return browsers.filter(x => ua.indexOf(x) > 0).shift();
}
