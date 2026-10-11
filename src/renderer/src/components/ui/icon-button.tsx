import { forwardRef } from 'react'
import { Button, type ButtonProps } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  label: string
  shortcut?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, className = '', ...props }, ref
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} variant="ghost" size="icon" liftOnHover={false}
          className={`ghost-icon app-no-drag ${className}`} aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent className="app-no-drag">{label}{shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}</TooltipContent>
    </Tooltip>
  )
})
