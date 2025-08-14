export abstract class SettingView {
  private _key: string;
  private _obj: ViewSettings;
  private _description: string;

  constructor(key: string, obj: any, description: string) {
    this._key = key;
    this._obj = obj;
    this._description = description;
  }

  /**
   * If this setting is a toggle, return the `ToggleSettingView`, or
   * `null` if this setting wasn't a toggle.
   */
  asToggle(): ToggleSettingView | null {
    return null;
  }

  /**
   * If this setting is a number, return the `NumberSettingView`, or
   * `null` if this setting wasn't a number.
   */
  asNumber(): NumberSettingView | null {
    return null;
  }

  get description(): string {
    return this._description;
  }

  get key(): string {
    return this._key;
  }

  protected get _value(): any {
    // Note: this is safe because we cannot construct a settings view
    // without knowing that `this._key` is a valid key of
    // `this._obj`. See type signatures of `new` below.
    return (this._obj as any)[this._key];
  }

  protected _update(v: any): ViewSettings {
    const newSettings = this._obj.clone();
    return Object.defineProperty(newSettings, this._key, { value: v });
  }
}

export class ToggleSettingView extends SettingView {
  private constructor(key: any, obj: any, description: string) {
    super(key, obj, description);
  }

  get value(): boolean {
    return this._value;
  }

  update(v: boolean): ViewSettings {
    return this._update(v);
  }

  static new<O extends ViewSettings & Pick<{ [key: string]: boolean }, K>, K extends string>(key: K, obj: O, description: string): ToggleSettingView {
    return new ToggleSettingView(key, obj, description);
  }

  asToggle(): ToggleSettingView {
    return this;
  }
}

export class NumberSettingView extends SettingView {
  private constructor(key: any, obj: any, description: string) {
    super(key, obj, description);
  }

  get value(): number {
    return this._value;
  }

  update(v: number): ViewSettings {
    return this._update(v);
  }

  static new<O extends ViewSettings & Pick<{ [key: string]: number }, K>, K extends string>(key: K, obj: O, description: string): NumberSettingView {
    return new NumberSettingView(key, obj, description);
  }

  asNumber(): NumberSettingView {
    return this;
  }
}

/**
 * Implemented on types which can produce a view over thier settings,
 * providing a mechanism to get the description of each setting, and
 * update the setting.
 */
export interface ViewSettings {
  viewSettings(): SettingView[];
  clone(): ViewSettings;
}
