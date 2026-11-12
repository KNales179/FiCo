import { api } from '../lib/api'
import type { AppealSummary } from '../features/auth/authNotice'

export type { AppealSummary }

/** No session — the token from a restricted sign-in proves it's them. */
export const sendAppeal = (token: string, message: string) =>
  api<{ success: boolean; message: string; appeal: AppealSummary }>('/appeals', {
    method: 'POST',
    body: { token, message },
  })

export interface AppealUser {
  id: string
  username: string
  displayName: string | null
  email: string
  avatarUrl: string | null
}

export interface AdminAppeal extends AppealSummary {
  user: AppealUser | null
  restriction: { reason: string; until: string | null; at: string }
}

export interface AdminAppealDetail extends AdminAppeal {
  currentRestriction: { reason: string; until: string | null } | null
  decidedBy: string | null
  previousAppeals: number
}

export const listAppeals = () =>
  api<{ success: boolean; open: number; appeals: AdminAppeal[] }>('/admin/appeals')

export const getAppeal = (id: string) =>
  api<{ success: boolean; appeal: AdminAppealDetail }>(`/admin/appeals/${id}`)

export const decideAppeal = (
  id: string,
  body: { decision: 'LIFT' | 'SHORTEN' | 'KEEP'; note: string; durationHours?: number },
) => api<{ success: boolean; message: string }>(`/admin/appeals/${id}/decide`, { method: 'POST', body })
