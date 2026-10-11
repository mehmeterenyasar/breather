import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';

/**
 * The controls the settings page is built from.
 *
 * There is no save button: a change is written the moment it is made. So these
 * take a value and report a change upwards, and none of them keeps a draft of
 * its own.
 *
 * Every control has a visible label bound through `label`/`id`, and its hint is
 * read out via `aria-describedby`.
 */

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  const id = useId();

  return (
    <div class="field-row">
      <label class="field-row__text" for={id}>
        <span class="field-row__label">{label}</span>
        {hint && <span class="field-row__hint">{hint}</span>}
      </label>
      <span class="field-row__control">
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          class={checked ? 'switch switch--on' : 'switch'}
          disabled={disabled}
          onClick={() => onChange(!checked)}
        >
          <span class="switch__knob" />
        </button>
      </span>
    </div>
  );
}

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
  hint?: string;
  onChange: (value: number) => void;
}

/** Number input with steppers; typing into it works too. */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  suffix,
  label,
  hint,
  onChange,
}: NumberFieldProps) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div class="field-row">
      <label class="field-row__text" for={id}>
        <span class="field-row__label">{label}</span>
        {hint && <span class="field-row__hint">{hint}</span>}
      </label>

      <span class="field-row__control stepper">
        <button
          type="button"
          class="stepper__btn"
          aria-label="−"
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <input
          id={id}
          class="stepper__input num"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.currentTarget.value)))}
        />
        {suffix && <span class="stepper__suffix">{suffix}</span>}
        <button
          type="button"
          class="stepper__btn"
          aria-label="+"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </span>
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  label: string;
  hint?: string;
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  value,
  options,
  label,
  hint,
  onChange,
}: SelectFieldProps<T>) {
  const id = useId();

  return (
    <div class="field-row">
      <label class="field-row__text" for={id}>
        <span class="field-row__label">{label}</span>
        {hint && <span class="field-row__hint">{hint}</span>}
      </label>
      <span class="field-row__control">
        <select
          id={id}
          class="field"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function Slider({ value, min, max, step, label, format, onChange }: SliderProps) {
  const id = useId();

  return (
    <div class="field-row">
      <label class="field-row__text" for={id}>
        <span class="field-row__label">{label}</span>
      </label>
      <span class="field-row__control slider">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={(event) => onChange(Number(event.currentTarget.value))}
        />
        <span class="slider__value num">{format(value)}</span>
      </span>
    </div>
  );
}

export function Group({ title, children }: { title?: string; children: ComponentChildren }) {
  return (
    <section class="group">
      {title && <h2 class="group__title">{title}</h2>}
      <div class="group__body">{children}</div>
    </section>
  );
}

/** Collapsed by default, so the common settings stay at the top. */
export function Advanced({ label, children }: { label: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);

  return (
    <div class={open ? 'advanced advanced--open' : 'advanced'}>
      <button
        type="button"
        class="advanced__toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Chevron />
        {label}
      </button>
      {open && <div class="advanced__body">{children}</div>}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
