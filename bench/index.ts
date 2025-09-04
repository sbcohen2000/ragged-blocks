import * as freetype from "@julusian/freetype2";
import * as rb from "ragged-blocks";
import * as readline from "node:readline/promises";
import Haskell from "tree-sitter-haskell";
import Python from "tree-sitter-python";
import TypeScript from "tree-sitter-typescript";
import fs from "node:fs";
import { basename, extname } from "node:path";
import { exit } from "node:process";
import { parse, ParseSettings } from "ts-compat";
import { program, Command, Argument, Option } from "commander";

/**
 * Produce a human readable string representing the given time in
 * seconds.
 *
 * @param duration The duration in seconds.
 * @returns A human readable string representing the duration.
 */
function fmtDuration(duration: number) {
  let unit = "seconds";
  if(duration < 0.1) {
    unit = "milliseconds";
    duration *= 1000;
  }

  const format = Intl.NumberFormat(undefined, {
    minimumSignificantDigits: 4,
    maximumSignificantDigits: 8,
  });

  return `${format.format(duration)} ${unit}`;
}

function countDigits(s: string): [number, number] {
  const beforePoint = s.indexOf(".");
  if(beforePoint === -1) {
    return [s.length, 0];
  }

  return [beforePoint, s.length - beforePoint - 1];
}

function repeat(s: string, n: number): string {
  let out = "";
  for(let i = 0; i < n; ++i) {
    out += s;
  }
  return out;
}

function padStart(s: string, pfx: string, n: number): string {
  return repeat(pfx, Math.max(n, 0)) + s;
}

function padEnd(s: string, sfx: string, n: number): string {
  return s + repeat(sfx, Math.max(n, 0));
}

function fmtCol(ns: number[], tooSmall: number, forLaTeX: boolean): string[] {
  const format = Intl.NumberFormat(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 2,
    maximumFractionDigits: 3,
    roundingPriority: "lessPrecision"
  });

  let anyTooSmall = false;
  let maxPfx: number = 0;
  let maxSfx: number = 0;
  let intermediate: [string, number, number, boolean][] = [];
  for(const n of ns) {
    if(n < tooSmall) {
      anyTooSmall = true;
    }

    const s = format.format(Math.max(n, tooSmall));
    const [nPfx, nSfx] = countDigits(s);
    maxPfx = Math.max(maxPfx, nPfx);
    maxSfx = Math.max(maxSfx, nSfx);

    intermediate.push([s, nPfx, nSfx, n < tooSmall]);
  }

  let pfxAll = "";
  if(anyTooSmall) {
    pfxAll = forLaTeX ? "\\phantom{<}" : " ";
  }

  return intermediate.map(([s, nPfx, nSfx, tooSmall]) => {
    if(s.indexOf(".") === -1) {
      s = s + (forLaTeX ? "\\phantom{.}" : " ");
    }

    let pfx = tooSmall ? "<" : pfxAll;
    const pz = forLaTeX ? "\\pz{}" : " "
    return pfx + padEnd(padStart(s, pz, maxPfx - nPfx), pz, maxSfx - nSfx);
  });
}

function fmtTable(
  headers: string[],
  data: (number | string)[][],
  forLaTeX: boolean,
  postprocess: (s: string, row: number, col: number, atEnd: boolean) => string
): string {
  const nRows = data.length;
  const nCols = data[0].length;

  let columns: string[][] = [];
  for(let col = 0; col < nCols; ++col) {
    let colData: (number | string)[] = [];
    for(let row = 0; row < nRows; ++row) {
      colData.push(data[row][col]);
    }

    if(colData.every(d => typeof d === "number")) {
      // Then we have a numeric column.
      colData = fmtCol(colData, 0.01, forLaTeX);
    }

    // Turn the column into strings.
    let colStrings: string[] = [headers[col] + " "];
    let maxColLen = headers[col].length + 1;

    for(let row = 0; row < nRows; ++row) {
      let s = colData[row].toString();
      s = postprocess(s, row, col, col === nCols - 1);

      colStrings.push(s);
      maxColLen = Math.max(maxColLen, s.length);
    }

    // Make each string the same length.
    for(let i = 0; i < colStrings.length; ++i) {
      colStrings[i] = padStart(colStrings[i], " ", maxColLen - colStrings[i].length);
    }

    columns.push(colStrings);
  }

  let out = "";
  // Note that here we account for the header row with <=.
  for(let row = 0; row <= nRows; ++row) {
    for(const col of columns) {
      out += col[row];
    }
    out += "\n"
  }

  return out;
}

