#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { formatISO } from "date-fns/formatISO";
import { parseHTML } from "linkedom/cached";

const test = false;
const urls = [
  "https://www.zive.cz/clanky/rozjizdi-se-hlidac-supermarketu-odhali-manipulace-s-cenami-a-rekne-vam-kde-koupite-levnejsi-hermelin/sc-3-a-226016/default.aspx"
];

const template = ({ url, title, date, perex, filename }) => `---
title: "${title}"
url: "${url}"
published: ${date}
image: ${filename}
---

${perex}
`;

function writeMdFile(filename, url, title, date, perex, imageExt) {
  const filePath = path.join("www.hlidacshopu.cz", "src", "data", "media", `${filename}.md`);
  const data = template({
    url,
    title,
    date,
    perex,
    filename: `${filename}.${imageExt}`
  });
  return fs.promises.writeFile(filePath, data);
}

function writeImgFile(filename, imageExt, imageData) {
  const imgPath = path.join("www.hlidacshopu.cz", "src", "cloudinary", "media", `${filename}.${imageExt}`);
  return fs.promises.writeFile(imgPath, new Uint8Array(imageData));
}

function readLinkedData(document) {
  try {
    return JSON.parse(document.querySelector("script[type='application/ld+json']")?.innerHTML ?? "{}");
  } catch (o_0) {
    return {};
  }
}

/**
 * Reads the response text in given text encoding.
 * When charset isn't defined on `content-type` header it falls back to `utf-8`.
 * @param {Response} resp
 * @returns {string}
 */
async function readTextResponse(resp) {
  const contentType = resp.headers.get("content-type");
  const [, charset] = contentType?.split("charset=");
  const decoder = new TextDecoder(charset ?? "utf-8");
  const buffer = await resp.arrayBuffer();
  return decoder.decode(buffer);
}

async function main() {
  for (let url of urls) {
    console.log(url);
    const resp = await fetch(url, {});
    const { document } = parseHTML(await readTextResponse(resp));
    const ld = readLinkedData(document);
    const title = (
      ld.headline ??
      document.querySelector("[property='og:title']")?.getAttribute("content") ??
      document.querySelector("h1, .post-title, [itemprop=name]")?.textContent
    )?.trim();
    const imageUrl = document
      .querySelector("meta[property='og:image'], meta[property='og:image:url']")
      ?.getAttribute("content");
    let imageResp = imageUrl
      ? fetch(imageUrl, {
          headers: { "Accept": "image/avif,image/webp,image/*" }
        })
      : console.error("Image not found");
    const time = new Date(
      ld.datePublished ??
        document.querySelector("meta[property='og:updated_time']")?.getAttribute("content") ??
        document.querySelector("meta[property='article:published_time']")?.getAttribute("content") ??
        document.querySelector("time")?.getAttribute("datetime") ??
        document.querySelector("[itemprop=datePublished]")?.getAttribute("content") ??
        Date.now()
    );
    const perex = (
      document.querySelector("meta[property='og:description']")?.getAttribute("content") ??
      document.querySelector("meta[name='description']")?.getAttribute("content")
    )?.trim();
    const parts = new URL(url).host.split(".");
    parts.pop();
    const siteName = parts.pop();

    const date = formatISO(time, { representation: "date" });
    const filename = `${date}-${siteName}`;
    if (imageResp) imageResp = await imageResp;
    const imageExt = imageResp?.headers?.get("content-type")?.split("/")?.pop();

    if (test) {
      console.log({ filename, url, title, date, perex, imageExt });
    } else {
      await Promise.all([
        writeMdFile(filename, url, title, date, perex, imageExt),
        imageResp?.arrayBuffer()?.then(imageData => writeImgFile(filename, imageExt, imageData))
      ]);
    }
  }
}

await main();
process.exit(0);
