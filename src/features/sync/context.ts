/** Who is making a local change, and where — assembled by each area's provider. */
export interface MutationContext {
  spaceId: string
  userId: string
  deviceId: string
}
