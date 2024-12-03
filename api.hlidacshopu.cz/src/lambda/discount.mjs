import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { endOfToday } from "date-fns/endOfToday";
import { isAfter } from "date-fns/isAfter";
import { isWithinInterval } from "date-fns/isWithinInterval";
import { subDays } from "date-fns/subDays";
import { drop, groupBy, head, last, zipWith } from "ramda";

/**
 * @typedef { import("./types").DataRow } DataRow
 * @typedef { import("./types").EUDiscount } EUDiscount
 * @typedef { import("./types").CommonPriceDifference } CommonPriceDifference
 */

/**
 * @callback Predicate.<T>
 * @param {T}
 * @returns {Boolean}
 * @template T
 */

/**
 * @param {number} previous
 * @param {number} actual
 * @returns {number|null}
 */
export function discount(previous, actual) {
  if (actual === null || isNaN(actual)) return null;
  return (previous - actual) / previous;
}

/**
 * @param {Date} lastDiscountDate
 * @param {Date | null} lastIncreaseDate
 * @param {[Date, number][]} series
 * @returns {EUDiscount}
 */
function euDiscount(lastDiscountDate, lastIncreaseDate, series) {
  // go 30 days back
  const startDate = subDays(lastDiscountDate, 30);
  // find lowest price in 30 days interval before sale action
  const minPrice = series
    .filter(([date, price]) => Boolean(price) && isWithinInterval(date, { start: startDate, end: lastDiscountDate }))
    .map(([, price]) => price)
    .reduce((a, b) => Math.min(a, b), Number.MAX_SAFE_INTEGER);
  const [, currentPrice] = last(series);
  const realDiscount = discount(minPrice, currentPrice);
  return {
    minPrice,
    currentPrice,
    realDiscount,
    lastDiscountDate,
    lastIncreaseDate,
    type: "eu-minimum"
  };
}

/**
 * @param {Date | null} lastDiscountDate
 * @param {Date | null} lastIncreaseDate
 * @param {[Date, number][]} series
 * @param {Predicate.<Date>} isInInterval
 * @returns {CommonPriceDifference}
 */
function commonPriceDifference(lastDiscountDate, lastIncreaseDate, series, isInInterval) {
  // find most frequent price in 30 days interval before sale action
  const byPrice = groupBy(([, price]) => price);
  const frequencies = Object.entries(
    byPrice(series.filter(([date, price]) => Boolean(price) && isInInterval(date)))
  ).map(([price, xs]) => [parseFloat(price), xs.length]);
  const moreFrequent = (a, b) => (a[1] > b[1] ? a : b);
  const [commonPrice] = frequencies.reduce(moreFrequent, [0, 0]);
  const [, currentPrice] = last(series);
  const realDiscount = discount(commonPrice, currentPrice);
  return {
    commonPrice,
    currentPrice,
    realDiscount,
    lastDiscountDate,
    lastIncreaseDate,
    type: "common-price"
  };
}

/**
 * @param {Date} lastIncreaseDate
 * @param {Date} lastDiscountDate
 * @param {Predicate.<Date>} isInInterval
 * @returns {Boolean}
 */
function isEuDiscountApplicable(lastIncreaseDate, lastDiscountDate, isInInterval) {
  if (lastDiscountDate && isInInterval(lastDiscountDate)) {
    return !lastIncreaseDate || isAfter(lastDiscountDate, lastIncreaseDate);
  }
  return false;
}

const commonPriceInterval = 90;
const saleActionInterval = 90;

/**
 *
 * @param {number} days
 * @returns {function(Date): boolean}
 */
const isInLastDays = days => date =>
  isWithinInterval(date, {
    start: subDays(new Date(), days),
    end: new Date()
  });

/**
 *
 * @param {DataRow[]} data
 * @returns {{lastDiscountDate: Date | undefined, lastIncreaseDate: Date | undefined, series: [Date, number][]}}
 */
