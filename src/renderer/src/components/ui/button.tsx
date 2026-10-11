import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'icon'
  liftOnHover?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', liftOnHover = true, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && cn('bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/25 hover:bg-[var(--accent)]/90 hover:shadow-md hover:shadow-[var(--accent)]/25 active:translate-y-0', liftOnHover && 'hover:-translate-y-px'),
        variant === 'ghost' && 'text-[var(--icon-color)] hover:bg-[var(--button-hover)] active:bg-[var(--button-active)]',
        variant === 'outline' && 'border border-[var(--capsule-border)] bg-[var(--capsule-bg)] text-[var(--text-primary)] shadow-sm hover:border-[var(--capsule-hover-border)] hover:bg-[var(--bg-capsule-hover)] hover:text-[var(--text-primary)] active:bg-[var(--capsule-active-bg)] active:border-[var(--capsule-active-border)]',
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
