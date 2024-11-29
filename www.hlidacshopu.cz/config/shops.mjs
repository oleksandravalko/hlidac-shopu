import { writeFile } from "node:fs/promises";
import projectPath from "@hckr_/blendid/lib/projectPath.mjs";
import { shopsArray } from "@hlidac-shopu/lib/shops.mjs";
import DefaultRegistry from "undertaker-registry";

export class ShopsRegistry extends DefaultRegistry {
  constructor(config, pathConfig) {
    super();
    this.config = config;
    this.pathConfig = pathConfig;
  }

  /**
   * @param {Undertaker} taker
   */
  init({ task }) {
    task("prepare-shops-data", async () => {
      const shops = shopsArray().map(x => ({
        name: x.name,
        logo: x.logo,
        url: x.url,
        show: x.show ?? Boolean(x.viewBox)
      }));
      const targetPath = projectPath(this.pathConfig.src, this.pathConfig.data.src, "shops.json");
      return writeFile(targetPath, JSON.stringify(shops));
    });
  }
}
