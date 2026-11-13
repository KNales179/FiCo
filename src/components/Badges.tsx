import { IconAward, IconShield, IconSparkles } from './icons'

/** Fico badges a person can carry (more planned: VIP, VIP+, Business…). */
const LOOK: Record<string, { label: string; icon: typeof IconAward; tone: string }> = {
  FICO_OWNER: { label: 'Fico Owner', icon: IconAward, tone: 'bg-gradient-to-r from-amber-400/25 to-brand/20 text-ink ring-1 ring-amber-400/50' },
  FICO_ADMIN: { label: 'Fico Admin', icon: IconShield, tone: 'bg-brand/15 text-brand ring-1 ring-brand/30' },
  BETA_TESTER: { label: 'Beta tester', icon: IconSparkles, tone: 'bg-success/12 text-success ring-1 ring-success/30' },
}

/** A row of small badge pills (renders nothing when there are none). */
const Badges = ({ badges, size = 'sm' }: { badges?: string[] | null; size?: 'sm' | 'xs' }) => {
  const list = (badges ?? []).filter((b) => LOOK[b])
  if (list.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {list.map((b) => {
        const { label, icon: Icon, tone } = LOOK[b]
        return (
          <span
            key={b}
            className={`inline-flex items-center gap-1 rounded-full font-semibold ${tone} ${
              size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'
            }`}
          >
            <Icon size={size === 'xs' ? 10 : 12} />
            {label}
          </span>
        )
      })}
    </span>
  )
}

export default Badges
