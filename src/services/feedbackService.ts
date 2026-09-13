import { api } from '../lib/api'

export type FeedbackType = 'BUG' | 'SUGGESTION'
export type FeedbackStatus = 'OPEN' | 'RESOLVED'

export interface FeedbackEntry {
  id: string
  type: FeedbackType
  message: string
  status: FeedbackStatus
  createdAt: string
  createdBy: string | null
  reporter: {
    username: string
    displayName: string | null
  }
}

/** Anyone signed in — a bug report or a suggestion, not tied to one Finance. */
export const submitFeedback = (type: FeedbackType, message: string) =>
  api<{ success: boolean; message: string }>('/feedback', {
    method: 'POST',
    body: { type, message },
  })

/** Admin only. */
export const listFeedback = () =>
  api<{ success: boolean; feedback: FeedbackEntry[] }>('/feedback')

export const setFeedbackStatus = (feedbackId: string, status: FeedbackStatus) =>
  api<{ success: boolean; message: string }>(`/feedback/${feedbackId}`, {
    method: 'PATCH',
    body: { status },
  })
