import type { ReactNode } from 'react';

export const fieldClassName =
  'mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900';

export const secondaryButtonClassName =
  'rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50';

export const dangerTextButtonClassName =
  'text-xs font-semibold text-rose-600 hover:text-rose-700';

export const cardClassName = 'rounded-md border border-gray-200 p-3';

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold text-gray-700">{children}</label>;
}

export function EmptyMessage({ children }: { children: ReactNode }) {
  return <div className="mt-2 text-xs text-gray-500">{children}</div>;
}

export function TextInputField(props: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  const {
    label,
    value,
    onChange,
    placeholder,
    className = fieldClassName,
    type = 'text',
  } = props;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        className={className}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TextAreaField(props: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const { label, value, onChange, placeholder, rows = 3 } = props;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        className={fieldClassName}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
