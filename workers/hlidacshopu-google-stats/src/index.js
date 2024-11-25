export default {
  async fetch(request, env, ctx) {
    const resp = await fetch("https://chrome-stats.com/d/plmlonggbfebcjelncogcnclagkmkikk");
    const html = await resp.text();
    const downloads = parseInt(/userCount:(?<count>\d+)/gm.exec(html).groups.count);
    const reviews = parseInt(/"ratingCount":(?<count>\d+)/gm.exec(html).groups.count);
    return Response.json([
      {
        "@context": "https://schema.org",
        "@type": "InteractionCounter",
        interactionType: "https:/schema.org/InstallAction",
        interactionService: {
          "@type": "WebSite",
          name: "Chrome Web Store",
          url: "https://chrome.google.com/webstore/detail/hl%C3%ADda%C4%8D-shop%C5%AF/plmlonggbfebcjelncogcnclagkmkikk"
        },
        userInteractionCount: downloads,
        subjectOf: {
          "@type": "WebApplication",
          url: "https://www.hlidacshopu.cz/"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "InteractionCounter",
        interactionType: "https:/schema.org/ReviewAction",
        interactionService: {
          "@type": "WebSite",
          name: "Chrome Web Store",
          url: "https://chrome.google.com/webstore/detail/hl%C3%ADda%C4%8D-shop%C5%AF/plmlonggbfebcjelncogcnclagkmkikk"
        },
        userInteractionCount: reviews,
        subjectOf: {
          "@type": "WebApplication",
          url: "https://www.hlidacshopu.cz/"
        }
      }
    ]);
  }
};
