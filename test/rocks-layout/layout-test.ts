import * as path from "path";
import collectLayoutTests from "../collect-layout-tests";
import diffSvgPng from "../diff-svg-png";
import sharp from "sharp";
import { FragmentBoundingBoxesRendering } from "../../src/layout-tree";
import { RocksLayout, RocksLayoutSettings } from "../../src/rocks-layout/layout";
import { test, expect } from "@jest/globals";
import { toSVG } from "../../src/render";

// @ts-ignore
import __dirname from "./layout-tests/dirname.cjs";
const testDir = __dirname;

const tests = await collectLayoutTests(testDir);

test.each(tests)("layout $testName", async ({testName, layoutTree, expectationPath, hasBaseline, settings}) => {
  const alg = new RocksLayout(new RocksLayoutSettings(settings.translateWraps ?? true, 0));
  const l = alg.layout(layoutTree);
  const svg = toSVG(l.stack(new FragmentBoundingBoxesRendering(l)), 0);

  if(!hasBaseline) {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(expectationPath);
  }

  const diffPath = path.join(path.dirname(expectationPath), `${testName}.diff.png`);
  const nMismatched = await diffSvgPng(svg, expectationPath, diffPath);

  expect(nMismatched).toBe(0);
});
