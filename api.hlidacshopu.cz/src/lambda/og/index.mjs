import { withCORS } from "../http.mjs";

/** @typedef { import("@pulumi/awsx/apigateway").Request } APIGatewayProxyEvent */
/** @typedef { import("@pulumi/awsx/apigateway").Response } APIGatewayProxyResult */
/** @typedef { import("@hlidac-shopu/lib/shops.mjs").ShopParams } ShopParams */

/**
 * @param {APIGatewayProxyEvent} event
 * @returns {Promise.<APIGatewayProxyResult>}
 */
export async function handler(event) {
  const params = event.queryStringParameters;
  if (!params?.url) {
    return withCORS(["GET", "OPTIONS"])({
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing url parameter" })
    });
  }

  const url = new URLSearchParams({ url: params.url });
  const request = new URLSearchParams({
    "token": process.env.TOKEN ?? "",
    "url": `https://www.hlidacshopu.cz/widget/?${url}`,
    "waitUntil": "networkidle0",
    "fullPage": "1",
    "w": "600",
    "h": "315",
    "dpr": "2"
  });

  const resp = await fetch(`${process.env.HOST}/?${request}`, {
    signal: AbortSignal.timeout(30000)
  });
  if (!resp.ok) {
    console.error(resp.statusText, await resp.text());
    return withCORS(["GET", "OPTIONS"])({
      statusCode: resp.status,
      body: resp.statusText
    });
  }
  const buffer = await resp.buffer();
  return withCORS(["GET", "OPTIONS"])({
    statusCode: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600"
    },
    isBase64Encoded: true,
    body: buffer.toString("base64")
  });
}
