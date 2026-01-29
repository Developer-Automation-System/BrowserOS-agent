import { storage } from '@wxt-dev/storage'
import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'
import type { LlmProviderConfig, LlmProvidersBackup } from './types'

/** Default provider ID constant */
export const DEFAULT_PROVIDER_ID = 'google-default'

/** Storage key for LLM providers array */
export const providersStorage = storage.defineItem<LlmProviderConfig[]>(
  'local:llm-providers',
)

/** Backup providers to BrowserOS prefs (write-only, best-effort) */
async function backupToBrowserOS(backup: LlmProvidersBackup): Promise<void> {
  try {
    const adapter = getBrowserOSAdapter()
    await adapter.setPref(BROWSEROS_PREFS.PROVIDERS, JSON.stringify(backup))
  } catch {
    // BrowserOS API not available - ignore
  }
}

/**
 * Setup one-way sync of LLM providers to BrowserOS prefs
 * @public
 */
export function setupLlmProvidersBackupToBrowserOS(): () => void {
  const unsubscribe = providersStorage.watch(async (providers) => {
    if (providers) {
      const defaultProviderId = await defaultProviderIdStorage.getValue()
      await backupToBrowserOS({ defaultProviderId, providers })
    }
  })
  return unsubscribe
}

/** Load providers from storage */
export async function loadProviders(): Promise<LlmProviderConfig[]> {
  const providers = await providersStorage.getValue()
  return providers || []
}

/** Creates the default BrowserOS provider configuration */
export function createDefaultBrowserOSProvider(): LlmProviderConfig {
  const timestamp = Date.now()
  return {
    id: DEFAULT_PROVIDER_ID,
    type: 'browseros',
    name: 'BrowserOS',
    baseUrl: 'https://api.browseros.com/v1',
    modelId: 'browseros-auto',
    supportsImages: true,
    contextWindow: 400000,
    temperature: 0.2,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Creates a Gemini provider configuration */
export function createOpenAIProvider(apiKey: string): LlmProviderConfig {
  const timestamp = Date.now()
  return {
    id: 'google-default',
    type: 'google',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelId: 'gemini-3-flash-preview',
    apiKey,
    supportsImages: true,
    contextWindow: 1048576,
    temperature: 0.2,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Creates the default providers configuration. Only call when storage is empty. */
export function createDefaultProvidersConfig(): LlmProviderConfig[] {
  const providers: LlmProviderConfig[] = []

  // Add Gemini provider first (as default) if API key is provided via environment variable
  // Vite exposes env vars via import.meta.env at build time
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const geminiApiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY as
      | string
      | undefined

    if (
      geminiApiKey &&
      typeof geminiApiKey === 'string' &&
      geminiApiKey.trim()
    ) {
      providers.push(createOpenAIProvider(geminiApiKey.trim()))
    }
  } catch {
    // Environment variable not available - ignore
  }

  // Add BrowserOS provider as fallback
  providers.push(createDefaultBrowserOSProvider())

  return providers
}

/** Storage key for the default provider ID */
export const defaultProviderIdStorage = storage.defineItem<string>(
  'local:default-provider-id',
  {
    fallback: DEFAULT_PROVIDER_ID,
  },
)
