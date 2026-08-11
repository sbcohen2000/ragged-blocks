import * as React from "react";
import WithPointerEvents from "../hooks/with-pointer-events";
import rightArrowUrl from "./right-arrow.svg";

import * as styles from "./number-picker.module.css";

export type NumberPickerProps = {
  n: number,
  min?: number,
  max?: number,
  initialPlace?: number,
  minPlace?: number,
  maxPlace?: number,
  onChanged?: (n: number) => void,
  style?: React.CSSProperties,
};

function clamp(min: number, x: number, max: number): number {
  return Math.max(min, Math.min(x, max));
}

/**
 * Pad the string `s` with zeros until it has length `n`.
 */
function padFront(s: string, n: number): string {
  let out = s;
  for(let i = 0; i < Math.max(n - s.length, 0); ++i) {
    out = '0' + out;
  }
  return out;
}

function format(n: number, place: number) {
  let out;
  if(place < 0) {
    out = n.toFixed(-place);
  } else {
    out = padFront(n.toFixed(0), place + 1);
  }
  if(n >= 0) {
    // Add an invisible minus sign in front of positive numbers so
    // that things align better.
    out = " " + out;
  }
  return out;
}

export default function NumberPicker(props: NumberPickerProps) {
  const min = props.min ?? -Infinity;
  const max = props.max ?? Infinity;
  const minPlace = props.minPlace ?? -2;
  const maxPlace = props.maxPlace ?? 2;

  const ref = React.useRef<HTMLSpanElement | null>(null);
  const lastValue = React.useRef(props.n);
  const lastClientX = React.useRef(0);

  const initialPlace = props.initialPlace ?? -1;
  const [place, setPlace] = React.useState<number>(clamp(minPlace, initialPlace, maxPlace));

  const sensitivity = Math.pow(10, place);

  WithPointerEvents({
    ref,

    onPointerMove(e: PointerEvent) {
      e.preventDefault();
      const dOfs = Math.floor(e.clientX - lastClientX.current);
      if(props.onChanged) {
        props.onChanged(clamp(min, lastValue.current + dOfs * sensitivity, max));
      }
    },

    onPointerDown(e: PointerEvent) {
      e.preventDefault();
      lastClientX.current = e.clientX;
    },

    onPointerUp(e: PointerEvent) {
      e.preventDefault();
      const dOfs = Math.floor(e.clientX - lastClientX.current);
      lastValue.current = clamp(min, lastValue.current + dOfs * sensitivity, max);
    }
  });

  return (
    <div style={props.style ?? {}} className={styles.numberPicker}>
      <img
        onClick={() => setPlace(p => clamp(minPlace, p + 1, maxPlace))}
        className={styles.glyph
          + " " + styles.left
          + " " + (place === maxPlace ? styles.disabled : "")} src={rightArrowUrl}></img>
      <span className={styles.number} ref={ref}>
        {format(props.n, place)}
      </span>
      <img
        onClick={() => setPlace(p => clamp(minPlace, p - 1, maxPlace))}
        className={styles.glyph
          + " " + styles.right
          + " " + (place === minPlace ? styles.disabled : "")}
        src={rightArrowUrl}></img>
    </div>
  );
}
