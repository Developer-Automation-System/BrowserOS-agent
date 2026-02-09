/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference path="../types/chrome-browser-os.d.ts" />

import { getBrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { WEBSOCKET_CONFIG } from '@/config/constants'
import { logger } from '@/utils/logger'

/**
 * Get the WebSocket port from chrome.storage (instance-specific) or BrowserOS preferences
 * Prioritizes chrome.storage first as it's instance-specific and more reliable for reconnections
 * Falls back to BrowserOS preferences, then to default port if neither is available
 */
export async function getWebSocketPort(): Promise<number> {
  // 1. Try chrome.storage first (instance-specific, stored via extension messaging API)
  // This ensures we reconnect to the same server instance even if preferences change
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local
    ) {
      const stored = await new Promise<number | null>((resolve) => {
        logger.info('[ConfigHelper] Getting port from chrome.storage')
        chrome.storage.local.get('browseros_extension_port', (result) => {
          if (chrome.runtime.lastError) {
            logger.warn(
              `[ConfigHelper] chrome.storage error: ${chrome.runtime.lastError.message}`,
            )
            resolve(null)
            return
          }
          logger.info(`[ConfigHelper] chrome.storage result:`, result)
          const port = result?.browseros_extension_port
          if (port) {
            const portNum = parseInt(String(port), 10)
            if (!Number.isNaN(portNum) && portNum > 0) {
              logger.info(`[ConfigHelper] Found port in chrome.storage: ${portNum}`)
              resolve(portNum)
              return
            }
          }
          logger.warn(`[ConfigHelper] No valid port found in chrome.storage`)
          resolve(null)
        })
      })

      if (stored) {
        logger.info(`Using port from chrome.storage: ${stored}`)
        return stored
      }
    }
  } catch (error) {
    logger.warn(
      `Failed to get port from chrome.storage: ${error}, trying BrowserOS preferences fallback`,
    )
  }

  // 2. Fallback to BrowserOS preferences (set by BrowserOS at startup)
  try {
    const adapter = getBrowserOSAdapter()
    const pref = await adapter.getPref('browseros.server.extension_port')

    if (pref && typeof pref.value === 'number') {
      logger.info(`Using port from BrowserOS preferences: ${pref.value}`)
      return pref.value
    }
  } catch (error) {
    logger.warn(
      `Failed to get port from BrowserOS preferences: ${error}, using default`,
    )
  }

  // 3. Last resort: use default port
  logger.warn(
    `Port not found in storage or preferences, using default: ${WEBSOCKET_CONFIG.defaultExtensionPort}`,
  )
  return WEBSOCKET_CONFIG.defaultExtensionPort
}
