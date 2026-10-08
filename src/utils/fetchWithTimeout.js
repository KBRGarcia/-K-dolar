const DEFAULT_TIMEOUT_MS = 10000

export class RequestTimeoutError extends Error {
  constructor() {
    super('La consulta tardó demasiado. Verifica tu conexión.')
    this.name = 'RequestTimeoutError'
  }
}

export function getFetchErrorMessage(error, fallback) {
  if (error?.name === 'RequestTimeoutError' && error.message) return error.message

  if (
    typeof error?.message === 'string' &&
    (error.message.startsWith('No se pudo') ||
      error.message.startsWith('El histórico') ||
      error.message.startsWith('La consulta'))
  ) {
    return error.message
  }

  return fallback
}

export async function fetchWithTimeout(resource, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutState = { timedOut: false }
  const timeoutId = setTimeout(() => {
    timeoutState.timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortRequest = () => controller.abort()

  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', abortRequest, { once: true })
  }

  try {
    return await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal,
    })
  } catch (error) {
    if (timeoutState.timedOut && !signal?.aborted) {
      throw new RequestTimeoutError()
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortRequest)
  }
}
