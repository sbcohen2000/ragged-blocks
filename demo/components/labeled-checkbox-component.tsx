import { Ref } from "react";
import * as styles from "./labeled-checkbox.module.css";

export interface LabeledCheckboxProps {
  /**
   * The label of the checkbox.
   */
  label?: string;
  /**
   * `true` if the checkbox is currently checked, and `false`
   * otherwise.
   */
  checked?: boolean;
  /**
   * A function which is called when the user clicked on the checkbox.
   */
  onChange?: (newState: boolean) => void;
  /**
   * A reference to the root of this component.
   */
  ref?: Ref<HTMLDivElement>;
}

export default function LabeledCheckbox(props: LabeledCheckboxProps) {
  function onChange() {
    if(props.onChange) {
      props.onChange(!(props.checked ?? false));
    }
  }

  return (
    <div ref={props.ref} className={styles.container}>
      <input checked={props.checked ?? false} onChange={onChange} type="checkbox"/>
      <span>
        {props.label ?? "checkbox"}
      </span>
    </div>
  );
}
