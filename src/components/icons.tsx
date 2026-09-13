import type { SVGProps } from 'react'

/**
 * A small inline SVG icon set — Fico's standing direction is a real icon
 * set, never emoji, everywhere an icon is used (navigation included). Each
 * icon is a thin wrapper around a 24x24 stroke path so they all share one
 * visual language (rounded joins, currentColor, no fill) and can be sized
 * and colored with ordinary Tailwind classes, no icon font or CDN needed.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const Icon = ({
  size = 20,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
)

export const IconHome = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-6h5v6" />
  </Icon>
)

export const IconCart = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.2l2 12.2a2 2 0 0 0 2 1.7h8.3a2 2 0 0 0 2-1.6l1.4-7.3H6" />
  </Icon>
)

export const IconReceipt = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h12v18l-2.5-1.5L13 21l-1.5-1.5L10 21l-2.5-1.5L6 21Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Icon>
)

export const IconCalendar = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)

export const IconChart = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20V10M11 20V4M18 20v-7" />
    <path d="M2.5 20h19" />
  </Icon>
)

export const IconTag = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6.1-6.1a2 2 0 0 0 0-2.8l-8-8a2 2 0 0 0-1.5-.5Z" />
    <circle cx="8.2" cy="8.2" r="1.3" />
  </Icon>
)

export const IconUsers = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.8 19c.7-3 3-4.8 6.2-4.8s5.5 1.8 6.2 4.8" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.1M21.2 19c-.5-2.3-1.8-3.9-3.8-4.6" />
  </Icon>
)

export const IconUserPlus = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.8 19c.7-3 3-4.8 6.2-4.8s5.5 1.8 6.2 4.8" />
    <path d="M18.5 5.5v6M15.5 8.5h6" />
  </Icon>
)

export const IconClock = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const IconUserCircle = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="9.8" r="3" />
    <path d="M5.7 18.5c1.1-2.6 3.3-4 6.3-4s5.2 1.4 6.3 4" />
  </Icon>
)

export const IconSettings = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2" />
  </Icon>
)

export const IconMessage = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 5h16v11H8.5L4 19.5Z" />
  </Icon>
)

export const IconShield = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" />
    <path d="M9 12l2 2 4-4.2" />
  </Icon>
)

export const IconChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const IconChevronLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
)

export const IconChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const IconEdit = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20.5h16" />
    <path d="M15.5 4.5a1.9 1.9 0 0 1 2.7 2.7L8.5 16.9l-3.6.8.8-3.6Z" />
  </Icon>
)

export const IconTrash = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 7h15M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
    <path d="M6.5 7 7.3 19.2a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    <path d="M10.2 11v6M13.8 11v6" />
  </Icon>
)

export const IconEye = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S5.8 5.8 12 5.8 21.5 12 21.5 12 18.2 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
)

export const IconEyeOff = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.9A10.4 10.4 0 0 1 12 5.8c6.2 0 9.5 6.2 9.5 6.2a15 15 0 0 1-3.4 4.1M6.6 6.9A15.6 15.6 0 0 0 2.5 12S5.8 18.2 12 18.2a10 10 0 0 0 3.4-.6" />
    <path d="M9.5 12a2.8 2.8 0 0 0 4 2.5" />
  </Icon>
)

export const IconPlus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconX = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)

export const IconCheck = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
)

export const IconArrowUpRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Icon>
)

export const IconArrowDownRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 7 17 17M17 9v8H9" />
  </Icon>
)

export const IconArrowRightLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8h13.5M17 8l-3.5-3.5M20.5 16H7M7 16l3.5 3.5" />
  </Icon>
)

export const IconSearch = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m20 20-4.4-4.4" />
  </Icon>
)

export const IconLogOut = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H15" />
    <path d="M20.5 12h-10M14 8l4 4-4 4" />
  </Icon>
)

export const IconLock = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Icon>
)

export const IconCamera = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8.5h3l1.5-2h7l1.5 2h3v11H4Z" />
    <circle cx="12" cy="13.5" r="3.3" />
  </Icon>
)

export const IconBell = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14.5 6 10.5Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Icon>
)

export const IconPalette = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.7-1.7 1.7-1.7H16a4 4 0 0 0 4-4c0-4-3.6-7.3-8-7.3Z" />
    <circle cx="7.7" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconRotateCcw = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 4v6h6" />
    <path d="M4.6 15a8 8 0 1 0 1.6-9.4L4 10" />
  </Icon>
)

export const IconClipboardCheck = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="5" width="14" height="16" rx="1.5" />
    <path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="m9 13 2 2 4-4.2" />
  </Icon>
)

export const IconArchive = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
    <path d="M5 9v9a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V9" />
    <path d="M10 13h4" />
  </Icon>
)

export const IconStar = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4l2.4 5.1 5.6.7-4.1 3.9 1.1 5.5L12 16.4l-5 2.8 1.1-5.5-4.1-3.9 5.6-.7Z" />
  </Icon>
)

export const IconAward = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8.5" r="5" />
    <path d="M9 12.8 7.5 20l4.5-2.3 4.5 2.3-1.5-7.2" />
  </Icon>
)

export const IconFilter = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 5h17L14 13v6l-4 2v-8Z" />
  </Icon>
)

export const IconDownload = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11M7.5 11.5 12 16l4.5-4.5" />
    <path d="M5 19.5h14" />
  </Icon>
)

export const IconUpload = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 19.5h14" />
  </Icon>
)

export const IconShare = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5v11.5M8.5 7 12 3.5 15.5 7" />
    <path d="M5.5 12v6.5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V12" />
  </Icon>
)

export const IconInfo = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconSlidersHorizontal = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6h7M15 6h5M4 12h11M19 12h1M4 18h4M12 18h8" />
    <circle cx="13" cy="6" r="2" />
    <circle cx="17" cy="12" r="2" />
    <circle cx="10" cy="18" r="2" />
  </Icon>
)

export const IconMoreHorizontal = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
)
