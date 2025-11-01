import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + 8;
          break;
      }

      // Keep tooltip within viewport
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
      }

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const childWithRef = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: () => {
      showTooltip();
      children.props.onMouseEnter?.();
    },
    onMouseLeave: () => {
      hideTooltip();
      children.props.onMouseLeave?.();
    },
    onFocus: () => {
      showTooltip();
      children.props.onFocus?.();
    },
    onBlur: () => {
      hideTooltip();
      children.props.onBlur?.();
    },
  });

  const tooltipElement = isVisible ? (
    <div
      ref={tooltipRef}
      role="tooltip"
      className={cn(
        "fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg animate-fadeIn pointer-events-none",
        "after:content-[''] after:absolute after:border-4 after:border-transparent",
        {
          "after:bottom-full after:left-1/2 after:-ml-1 after:border-b-gray-900 dark:after:border-b-gray-700": position === 'bottom',
          "after:top-full after:left-1/2 after:-ml-1 after:border-t-gray-900 dark:after:border-t-gray-700": position === 'top',
          "after:right-full after:top-1/2 after:-mt-1 after:border-r-gray-900 dark:after:border-r-gray-700": position === 'right',
          "after:left-full after:top-1/2 after:-mt-1 after:border-l-gray-900 dark:after:border-l-gray-700": position === 'left',
        },
        className
      )}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
    >
      {content}
    </div>
  ) : null;

  return (
    <>
      {childWithRef}
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip };
export default Tooltip;