/**
 * The function we use to figure out how big a leaf in the layout tree
 * is. For the purposes of benchmarking, we set every fragment to the
 * same height and let its width be proportional to the length of its
 * contents.
 */
function measureFallback(text: string): rb.Rect {
  return {
    left: 0,
    right: text.length * 10,
    top: 0,
    bottom: 20
  };
}

/**
 * Make a measurement function which uses the given `font` as input.
 *
 * @param font A path to the font file to load.
 * @returns A measure function using `font`.
 */
function mkMeasure(font: string): (text: string) => rb.Rect {
  const face = freetype.NewFace(font);
  face.setPixelSizes(12, 0);
  const ascend = face.properties().ascender / 64;
  const descend = face.properties().descender / 64;

  return (text: string) => {
    let width = 0;
    for(let i = 0; i < text.length; ++i) {
      const glyph = face.loadChar(text.charCodeAt(i));
      width += glyph.metrics.horiAdvance / 64;
    }

    return {
      left: 0,
      right: width,
      top: -ascend,
      bottom: -descend
    }
  };
};

type BenchResult = {
  meanHorzMeshDistance: number;
  horzMeshDistances: number[];
  meanVertMeshDistance: number;
  vertMeshDistances: number[];
  meanLineWidth: number;
  nFragments: number;
  duration: number;
  basename: string;
  algoStr: Algo;
  renderable: rb.Render;
}

type Algo = "Unstyled" | "L1S" | "L1S+" | "L1P" | "S-Blocks" | "BlocksNS" | "Blocks";

function asAlgo(text: string): Algo {
  switch(text) {
    case "Unstyled":
    case "L1S":
    case "L1S+":
    case "L1P":
    case "S-Blocks":
    case "BlocksNS":
    case "Blocks": return text;
    default:
      throw new Error(`Unknown layout algorithm (${text}). Exiting.`);
  }
}

function algoContrOfAlgoStr(algoStr: Algo): rb.Layout {
  switch(algoStr) {
    case "Unstyled":
    case "L1P": return new rb.PebbleLayout(new rb.PebbleLayoutSettings(true, 20));
    case "L1S": return new rb.RocksLayout(new rb.RocksLayoutSettings(true, 20));
    case "L1S+": return new rb.OutlinedRocksLayout(new rb.OutlinedRocksLayoutSettings(true, 20, true));
    case "S-Blocks": return new rb.SBlocksLayout(new rb.SBlocksLayoutSettings(20));
    case "BlocksNS":
    case "Blocks": return new rb.BlocksLayout(new rb.BlocksLayoutSettings());
    default:
      throw new Error(`Unknown layout algorithm (${algoStr}). Exiting.`);
  }
}

function langOfSrcPath(srcPath: string): any {
  const ext = extname(srcPath);
  switch(ext) {
    case ".ts": return TypeScript.typescript;
    case ".py": return Python;
    case ".hs": return Haskell;
    default:
      throw new Error(`Unknown input file extension (${ext}). Exiting.`);
  }
}

