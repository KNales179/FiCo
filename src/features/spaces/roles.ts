import type { MembershipRole } from '../../types/models'

/**
 * Roles in a Finance (the server enforces the same rules):
 * - Owner  — everything, plus managing members and their roles.
 * - Admin  — edits everything, and sees Activity (who changed what).
 * - Member — adds and edits records.
 * - Viewer — sees everything, changes nothing.
 */
export const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export const ROLE_HINT: Record<MembershipRole, string> = {
  OWNER: 'Everything, plus setting roles and handing over ownership',
  ADMIN: 'Edits everything, sees Activity, invites and removes members',
  MEMBER: 'Adds and edits records',
  VIEWER: 'Can see, can’t change anything',
}

export const ROLE_ORDER: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']

/** May add, edit or delete records. */
export const canEditWith = (role: MembershipRole | null | undefined): boolean => Boolean(role) && role !== 'VIEWER'

/** May see the Activity (who changed what). */
export const canSeeActivity = (role: MembershipRole | null | undefined): boolean => role === 'OWNER' || role === 'ADMIN'
