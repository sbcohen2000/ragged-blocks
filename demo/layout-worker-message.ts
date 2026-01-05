import * as rb from "ragged-blocks";

export type RenderSettings = {
  renderDistanceMesh?: boolean;
  renderFragmentBoundingBoxes?: boolean;
};

export type WorkerMsg = {
  type: "begin";
  layoutTree: rb.LayoutTree<void, rb.WithMeasurements>;
  algoName: rb.AlgorithmName;
  algoSettings: rb.AnySettings;
  renderSettings: RenderSettings;
};

export type WorkerReponse = {
  status: "success";
  svgSrc: string;
  /**
   * The time it took to perform layout, in milliseconds.
   */
  duration: number;
} | {
  status: "failure";
  error: Error;
};
