import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md',
    removable = false,
    onRemove,
    children,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium transition-colors",
          {
            // Variants
            "bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200": variant === 'default',
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200": variant === 'success',
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200": variant === 'warning',
            "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200": variant === 'error',
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200": variant === 'info',
            "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200": variant === 'secondary',
          },
          {
            // Sizes
            "px-2 py-0.5 text-xs": size === 'sm',
            "px-2.5 py-0.5 text-sm": size === 'md',
            "px-3 py-1 text-base": size === 'lg',
          },
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {removable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors focus:outline-none"
            aria-label="Remove"
          >
            <X className={cn(
              size === 'sm' && 'h-3 w-3',
              size === 'md' && 'h-3.5 w-3.5',
              size === 'lg' && 'h-4 w-4',
            )} />
          </button>
        )}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export default Badge;

