import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  label?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      disabled = false,
      error,
      className,
      label,
      required = false,
      leftIcon,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(!isOpen);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      } else if (event.key === 'ArrowDown' && isOpen) {
        event.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        const nextOption = options[nextIndex];
        if (nextOption && !nextOption.disabled) {
          onChange?.(nextOption.value);
        }
      } else if (event.key === 'ArrowUp' && isOpen) {
        event.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        const prevOption = options[prevIndex];
        if (prevOption && !prevOption.disabled) {
          onChange?.(prevOption.value);
        }
      }
    };

    const handleOptionClick = (optionValue: string) => {
      if (!disabled) {
        onChange?.(optionValue);
        setIsOpen(false);
      }
    };

    return (
      <div className={cn('w-full', className)} ref={containerRef}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          <button
            ref={ref}
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={cn(
              'relative w-full bg-white dark:bg-gray-800 border rounded-md shadow-sm pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
              leftIcon ? 'pl-10' : 'pl-3',
              error
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600',
              disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900'
            )}
          >
            {leftIcon && (
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                {leftIcon}
              </span>
            )}
            <span
              className={cn(
                'block truncate',
                !selectedOption && 'text-gray-400 dark:text-gray-500'
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-gray-400 transition-transform',
                  isOpen && 'transform rotate-180'
                )}
              />
            </span>
          </button>

          {isOpen && !disabled && (
            <ul
              className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm animate-slideDown"
              role="listbox"
            >
              {options.map((option) => (
                <li
                  key={option.value}
                  onClick={() => !option.disabled && handleOptionClick(option.value)}
                  className={cn(
                    'cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors',
                    option.value === value && 'bg-primary-50 dark:bg-gray-700',
                    option.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  )}
                  role="option"
                  aria-selected={option.value === value}
                >
                  <span
                    className={cn(
                      'block truncate',
                      option.value === value ? 'font-semibold text-primary-700 dark:text-primary-400' : 'font-normal text-gray-900 dark:text-gray-100'
                    )}
                  >
                    {option.label}
                  </span>
                  {option.value === value && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary-600 dark:text-primary-400">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