function measureRuntime(srcPath: string, algoStr: Algo, iters: number): number {
  const algo = algoContrOfAlgoStr(algoStr);
  const ext = extname(srcPath);
  const lang = langOfSrcPath(srcPath);

  const settings: ParseSettings = {
    useSpacers: algoStr !== "BlocksNS",
    breakMultiLineAtoms: ext === ".py",
  };

  const src = fs.readFileSync(srcPath, { encoding: "utf8" });
  const testTree = parse(src, lang, settings);
  rb.randomizeFillColors(testTree);
  let testTreeWithMeasurements = rb.measureLayoutTree(testTree, measureFallback);

  const startTime = performance.now();
  for(let i = 0; i < iters; ++i) {
    algo.layout(testTreeWithMeasurements);
  }
  const endTime = performance.now();

  const duration = (endTime - startTime) / 1000; // seconds

  return duration / iters;
}

type RenderSettings = {
  renderText: boolean;
  renderFragmentBoundingBoxes: boolean;
  renderRefMesh: boolean;
  renderTestMesh: boolean;
};

const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  renderText: true,
  renderFragmentBoundingBoxes: false,
  renderRefMesh: false,
  renderTestMesh: false
};

function bench(srcPath: string, algoStr: Algo, measure: (text: string) => rb.Rect, renderSettings?: Partial<RenderSettings>): BenchResult {
  if(!renderSettings) {
    renderSettings = {};
  }
  renderSettings = { ...DEFAULT_RENDER_SETTINGS, ...renderSettings };

  console.log(`Working on ${algoStr}...`);
  const testAlgo = algoContrOfAlgoStr(algoStr);
  const ext = extname(srcPath);
  const lang = langOfSrcPath(srcPath);

  const settings: ParseSettings = {
    useSpacers: algoStr !== "BlocksNS",
    breakMultiLineAtoms: ext === ".py",
  };

  const src = fs.readFileSync(srcPath, { encoding: "utf8" });
  const testTree = parse(src, lang, settings);
  rb.randomizeFillColors(testTree);
  let testTreeWithMeasurements = rb.measureLayoutTree(testTree, measure);

  const refTree = parse(src, lang, settings);
  rb.removePadding(refTree);
  let refTreeWithMeasurements = rb.measureLayoutTree(refTree, measure);

  if(algoStr === "Unstyled") {
    testTreeWithMeasurements = refTreeWithMeasurements;
  }

  let refMesh: rb.MeshDistanceMesh | undefined = undefined;
  if(algoStr !== "Unstyled") {
    const refAlgo = new rb.RocksLayout(new rb.RocksLayoutSettings(true, 20));
    const refResult = refAlgo.layout(refTreeWithMeasurements);
    refMesh = rb.MeshDistanceMesh.fromFragments(refResult);
  }

  const startTime = performance.now();
  const testResult = testAlgo.layout(testTreeWithMeasurements);
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000; // seconds

  const testMesh = rb.MeshDistanceMesh.fromFragments(testResult);
  const meanLineWidth = testMesh.meanLineWidth();

  let meanHorzMeshDistance = 0;
  let horzMeshDistances: number[] = [];
  let meanVertMeshDistance = 0;
  let vertMeshDistances: number[] = [];
  if(refMesh !== undefined) {
    meanHorzMeshDistance = refMesh.meanHorizontalMeshDistance(testMesh);
    horzMeshDistances = refMesh.horizontalMeshDistances(testMesh);
    meanVertMeshDistance = refMesh.meanVerticalMeshDistance(testMesh);
    vertMeshDistances = refMesh.verticalMeshDistances(testMesh);
  }

  const metricsIter = rb.eachAtom(testTreeWithMeasurements);
  const text = new (class extends rb.Render {
    render(svg: rb.Svg, _sty: rb.SVGStyle) {
      for(const frag of testResult.fragmentsInfo()) {
        const metrics = metricsIter.next().value as rb.Atom<rb.WithMeasurements>;
        const text = svg.text(frag.text);
        text.font("Inconsolata Medium", 12);
        text.move(frag.rect.left, frag.rect.top - metrics.rect.top);
      }
    }

    boundingBox(): rb.Rect | null {
      return null;
    }
  });

  let rendering: rb.Render = testResult;
  if(renderSettings.renderFragmentBoundingBoxes) {
    rendering = rendering.stack(new rb.FragmentBoundingBoxesRendering(testResult));
  }

  if(renderSettings.renderText) {
    rendering = rendering.stack(text);
  }

  if(renderSettings.renderTestMesh) {
    rendering = rendering.stack(testMesh.withStyles({ stroke: "green" }));
  }

  if(renderSettings.renderRefMesh && refMesh !== undefined) {
    rendering = rendering.stack(refMesh.withStyles({ stroke: "blue" }));
  }

  return {
    meanHorzMeshDistance,
    horzMeshDistances,
    meanVertMeshDistance,
    vertMeshDistances,
    meanLineWidth,
    nFragments: testMesh.countFragments(),
    duration,
    basename: basename(srcPath),
    algoStr,
    renderable: rendering
  }
}


