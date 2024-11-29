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
  }
};
