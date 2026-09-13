import { api } from '../lib/api'
import type {
  MembersResponse,
  SpaceResponse,
  SpacesResponse,
} from '../types/space'

export const listSpaces = () => api<SpacesResponse>('/spaces')

export const createSpace = (name: string) =>
  api<SpaceResponse>('/spaces', {
    method: 'POST',
    body: { name },
  })

export const getSpace = (spaceId: string) =>
  api<SpaceResponse>(`/spaces/${spaceId}`)

export const renameSpace = (spaceId: string, name: string) =>
  api<SpaceResponse>(`/spaces/${spaceId}`, {
    method: 'PATCH',
    body: { name },
  })

/** Owner-only, enforced server-side: change what currency this Finance uses. */
export const updateSpaceCurrency = (spaceId: string, currency: string) =>
  api<SpaceResponse>(`/spaces/${spaceId}`, {
    method: 'PATCH',
    body: { currency },
  })

export const deleteSpace = (spaceId: string) =>
  api<{ success: boolean; message: string }>(`/spaces/${spaceId}`, {
    method: 'DELETE',
  })

export const leaveSpace = (spaceId: string) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/leave`,
    { method: 'POST' },
  )

export const listMembers = (spaceId: string) =>
  api<MembersResponse>(`/spaces/${spaceId}/members`)

export const addMember = (spaceId: string, identifier: string) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/members`,
    { method: 'POST', body: { identifier } },
  )

/** Owner-only: hand the Finance to another member. The old owner stays on as a member. */
export const transferOwnership = (spaceId: string, userId: string) =>
  api<{ success: boolean; message: string; ownerId: string }>(
    `/spaces/${spaceId}/transfer-ownership`,
    { method: 'POST', body: { userId } },
  )

export const removeMember = (spaceId: string, userId: string) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/members/${userId}`,
    { method: 'DELETE' },
  )

export interface PendingInvitation {
  id: string
  email: string
  status: string
  expiresAt: string
  createdAt: string
}

export const listInvitations = (spaceId: string) =>
  api<{ success: boolean; invitations: PendingInvitation[] }>(
    `/spaces/${spaceId}/invitations`,
  )

export const inviteToSpace = (spaceId: string, email: string) =>
  api<{
    success: boolean
    message: string
    addedExistingUser: boolean
  }>(`/spaces/${spaceId}/invitations`, {
    method: 'POST',
    body: { email },
  })

export const revokeInvitation = (
  spaceId: string,
  invitationId: string,
) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/invitations/${invitationId}`,
    { method: 'DELETE' },
  )
