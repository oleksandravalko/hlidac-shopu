import { writeFile } from "node:fs/promises";
import projectPath from "@hckr_/blendid/lib/projectPath.mjs";
import { fetchReviews } from "@hlidac-shopu/lib/remoting.mjs";
import DefaultRegistry from "undertaker-registry";

export class ReviewsRegistry extends DefaultRegistry {
  constructor(config, pathConfig) {
    super();
    this.config = config;
    this.pathConfig = pathConfig;
  }

  /**
   * @param {Undertaker} taker
   */
  init({ task }) {
    task("prepare-reviews-data", async () => {
      const reviews = await fetchReviews();
      const targetPath = projectPath(this.pathConfig.src, this.pathConfig.data.src, "reviews.json");
      return writeFile(targetPath, JSON.stringify(reviews));
    });
  }
}
