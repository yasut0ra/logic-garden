'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="choice-field">
      <label id={`${id}-label`} className="eyebrow">
        {label}
      </label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next as T);
        }}
        disabled={disabled}
        items={options}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={`${id}-label`}
          className="garden-select"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="garden-options"
          align="start"
          alignItemWithTrigger={false}
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