function benchAll(srcPath: string): Map<Algo, BenchResult> {
  const algos: Algo[] = ["Unstyled", "L1P", "L1S", "S-Blocks", "BlocksNS", "Blocks"];
  let out: Map<Algo, BenchResult> = new Map();
  for(const algo of algos) {
    const result = bench(srcPath, algo, measureFallback, { renderText: false });
    out.set(algo, result);
  }
  return out;
}

function mkPerfTable(forLaTeX: boolean) {
  const srcPaths: string[] = [
    "./inputs/core.ts",
    "./inputs/diff-objs.ts",
    "./inputs/functional.py",
    "./inputs/simplex.py",
    "./inputs/solve.hs",
    "./inputs/layout.hs",
  ];

  // ==================== Performance ====================
  console.log(">>>>>>>>>>> Performance:");

  const STATIC: { [key: string]: [string, string] } = {
    "core.ts":       ["3020",  "20k"],
    "diff-objs.ts":  ["25",   "0.2k"],
    "functional.py": ["2233", "5.3k"],
    "simplex.py":    ["339",  "1.0k"],
    "solve.hs":      ["1736", "6.8k"],
    "layout.hs":     ["285",  "2.0k"],
  };

  let perf: (number | string)[][] = [];

  for(const srcPath of srcPaths) {
    const base = basename(srcPath);
    const durationL1P = measureRuntime(srcPath, "L1P", 10);
    const durationL1S = measureRuntime(srcPath, "L1S", 10);

    const nLOC = STATIC[base][0];
    const nFrags = STATIC[base][1];

    const row = [base, nLOC, nFrags, durationL1P, durationL1S, durationL1P / durationL1S];
    perf.push(row);
  }

  console.log(fmtTable(
    ["Filename", "LOC", "# of Fragments", "L1P", "L1S", "L1S Speedup"],
    perf, forLaTeX, (s, _row, col, atEnd) => {
    if(forLaTeX) {
      if(col === 5) {
        s = ` (${s} $\\times{}$)`;
      } else {
        s = `${s}`;
      }

      if(atEnd) {
        s += " \\\\";
      } else if(col < 4) {
        s += " & ";
      }
      return s;
    } else {
      return s + " ";
    }
  }));
}

