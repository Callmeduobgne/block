import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  showCharCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      containerClassName,
      required,
      disabled,
      showCharCount = false,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const charCount = value ? String(value).length : 0;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md border bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-900 transition-colors resize-y',
            error
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus-visible:ring-primary-500',
            className
          )}
          ref={ref}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          value={value}
          {...props}
        />

        <div className="flex items-center justify-between mt-1">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {!error && helperText && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
            )}
          </div>
          {showCharCount && maxLength && (
            <p
              className={cn(
                'text-xs text-gray-500 dark:text-gray-400',
                charCount > maxLength * 0.9 && 'text-orange-600',
                charCount === maxLength && 'text-red-600 font-medium'
              )}
            >
              {charCount} / {maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
export default Textarea;
