import * as fs from "fs";
import assert from "../src/assert";
import pixelmatch from "pixelmatch";
import sharp from "sharp";

/**
 * Compare the SVG given by `svgStr` to the PNG at `pngPath`,
 * returning the number of pixels which differed between the SVG and
 * its reference.
 *
 * If the number of pixels that differ is greater than 1, then a diff
 * image is generated and saved to `diffPath`.
 *
 * @param svgStr A string representation of an SVG.
 * @param pngPath A path to a PNG image.
 * @param diffPath The path at which this function will write a diff
 * image, if `svgStr` and the PNG at `pngPath` look different.
 * @returns A promise to the number of pixels that differed between
 * `svgStr` and the PNG at `pngPath`.
 */
export default async function diffSvgPng(svgStr: string, pngPath: string, diffPath: string): Promise<number> {
  const svgImg = sharp(Buffer.from(svgStr)).raw();
  const svgMeta = await svgImg.metadata();
  const refImg = sharp(pngPath).raw();
  const refMeta = await refImg.metadata();

  assert(svgMeta.channels === 4);
  assert(refMeta.channels === 4);

  if(svgMeta.width !== refMeta.width || svgMeta.height !== refMeta.height) {
    // Then, the actual and reference images differ in size. We'll
    // just let the diff image be the image produced, so that we can
    // easily take a look at it.

    // Delete the diff file, if it exists.
    if(fs.existsSync(diffPath)) {
      fs.rmSync(diffPath);
    }

    await sharp(Buffer.from(svgStr)).toFile(diffPath);
    return Infinity;
  }

  const width = svgMeta.width;
  const height = svgMeta.height;

  // Make a new buffer for the diff image by just loading the
  // reference image again.  This ensures they have the same
  // size/format.
  const diff = sharp(pngPath).raw();
  const diffBuffer = await diff.toBuffer();

  const nMismatched = pixelmatch(
    await svgImg.toBuffer(),
    await refImg.toBuffer(),
    diffBuffer,
    width,
    height,
    { threshold: 0.1 }
  );

  if(nMismatched > 0) {
    // Write the diff file
    const diffImg = sharp(diffBuffer, {
      raw: {
        width,
        height,
        channels: 4
      }
    });

    const outImg = diffImg.resize(width * 3, height, {
      fit: "contain",
      position: "right"
    });
    outImg.composite([
      { input: await refImg.png().toBuffer(), top: 0, left: 0 },
      { input: await svgImg.png().toBuffer(), top: 0, left: width },
    ]);
    outImg.toFile(diffPath);
  } else {
    // Delete the diff file, if it exists.
    if(fs.existsSync(diffPath)) {
      fs.rmSync(diffPath);
    }
  }

  return nMismatched;
}
