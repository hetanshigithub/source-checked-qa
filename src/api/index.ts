import { createDemoApi } from '../demo/engine'
import { sampleTexts } from '../demo/samples'
import { createLiveApi } from './client'
import type { Api } from './types'

/** A live API when VITE_API_URL is set, otherwise the in-browser demo. */
export function createApiFromEnv(): Api {
  const url = import.meta.env.VITE_API_URL as string | undefined
  return url ? createLiveApi(url) : createDemoApi(sampleTexts)
}
