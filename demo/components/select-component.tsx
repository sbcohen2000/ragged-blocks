import { ChangeEvent } from "react";

interface SelectProps<S extends string> {
  /**
   * The currently selected option.
   */
  selectedOption?: S;
  /**
   * The list of options that the user can select from.
   */
  options: S[];
  /**
   * Called when the user selects an option.
   */
  onSelectionChanged?: (option: S) => void;
}

export default function Select<S extends string>(props: SelectProps<S>) {
  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    if(props.onSelectionChanged) {
      props.onSelectionChanged(e.target.value as S);
    }
  }

  return (
    <select onChange={onChange} value={props.selectedOption}>
      {
        props.options.map(opt =>
          (<option key={opt} value={opt}>{opt}</option>)
        )
      }
    </select>
  );
}
