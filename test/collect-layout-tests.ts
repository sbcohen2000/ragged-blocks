import * as fs from "fs";
import * as path from "path";
import { LayoutTree, WithMeasurements } from "../src/layout-tree";

type TestSettings = {
  /**
   * Corresponds to the `translateWraps` setting on L1S, L1S+, and
   * L1P. If specified on a test for a different layout algorithm,
   * then this setting is ignored.
   */
  translateWraps?: boolean;
};

type TestSpec = {
  /**
   * The name of this test, without any file extension.
   */
  testName: string;
  /**
   * The input layout tree.
   */
  layoutTree: LayoutTree<WithMeasurements>;
  /**
   * An absolute path to the expectation image for this test.
   */
  expectationPath: string;
  /**
   * `true` if this test has a baseline, and `false` if a baseline
   * must be found prior to running the test.
   */
  hasBaseline: boolean;
  /**
   * Some settings.
   */
  settings: TestSettings;
};

/**
 * Given the name of a directory, generate a `Promise` to a list of
 * `TestSpec`s, each containing a `LayoutTree` to layout.
 *
 * @param testDir The directory in which to look for tests and baselines.
 * @returns A promise to the list of `TestSpec`s.
 */
export default async function collectLayoutTests(testDir: string): Promise<TestSpec[]> {
  const testNames = fs.readdirSync(testDir);

  const tests: TestSpec[] = [];
  for(const name of testNames) {
    if(path.extname(name) !== ".ts") continue;

    const modPath = path.join(testDir, name);
    const mod = await import(modPath);

    let settings: TestSettings = {};
    if(mod["settings"]) {
      settings = {...settings, ...mod["settings"]};
    }

    if(mod["layoutTree"]) {
      const layoutTree = mod["layoutTree"] as LayoutTree<WithMeasurements>;

      const testName = path.basename(modPath, ".ts");

      const expectationPath = path.join(testDir, `${testName}.png`);
      tests.push({
        testName,
        layoutTree,
        expectationPath,
        hasBaseline: fs.existsSync(expectationPath),
        settings
      });
    }
  }

  return tests;
}
