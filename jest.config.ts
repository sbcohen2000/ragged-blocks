import { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  roots: [
    "./test/"
  ],
  testRegex: ".*test\\.ts",
};

export default jestConfig;
