import { Capabilities } from '@/lib/browseros/capabilities'
import { getHealthCheckUrl, getMcpServerUrl } from '@/lib/browseros/helpers'
import { openSidePanel, toggleSidePanel } from '@/lib/browseros/toggleSidePanel'
import { checkAndShowChangelog } from '@/lib/changelog/changelog-notifier'
import { setupLlmProvidersBackupToBrowserOS } from '@/lib/llm-providers/storage'
import { fetchMcpTools } from '@/lib/mcp/client'
import { onServerMessage } from '@/lib/messaging/server/serverMessages'
import { onOpenSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'
import { scheduledJobRuns } from './scheduledJobRuns'

export default defineBackground(() => {
  chrome.sidePanel.setOptions({ enabled: false })

  Capabilities.initialize().catch(() => null)
  setupLlmProvidersBackupToBrowserOS()

  scheduledJobRuns()

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await toggleSidePanel(tab.id)
    }
  })

  onOpenSidePanelWithSearch('open', async (messageData) => {
    const currentTabsList = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const currentTab = currentTabsList?.[0]?.id
    if (currentTab) {
      const { opened } = await openSidePanel(currentTab)

      if (opened) {
        setTimeout(() => {
          searchActionsStorage.setValue(messageData.data)
        }, 500)
      }
    }
  })

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('app.html#/onboarding'),
      })
    }

    if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
      checkAndShowChangelog().catch(() => null)
    }
  })

  onServerMessage('checkHealth', async () => {
    try {
      const url = await getHealthCheckUrl()
      const response = await fetch(url)
      return { healthy: response.ok }
    } catch {
      return { healthy: false }
    }
  })

  onServerMessage('fetchMcpTools', async () => {
    try {
      const url = await getMcpServerUrl()
      const tools = await fetchMcpTools(url)
      return { tools }
    } catch (err) {
      return {
        tools: [],
        error: err instanceof Error ? err.message : 'Failed to fetch tools',
      }
    }
  })

  // Handle port storage messages from page context
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STORE_CDP_PORT') {
      chrome.storage.local.set(
        { browseros_cdp_port: message.port },
        () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message })
          } else {
            sendResponse({ success: true })
          }
        }
      )
      return true // Keep channel open for async response
    }

    return false // Not handled
  })
})
