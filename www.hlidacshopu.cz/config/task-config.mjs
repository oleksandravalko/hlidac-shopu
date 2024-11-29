import fs from "node:fs";
import path from "node:path";
import projectPath from "@hckr_/blendid/lib/projectPath.mjs";
import gulp_mode from "gulp-mode";
import cssvariables from "postcss-css-variables";
import pathConfig from "./path-config.mjs";
import { WorkboxBuildRegistry } from "./workboxbuild.mjs";

/** @typedef {import("@types/nunjucks").Environment} Environment */

const mode = gulp_mode();
const longDateFormatter = new Intl.DateTimeFormat("cs", {
  year: "numeric",
  month: "long",
  day: "numeric"
});

function assetPath(destPath, key) {
  const revManifest = path.join(destPath, "rev-manifest.json");
  if (fs.existsSync(revManifest)) {
    const manifest = JSON.parse(fs.readFileSync(revManifest).toString());
    return path.join(destPath, manifest[key]);
  }
  return path.join(destPath, key);
}

const config = {
  images: true,
  fonts: true,
  static: true,

  cloudinary: {
    extensions: ["jpg", "jpeg", "png", "gif", "svg", "webp"]
  },

  stylesheets: {
    postcss: {
      plugins: [cssvariables({ preserve: true })]
    }
  },

  generate: {
    exclude: ["assets.json", "media.json", "images.json", "dashboard.json"],
    json: [
      {
        collection: "media",
        mergeOptions: {
          concatArrays: true,
          edit(json) {
            return { [json.published.split("-").shift()]: [json] };
          }
        }
      },
      {
        collection: "dashboard",
        mergeOptions: {
          concatArrays: true,
          edit(json) {
            return { [json.shop]: json };
          }
        }
      }
    ]
  },

  html: {
    collections: ["media", "images", "assets", "build", "dashboard"],
    nunjucksRender: {
      globals: {
        currentYear: new Date().getFullYear()
      },
      filters: {
        longDate(str) {
          return longDateFormatter.format(new Date(str));
        }
      }
    },
    htmlmin: {
      minifyCSS: {
        compatibility: { properties: { urlQuotes: true } }
      }
    }
  },

  esbuild: {
    extensions: ["js", "mjs"],
    watch: "../../../lib/**/*.mjs",
    options: {
      bundle: true,
      splitting: true,
      treeShaking: true,
      minify: mode.production(),
      sourcemap: true,
      format: "esm",
      platform: "browser",
      target: ["es2017", "firefox67", "safari12"],
      charset: "utf8",
      metafile: true,
      metafileName: "../../../../www.hlidacshopu.cz/src/data/assets.json"
    }
  },

  production: {
    rev: true
  },

  registries: [
    new WorkboxBuildRegistry(
      {
        swSrc: () => assetPath(projectPath(pathConfig.dest), "assets/esm/sw.js"),
        swDest: projectPath(pathConfig.dest, "assets/esm/sw.js"),
        globDirectory: pathConfig.dest,
        globPatterns: ["app/index.html", "assets/**/*.{js,css}"]
      },
      pathConfig
    )
  ],

  additionalTasks: {
    development: { postbuild: ["workboxBuild"] },
    production: { postbuild: ["workboxBuild"] }
  },

  vite: {
    browser: "polypane",
    browserArgs: "--ignore-certificate-errors --allow-insecure-localhost"
  }
};

export default config;
