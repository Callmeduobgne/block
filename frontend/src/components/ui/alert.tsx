import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = 'info',
      title,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const icons = {
      info: <Info className="h-5 w-5" />,
      success: <CheckCircle className="h-5 w-5" />,
      warning: <AlertCircle className="h-5 w-5" />,
      error: <XCircle className="h-5 w-5" />,
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative rounded-lg border p-4 transition-all',
          {
            'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200':
              variant === 'info',
            'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200':
              variant === 'success',
            'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200':
              variant === 'warning',
            'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200':
              variant === 'error',
          },
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn('flex-shrink-0', {
              'text-blue-600 dark:text-blue-400': variant === 'info',
              'text-green-600 dark:text-green-400': variant === 'success',
              'text-yellow-600 dark:text-yellow-400': variant === 'warning',
              'text-red-600 dark:text-red-400': variant === 'error',
            })}
          >
            {icons[variant]}
          </div>
          <div className="flex-1">
            {title && (
              <h5 className="mb-1 font-medium leading-none tracking-tight">
                {title}
              </h5>
            )}
            <div className="text-sm opacity-90">{children}</div>
          </div>
          {dismissible && (
            <button
              onClick={onDismiss}
              className={cn(
                'flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2',
                {
                  'focus:ring-blue-500': variant === 'info',
                  'focus:ring-green-500': variant === 'success',
                  'focus:ring-yellow-500': variant === 'warning',
                  'focus:ring-red-500': variant === 'error',
                }
              )}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };
export default Alert;

