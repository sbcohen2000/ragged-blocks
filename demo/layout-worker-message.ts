import * as rb from "ragged-blocks";

export type RenderSettings = {
  renderDistanceMesh?: boolean;
  renderFragmentBoundingBoxes?: boolean;
};

export type WorkerMsg<A extends rb.AlgorithmName> = {
  type: "begin";
  layoutTree: rb.LayoutTree<rb.WithMeasurements>;
  algoName: A;
  algoSettings: rb.Settings<A>;
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
