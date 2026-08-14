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
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-700',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
        variant === 'outline' && 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950',
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
