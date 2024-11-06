import { precacheAndRoute } from "workbox-precaching";
import { imageCache, pageCache, staticResourceCache } from "workbox-recipes";

function setup(manifest) {
  precacheAndRoute(manifest);
  pageCache();
  staticResourceCache();
  imageCache();
}

addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

setup(self.__WB_MANIFEST);
