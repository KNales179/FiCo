import type { ComponentType } from 'react'
import type { HighlightIcon } from '../features/whatsNew/changelog'
import {
  IconArchive,
  IconBell,
  IconCamera,
  IconChart,
  IconCompass,
  IconHeart,
  IconHome,
  IconLock,
  IconMoon,
  IconPalette,
  IconReceipt,
  IconSettings,
  IconUsers,
  IconWallet,
  type IconProps,
} from './icons'

/** The icon for each kind of release highlight (What's new pop-up + Updates page). */
export const RELEASE_ICONS: Record<HighlightIcon, ComponentType<IconProps>> = {
  palette: IconPalette,
  layout: IconHome,
  chart: IconChart,
  compass: IconCompass,
  receipt: IconReceipt,
  archive: IconArchive,
  moon: IconMoon,
  wrench: IconSettings,
  camera: IconCamera,
  bell: IconBell,
  heart: IconHeart,
  key: IconLock,
  wallet: IconWallet,
  text: IconSettings,
  users: IconUsers,
}
