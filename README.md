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

Navigate to `bench`, and run `tsx index.ts` to see what commands are available. The script is able to `bench`mark a layout algorithm, running it repeatedly and reporting the mean running time. It can also `gen`erate the tables presented in the paper (two for error, and one for running time). There's also a `layout` command which runs one of the layout algorithms on an input file and produces an SVG image of the resulting layout.

The benchmark suite is composed of 6 source files which are hosted on GitHub. Here, they are listed along with the URL from which they were retrieved:
- `simplex.py`: [link](https://github.com/TheAlgorithms/Python/blob/master/linear_programming/simplex.py)
- `core.ts`: [link](https://raw.githubusercontent.com/microsoft/TypeScript/refs/heads/main/src/compiler/core.ts)
- `diff-objs.ts` [link](https://github.com/ramda/ramda/wiki/Cookbook)
- `functional.py` [link](https://github.com/pytorch/pytorch/blob/a72b4eb80604f5f7997c7695cc8a63ca3f3c8ff1/torch/functional.py)
- `solve.hs` [link](https://gitlab.haskell.org/ghc/ghc/-/blob/master/compiler/GHC/Tc/Solver/Solve.hs?ref_type=heads)
- `layout.hs` [link](https://github.com/sbcohen2000/breaking-spaces/blob/main/Layout.hs)

### Dependencies

The below is a list of each dependency, and why each is required.
There is one run-time dependency of the library:
- **@sbcohen/containers** implements some useful container datastructures. In particular, we care about the `IntervalTree`.

The remaining dependencies are just needed for development:
- **jest** is used for unit testing.
- **pixelmatch** is used by the unit tests to check if two images have the same pixels, and if not, to generate a "diff" image.
- **sharp** is used to convert SVGs to PNGs in tests.
- **ts-jest** allows jest tests to be written in TypeScript as opposed to JavaScript.
- **tsx** allows `node` to run TypeScript source files.
- **typescript** is the TypeScript language compiler.

The demo program additionally depends on **webpack** and friends to generate a bundle.
