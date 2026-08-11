import { Ref } from "react";
import NumberPicker from "./number-picker-component";
import * as styles from "./labeled-checkbox.module.css";

export interface LabeledNumberPickerProps {
  /**
   * The label of the number picker.
   */
  label?: string;
  /**
   * The current numeric value.
   */
  value: number;
  /**
   * A function which is called when the user changes the value.
   */
  onChange?: (newValue: number) => void;
  /**
   * The minimum allowed value.
   */
  min?: number;
  /**
   * The maximum allowed value.
   */
  max?: number;
  /**
   * The initial decimal place. See `NumberPicker`.
   */
  initialPlace?: number;
  /**
   * A reference to the root of this component.
   */
  ref?: Ref<HTMLDivElement>;
}

export default function LabeledNumberPicker(props: LabeledNumberPickerProps) {
  return (
    <div ref={props.ref} className={styles.container}>
      <NumberPicker
        n={props.value}
        min={props.min}
        max={props.max}
        initialPlace={props.initialPlace ?? 0}
        onChanged={props.onChange}
      />
      <span>
        {props.label ?? "number"}
      </span>
    </div>
  );
}