function mkErrorTables(forLaTeX: boolean) {
  const srcPaths: string[] = [
    "./inputs/core.ts",
    "./inputs/diff-objs.ts",
    "./inputs/functional.py",
    "./inputs/simplex.py",
    "./inputs/solve.hs",
    "./inputs/layout.hs",
  ];

  let data: Map<string, Map<Algo, BenchResult>> = new Map();
  for(const srcPath of srcPaths) {
    console.log(`>>>>>>>>>>> Benching ${srcPath} <<<<<<<<<<<`);

    const rowData = benchAll(srcPath);
    data.set(srcPath, rowData);
  }

  // ==================== Line Width =====================
  console.log(">>>>>>>>>>> Line width:");
  let lineWidth: (number | string)[][] = [];

  for(const srcPath of srcPaths) {
    let rowData = data.get(srcPath)!;

    const refLineLength = rowData.get("BlocksNS")!.meanLineWidth;

    const row = [
      basename(srcPath),

      rowData.get("Unstyled")!.meanLineWidth,
      rowData.get("Unstyled")!.meanLineWidth / refLineLength,

      rowData.get("L1S")!.meanLineWidth,
      rowData.get("L1S")!.meanLineWidth / refLineLength,

      rowData.get("S-Blocks")!.meanLineWidth,
      rowData.get("S-Blocks")!.meanLineWidth / refLineLength,

      rowData.get("BlocksNS")!.meanLineWidth,
      rowData.get("BlocksNS")!.meanLineWidth / refLineLength,

      rowData.get("Blocks")!.meanLineWidth,
      rowData.get("Blocks")!.meanLineWidth / refLineLength,
    ];

    lineWidth.push(row);
  }

  console.log(fmtTable(
    ["Filename", "Unstyled", "(rel)", "L1S", "(rel)", "S-Blocks", "(rel)", "BlocksNS", "(rel)", "Blocks", "(rel)"],
    lineWidth, forLaTeX, (s, _row, col, atEnd) => {
    if(forLaTeX) {
      if(col % 2 === 0 && col > 0) {
        s = ` (${s})`;
      } else {
        s = `${s}`
      }

      if(atEnd) {
        s += " \\\\";
      } else if(col % 2 === 0 || col === 0) {
        s += " & ";
      }
      return s;
    } else {
      return s + " ";
    }
  }));


  // =================== Mesh Distance ===================
  console.log(">>>>>>>>>>> Mesh distance:");
  let meshDistance: (number | string)[][] = [];

  for(const srcPath of srcPaths) {
    let rowData = data.get(srcPath)!;

    const refHorzMeshDistance = rowData.get("BlocksNS")!.meanHorzMeshDistance;
    const refVertMeshDistance = rowData.get("BlocksNS")!.meanVertMeshDistance;

    const row = [
      basename(srcPath),

      rowData.get("L1S")!.meanHorzMeshDistance,
      rowData.get("L1S")!.meanHorzMeshDistance / refHorzMeshDistance,
      rowData.get("S-Blocks")!.meanHorzMeshDistance,
      rowData.get("S-Blocks")!.meanHorzMeshDistance / refHorzMeshDistance,
      rowData.get("BlocksNS")!.meanHorzMeshDistance,
      rowData.get("BlocksNS")!.meanHorzMeshDistance / refHorzMeshDistance,

      rowData.get("L1S")!.meanVertMeshDistance,
      rowData.get("L1S")!.meanVertMeshDistance / refVertMeshDistance,
      rowData.get("S-Blocks")!.meanVertMeshDistance,
      rowData.get("S-Blocks")!.meanVertMeshDistance / refVertMeshDistance,
      rowData.get("BlocksNS")!.meanVertMeshDistance,
      rowData.get("BlocksNS")!.meanVertMeshDistance / refVertMeshDistance,
    ];

    meshDistance.push(row);
  }

  console.log(fmtTable(
    ["Filename", "L1S", "(rel)", "S-Blocks", "(rel)", "BlocksNS", "(rel)", "L1S", "(rel)", "S-Blocks", "(rel)", "BlocksNS", "(rel)"],
    meshDistance, forLaTeX, (s, _row, col, atEnd) => {
    if(forLaTeX) {
      if(col % 2 === 0 && col > 0) {
        s = ` (${s})`;
      } else {
        s = `${s}`
      }

      if(atEnd) {
        s += " \\\\";
      } else if(col % 2 === 0 || col === 0) {
        s += " & ";
      }
      return s;
    } else {
      return s + " ";
    }
  }));
}

