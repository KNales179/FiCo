// Fico is invite-only: every test sign-up needs a one-time code. These are
// written straight into the throwaway test database (never a real one).
import { MongoClient, ObjectId } from 'mongodb'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const part = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export const makeInviteCode = async (mongoUri, note = 'e2e', expired = false) => {
  const client = await MongoClient.connect(mongoUri)
  try {
    const a = part()
    const b = part()
    await client.db().collection('invitecodes').insertOne({
      code: `FICO-${a}-${b}`,
      key: `FICO${a}${b}`,
      note,
      createdBy: new ObjectId(),
      usedBy: null,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (expired ? -60_000 : 60 * 60 * 1000)),
    })
    return `FICO-${a}-${b}`
  } finally {
    await client.close()
  }
}
