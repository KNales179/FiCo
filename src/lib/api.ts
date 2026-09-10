const API_URL =
  import.meta.env?.VITE_API_URL || 'http://localhost:5000/api'

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/** Error thrown for any request that reached the server and came back not-ok. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Error thrown when the request never reached the server (offline, DNS, CORS, …). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

export const isNetworkError = (error: unknown): error is NetworkError =>
  error instanceof NetworkError

export const api = async <T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> => {
  const { body, headers, ...rest } = options

  let response: Response

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...rest,

      credentials: 'include',

      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },

      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (cause) {
    // fetch only rejects when the request could not be made at all.
    throw new NetworkError(cause)
  }

  let data: { message?: string } | null = null

  try {
    data = (await response.json()) as { message?: string }
  } catch {
    // Response has no JSON body.
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || 'Something went wrong',
      response.status,
    )
  }

  return data as unknown as T
}
