import { writeFile } from "node:fs/promises";
import projectPath from "@hckr_/blendid/lib/projectPath.mjs";
import { fetchStats } from "@hlidac-shopu/lib/remoting.mjs";
import DefaultRegistry from "undertaker-registry";

export class StatsRegistry extends DefaultRegistry {
  constructor(config, pathConfig) {
    super();
    this.config = config;
    this.pathConfig = pathConfig;
  }

  /**
   * @param {Undertaker} taker
   */
  init({ task }) {
    task("prepare-stats-data", async () => {
      const stats = await fetchStats();
      const targetPath = projectPath(this.pathConfig.src, this.pathConfig.data.src, "stats.json");
      return writeFile(targetPath, JSON.stringify(stats));
    });
  }
}