async function main() {
  const inputFileArg = new Argument("<input file>", "The input source file to layout.");
  const algOption = new Option("-a --algorithm <string>", "The algorithm to use for layout.").default("L1S");
  const outOption = new Option("-o --output <string>", "The name of the output file to write.");

  const benchCmd = new Command("bench");
  {
    benchCmd.description("Benchmark a layout algorithm, running it multiple times but emitting no output files.");
    benchCmd.option("-i --iters <number>", "The number of iterations to run.", "10");
    benchCmd.option("--wait", "Block until the program receives a line from STDIN before proceeding.", false)
    benchCmd.addArgument(inputFileArg);
    benchCmd.addOption(algOption);
    benchCmd.action(async (srcPath, opts) => {
      if(opts.wait) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        await rl.question("Waiting for input...");
        rl.close();
      }

      const duration = measureRuntime(srcPath, opts.algorithm, opts.iters);
      console.log(`Finished layout in ${fmtDuration(duration)} (average of ${opts.iters} iterations).`);
    });
  }

  const tableCmd = new Command("gen");
  {
    tableCmd.description("Generate benchmark tables.");
    const latexOption = new Option("--LaTeX", "Format the tables using LaTeX syntax.").default(false);

    const perfCmd = new Command("perfTable");
    perfCmd.addOption(latexOption);
    perfCmd.description("Generate a performance benchmark.");
    perfCmd.action(opt => {
      mkPerfTable(opt.LaTeX);
    });
    tableCmd.addCommand(perfCmd);

    const errorCmd = new Command("errorTables");
    errorCmd.addOption(latexOption);
    errorCmd.description("Generate an error benchmark.");
    errorCmd.action(opt => {
      mkErrorTables(opt.LaTeX);
    });
    tableCmd.addCommand(errorCmd);
  }

  const layoutCmd = new Command("layout");
  {
    layoutCmd.description("Run a layout algorithm, producing an SVG image.")
    layoutCmd.addArgument(inputFileArg);
    layoutCmd.addOption(algOption);
    layoutCmd.addOption(outOption);
    layoutCmd.option("-v --verbose", "Be verbose.", false);
    layoutCmd.option("--noText", "Disable text rendering", false);
    layoutCmd.option("--rTestMesh", "Render the test mesh distance mesh", false);
    layoutCmd.option("--rRefMesh", "Render the reference mesh distance mesh", false);
    layoutCmd.option("--rFragmentBoundingBoxes", "Render fragment bounding boxes", false);
    layoutCmd.action((srcPath, opt) => {
      const ext = extname(srcPath);
      const lang = (() => {
        switch(ext) {
          case ".ts": return TypeScript.typescript;
          case ".py": return Python;
          case ".hs": return Haskell;
          default:
            console.error(`Unknown input file extension (${ext}). Exiting.`);
            exit(1);
        }
      })();

      const base = basename(srcPath, ext);
      if(!opt.output) {
        opt.output = base + ".svg";
      }

      if(opt.verbose) {
        console.log(`Using ${lang.name} parser.`);
      }

      const algoStr = asAlgo(opt.algorithm);
      const measure = mkMeasure("./Inconsolata-Medium.otf");
      const renderSettings: RenderSettings = {
        renderFragmentBoundingBoxes: opt.rFragmentBoundingBoxes,
        renderTestMesh: opt.rTestMesh,
        renderRefMesh: opt.rRefMesh,
        renderText: !opt.noText
      };
      const result = bench(srcPath, algoStr, measure, renderSettings);

      if(opt.verbose) {
        console.log("mean horz mesh distance: ", result.meanHorzMeshDistance);
        console.log("mean vert mesh distance: ", result.meanVertMeshDistance);
        console.log("mean line width: ", result.meanLineWidth);
        console.log("number of fragments: ", result.nFragments);
        console.log("duration: ", fmtDuration(result.duration));
      }

      const svg = rb.toSVG(result.renderable, 10);
      fs.writeFileSync(opt.output, svg);
    });
  }

  program
    .addCommand(benchCmd)
    .addCommand(tableCmd)
    .addCommand(layoutCmd);

  program.parse();
}

main();
