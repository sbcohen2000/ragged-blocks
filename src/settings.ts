export interface LayoutSettings {
  /**
   * The ideal distance between two baselines of text, in pixels.
   *
   * The layout algorithm will not guarantee this line spacing, since
   * the exact spacing between two lines is dependent on the amount of
   * padding applied to the fragments on the lines. However, if the
   * padding between the lines is less than `idealLeading`, the space
   * between the baselines will be `idealLeading`.
   */
  idealLeading: number;
}
