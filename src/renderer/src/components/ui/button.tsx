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
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5bd6] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && cn('bg-[#5b5bd6] text-white shadow-sm shadow-[#5b5bd6]/25 hover:bg-[#4646bc] hover:shadow-md hover:shadow-[#5b5bd6]/25 active:translate-y-0', liftOnHover && 'hover:-translate-y-px'),
        variant === 'ghost' && 'text-[#667085] hover:bg-[#eeefff] hover:text-[#4646bc]',
        variant === 'outline' && 'border border-[#dfe3ee] bg-white text-[#475467] shadow-sm hover:border-[#c9cdf5] hover:bg-[#f8f8ff] hover:text-[#4646bc]',
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
