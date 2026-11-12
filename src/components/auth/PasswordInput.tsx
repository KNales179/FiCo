import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { IconEye, IconEyeOff } from '../icons'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * A password field with a show / hide eye on the right. Everything else
 * (value, autoComplete, minLength…) passes straight through to the input.
 */
const PasswordInput = ({ className, ...rest }: Props) => {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative block">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={['input pr-11', className].filter(Boolean).join(' ')}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Keep focus (and the caret) in the field while toggling.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[inherit] text-muted transition-colors hover:text-ink focus-visible:text-brand focus-visible:outline-none"
      >
        {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </span>
  )
}

export default PasswordInput
