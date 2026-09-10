import { api } from '../lib/api'
import type { MembershipRole } from '../types/models'
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

export const addMember = (
  spaceId: string,
  identifier: string,
  role: 'EDITOR' | 'VIEWER',
) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/members`,
    { method: 'POST', body: { identifier, role } },
  )

export const updateMemberRole = (
  spaceId: string,
  userId: string,
  role: Exclude<MembershipRole, 'OWNER'>,
) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/members/${userId}`,
    { method: 'PATCH', body: { role } },
  )

export const removeMember = (spaceId: string, userId: string) =>
  api<{ success: boolean; message: string }>(
    `/spaces/${spaceId}/members/${userId}`,
    { method: 'DELETE' },
  )
