/**
 * A circle draws itself, then a check inside it, then it fades away —
 * small, inline, next to a card's title. Never covers anything. With
 * reduced motion it just shows the check (see .success-check in index.css).
 */
const SuccessCheck = ({ label = 'Done' }: { label?: string }) => (
  <span className="success-check" role="status" aria-label={label}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle className="success-check-circle" cx="12" cy="12" r="10" />
      <path className="success-check-tick" d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  </span>
)

export default SuccessCheck
