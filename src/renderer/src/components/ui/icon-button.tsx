import { forwardRef, useCallback, useState, type ComponentProps } from 'react'
import { Button, type ButtonProps } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  label: string
  shortcut?: string
  tooltipSide?: ComponentProps<typeof TooltipContent>['side']
  tooltipAlign?: ComponentProps<typeof TooltipContent>['align']
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, className = '', tooltipSide, tooltipAlign, ...props }, ref
) {
  const [tooltipBoundary, setTooltipBoundary] = useState<Element | null>(null)
  const attachButton = useCallback((button: HTMLButtonElement | null) => {
    // The app shell starts below the native title bar and spans the usable window.
    if (button) setTooltipBoundary(button.closest('.app-shell'))
    if (typeof ref === 'function') return ref(button)
    if (ref) ref.current = button
  }, [ref])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={attachButton} variant="ghost" size="icon" liftOnHover={false}
          className={`ghost-icon app-no-drag ${className}`} aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent className="app-no-drag" side={tooltipSide} align={tooltipAlign} collisionBoundary={tooltipBoundary} collisionPadding={8} avoidCollisions>{label}{shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}</TooltipContent>
    </Tooltip>
  )
})
