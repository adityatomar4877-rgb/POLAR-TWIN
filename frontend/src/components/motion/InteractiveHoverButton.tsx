import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type InteractiveHoverButtonVariant = 'cyan' | 'blue' | 'emerald' | 'hazard' | 'dark' | 'outline';

export interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  variant?: InteractiveHoverButtonVariant;
  icon?: LucideIcon;
  iconSize?: number;
  loading?: boolean;
}

const variantStyles: Record<
  InteractiveHoverButtonVariant,
  {
    btn: string;
    dot: string;
    textHover: string;
  }
> = {
  cyan: {
    btn: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 hover:border-cyan-500',
    dot: 'bg-cyan-500',
    textHover: 'text-white',
  },
  blue: {
    btn: 'border-blue-500/30 bg-blue-500/10 text-blue-700 hover:border-blue-500',
    dot: 'bg-blue-600',
    textHover: 'text-white',
  },
  emerald: {
    btn: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500',
    dot: 'bg-emerald-500',
    textHover: 'text-white',
  },
  hazard: {
    btn: 'border-red-500/30 bg-red-500/10 text-red-600 hover:border-red-500',
    dot: 'bg-red-600',
    textHover: 'text-white',
  },
  dark: {
    btn: 'border-slate-300 bg-white text-slate-800 hover:border-slate-800 shadow-2xs',
    dot: 'bg-slate-900',
    textHover: 'text-white',
  },
  outline: {
    btn: 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-400',
    dot: 'bg-blue-600',
    textHover: 'text-white',
  },
};

export const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(
  (
    {
      text = 'Action',
      children,
      variant = 'cyan',
      icon: Icon = ArrowRight,
      iconSize = 15,
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const label = text || (typeof children === 'string' ? children : 'Action');
    const styles = variantStyles[variant] || variantStyles.cyan;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'group relative inline-flex items-center justify-center cursor-pointer overflow-hidden rounded-full border px-6 py-2.5 text-center text-xs font-bold font-mono tracking-wider transition-all duration-300 select-none disabled:cursor-not-allowed disabled:opacity-50',
          styles.btn,
          className
        )}
        {...props}
      >
        {/* Initial text sliding right on hover */}
        <span className="relative z-10 inline-flex items-center gap-1.5 translate-x-0 transition-all duration-300 group-hover:translate-x-8 group-hover:opacity-0">
          {children || label}
        </span>

        {/* Hover text + arrow sliding in from left */}
        <div
          className={clsx(
            'absolute inset-0 z-20 flex h-full w-full -translate-x-8 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100',
            styles.textHover
          )}
        >
          <span>{children || label}</span>
          <Icon size={iconSize} className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
        </div>

        {/* Expanding dot bubble effect */}
        <div
          className={clsx(
            'pointer-events-none absolute left-[15%] top-[45%] h-2 w-2 scale-100 rounded-full transition-all duration-500 ease-out group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[2.4]',
            styles.dot
          )}
        />
      </button>
    );
  }
);

InteractiveHoverButton.displayName = 'InteractiveHoverButton';

export default InteractiveHoverButton;