function getLastChangesInData(data) {
  const series = data.filter(({ currentPrice }) => currentPrice).map(({ currentPrice, date }) => [date, currentPrice]);
  // walk thru price series and find changes
  const changes = zipWith(
    ([, a], [date, b]) => [a - b, date],
    drop(1, series),
    series
    // filter out invalid products
  ).filter(([δ]) => Boolean(δ));
  const lastDiscountDate = last(changes.filter(([δ]) => δ < 0).map(([, date]) => date));
  const lastIncreaseDate = last(changes.filter(([δ]) => δ > 0).map(([, date]) => date));
  return { series, lastDiscountDate, lastIncreaseDate };
}

/**
 * Searches for Sale Action in last 30 days. When there is any, it returns
 * real sale according to EU legislation - Minimum price in 30 days before
 * sale action. Sale action is simply last drop of price without any increase.
 * In other cases it counts discount against common price - most used price
 * in 60 days interval.
 * @param {{commonPrice: number, minPrice?: number}} meta
 * @param {DataRow[]} data Time series of prices
 * @returns {EUDiscount | CommonPriceDifference}
 */
export function realDiscount(meta, data) {
  const { commonPrice, minPrice } = meta;
  const { currentPrice } = last(data);
  const { lastDiscountDate, lastIncreaseDate } = getLastChangesInData(data);
  if (minPrice && isEuDiscountApplicable(lastIncreaseDate, lastDiscountDate, isInLastDays(saleActionInterval))) {
    return {
      minPrice,
      currentPrice,
      realDiscount: discount(minPrice, currentPrice),
      lastDiscountDate,
      lastIncreaseDate,
      type: "eu-minimum"
    };
  }
  return {
    commonPrice,
    currentPrice,
    realDiscount: discount(commonPrice, currentPrice),
    lastDiscountDate,
    lastIncreaseDate,
    type: "common-price"
  };
}

/**
 * Searches for Sale Action in last 30 days. When there is any, it returns
 * real sale according to EU legislation - Minimum price in 30 days before
 * sale action. Sale action is simply last drop of price without any increase.
 * In other cases it counts discount against common price - most used price
 * in 60 days interval.
 * @param {DataRow[]} data Time series of prices
 * @returns {EUDiscount | CommonPriceDifference}
 * @deprecated
 */
export function getRealDiscount(data) {
  const { series, lastDiscountDate, lastIncreaseDate } = getLastChangesInData(data);

  if (isEuDiscountApplicable(lastIncreaseDate, lastDiscountDate, isInLastDays(saleActionInterval))) {
    return euDiscount(lastDiscountDate, lastIncreaseDate, series);
  }
  return commonPriceDifference(lastDiscountDate, lastIncreaseDate, series, isInLastDays(commonPriceInterval));
}

/**
 *
 * @param {DataRow[]} data
 * @returns {number | null}
 */
export function getClaimedDiscount(data) {
  const lastRow = last(data);
  if (!(lastRow?.originalPrice && lastRow?.currentPrice)) {
    return null;
  }
  return discount(lastRow.originalPrice, lastRow.currentPrice);
}

/**
 *
 * @param {Array | Object} priceHistory
 * @returns {DataRow[]}
 */
export function prepareData(priceHistory) {
  const rows = Array.isArray(priceHistory) ? priceHistory : priceHistory.entries;

  // TODO: remove parsing after transition to S3 based API
  const data = rows.map(({ o, c, d }) => ({
    currentPrice: c,
    originalPrice: o,
    date: new Date(d)
  }));

  const dataMap = new Map(data.map(x => [x.date.getTime(), x]));
  const days = eachDayOfInterval({
    start: head(data)?.date,
    end: endOfToday()
  });

  let prevDay = head(data);
  /**
   * @param {Date} date
   * @returns {DataRow}
   */
  const fillInMissingData = date =>
    Object.assign({}, (prevDay = dataMap.get(date.getTime()) ?? prevDay), {
      date
    });

  /**
   * @param {DataRow} x
   * @param {number} i
   * @param {DataRow[]} arr
   * @returns {DataRow}
   */
  const replaceDeviatedData = (x, i, arr) => {
    if (i === 0 || !x.currentPrice) return x;

    const prev = arr[i - 1];
    if (!prev.currentPrice) return x;

    const r = prev.currentPrice / x.currentPrice;
    if (0.005 < r && r < 200) return x;

    x.currentPrice = prev.currentPrice;
    return x;
  };
  return days.map(fillInMissingData).map(replaceDeviatedData);
}
