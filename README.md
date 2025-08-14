# Ragged Blocks

This is the source repository accompanying our paper, [Ragged Blocks: Rendering Structured Text With Style](https://arxiv.org/pdf/2507.06460). It contains the implementation of every algorithm we benchmarked in the paper, as well as a [demo application](https://sbcohen2000.github.io/ragged-blocks/) that demonstrates the algorithms on layout trees of the reader's choice.

### Building
Simply run `tsc` in the root of the repository, or `npm run build`.

### Running the Demo
First, ensure that the library has been built by running `tsc` in the root of the repository.

Then, navigate to the `demo` directory in the root of the repository, and run `webpack serve`.
Now, open `localhost:8080` in a web browser.
The page will be refreshed each time a modification is made to the demo code.

If you want the page to be refreshed when the library code is changed too, you can run `tsc --watch` in the root of the repository in a different terminal.

### Running the Tests
Just run `npm test`.

`jest` is used for unit tests, but we can't invoke `jest` by iself because we need the underlying `node` instance to be run with `--experimental-vm-modules` (which, in turn, is required because we use top-level `await` in the tests which need to load external image files).
See `package.json` for the full command that's run when you run `npm test`.

### Running a Particular Test

e.g.
```
node --no-warnings --experimental-vm-modules node_modules/.bin/jest -t atom-newline-atom
```
Would run the single test called `atom-newline-atom`.

### Running the Benchmarks

Navigate to `bench`, and run `tsx index.ts`. By default, the benchmarking script expects a `-i` flag and a source file (either TypeScript, Python, or Haskell). The script will parse and layout the source file, producing an svg with the same basename as the input. The name of the output file can be specified with `-o`.

Passing `--mkErrorTables` will benchmark all of the source files in `bench/inputs`, and produce two tables which report the calculated line width and mesh distance of each file under each algorithm.

Passing `--mkPerfTable` will benchmark the running time of algorithms L1P and L1S on every example in `bench/inputs` and produce a table with the results.

The benchmark suite is composed of 6 source files which are hosted on GitHub. Here, they are listed along with the URL from which they were retrieved:
- `simplex.py`: [link](https://github.com/TheAlgorithms/Python/blob/master/linear_programming/simplex.py)
- `core.ts`: [link](https://raw.githubusercontent.com/microsoft/TypeScript/refs/heads/main/src/compiler/core.ts)
- `diff-objs.ts` [link](https://github.com/ramda/ramda/wiki/Cookbook)
- `functional.py` [link](https://github.com/pytorch/pytorch/blob/a72b4eb80604f5f7997c7695cc8a63ca3f3c8ff1/torch/functional.py)
- `solve.hs` [link](https://gitlab.haskell.org/ghc/ghc/-/blob/master/compiler/GHC/Tc/Solver/Solve.hs?ref_type=heads)
- `layout.hs` [link](https://github.com/sbcohen2000/breaking-spaces/blob/main/Layout.hs)

### Dependencies

The below is a list of each dependency, and why each is required.
There are two run-time dependency of the library:
- **@sbcohen/containers** implements some useful container datastructures. In particular, we care about the `IntervalTree`.

The remaining dependencies are just needed for development:
- **jest** is used for unit testing.
- **pixelmatch** is used by the unit tests to check if two images have the same pixels, and if not, to generate a "diff" image.
- **sharp** is used to convert SVGs to PNGs in tests.
- **ts-jest** allows jest tests to be written in TypeScript as opposed to JavaScript.
- **tsx** allows `node` to run TypeScript source files.

The demo program additionally depends on **webpack** and friends to generate a bundle.
