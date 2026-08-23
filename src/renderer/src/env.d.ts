/// <reference types="vite/client" />
import type { XiaobaiApi } from '@shared/types'

declare global {
  interface Window {
    api: XiaobaiApi
  }
}
