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
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-[#0078d4] text-white shadow-sm hover:bg-[#006cbe]',
        variant === 'ghost' && 'text-[#616161] hover:bg-[#e8e8e8] hover:text-[#333333]',
        variant === 'outline' && 'border border-[#e5e5e5] bg-white text-[#616161] hover:bg-[#e8e8e8] hover:text-[#333333]',
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
