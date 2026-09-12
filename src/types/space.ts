import type { MembershipRole, SpaceType } from './models'

/** A space as returned by `GET /api/spaces`, including the caller's role in it. */
export interface SpaceSummary {
  id: string
  name: string
  type: SpaceType
  ownerId: string
  role: MembershipRole
  createdAt: string
  updatedAt: string
}

export interface SpaceMember {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl?: string | null
  role: MembershipRole
  joinedAt?: string
}

export interface SpacesResponse {
  success: boolean
  spaces: SpaceSummary[]
}

export interface SpaceResponse {
  success: boolean
  space: SpaceSummary
  message?: string
}

export interface MembersResponse {
  success: boolean
  members: SpaceMember[]
}
