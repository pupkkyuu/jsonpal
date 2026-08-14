import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-sky-500 text-white shadow-sm hover:bg-sky-400',
        variant === 'ghost' && 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50',
        variant === 'outline' && 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50',
        size === 'default' && 'h-8 px-3',
        size === 'icon' && 'h-8 w-8',
        className
      )}
      {...props}
    />
  )
)

Button.displayName = 'Button'

export { Button }
