function countInteractions(type) {
  return stats =>
    stats
      .filter(x => x.interactionType === `https:/schema.org/${type}`)
      .reduce((acc, x) => acc + x.userInteractionCount, 0);
}

const countReviews = countInteractions("ReviewAction");
const countInstalls = countInteractions("InstallAction");

function countProducts(items) {
  return items
    .filter(x => x.count_all)
    .map(x => Number(x.count_all))
    .reduce((acc, x) => acc + x, 0);
}

export default {
  blackFriday: {
    currentYear: 2024
  },
  "en": {
    "code": "en",
    "navigation": {
      "other-page": "Other Page"
    },
    "topmonks-index": {
      "title": "TopMonks"
    }
  },
  filter: {
    shopsToShowOnHP(arr) {
      return arr.filter(item => item.show);
    }
  },
  countInstalls,
  countReviews,
  countProducts
};
