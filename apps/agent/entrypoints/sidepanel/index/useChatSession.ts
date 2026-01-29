import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { compact } from 'es-toolkit/array'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { Provider } from '@/components/chat/chatComponentTypes'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import type { ChatAction } from '@/lib/chat-actions/types'
import {
  CONVERSATION_RESET_EVENT,
  MESSAGE_DISLIKE_EVENT,
  MESSAGE_LIKE_EVENT,
  MESSAGE_SENT_EVENT,
  PROVIDER_SELECTED_EVENT,
} from '@/lib/constants/analyticsEvents'
import {
  conversationStorage,
  useConversations,
} from '@/lib/conversations/conversationStorage'
import { formatConversationHistory } from '@/lib/conversations/formatConversationHistory'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { track } from '@/lib/metrics/track'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'
import { selectedWorkspaceStorage } from '@/lib/workspace/workspace-storage'
import type { ChatMode } from './chatTypes'
import { useChatRefs } from './useChatRefs'
import { useNotifyActiveTab } from './useNotifyActiveTab'

const getLastMessageText = (messages: UIMessage[]) => {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''
  return lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/**
 * Get browserPort from chrome.storage - throws error if not found
 */
const getBrowserPort = async (): Promise<number> => {
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage ||
    !chrome.storage.local
  ) {
    throw new Error('Chrome storage API not available')
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get('browseros_cdp_port', (result) => {
      if (result?.browseros_cdp_port) {
        const port = parseInt(String(result.browseros_cdp_port), 10)
        if (!Number.isNaN(port) && port > 0) {
          resolve(port)
          return
        }
      }
      reject(
        new Error(
          'BrowserPort not found in chrome.storage. Make sure BrowserOS is started and open-new-tab.js has run.',
        ),
      )
    })
  })
}

/**
 * Send agent status/log to agent-status API
 * Sends all status updates to backend, but only "started" and "completed" are used for search matching
 */
const sendAgentStatus = async (
  status: string,
  message: string,
  conversationId: string,
  messageId: string,
  role: 'assistant' | 'error' | 'user',
  parts: Array<{ type: string; text?: string; [key: string]: any }>,
  toolCalls?: Array<{
    toolCallId: string
    toolName: string
    input: Record<string, unknown>
    output?: unknown
    error?: string
    state?: string
  }>,
): Promise<void> => {
  const apiBaseUrl =
    import.meta.env.VITE_NEXTJS_API_URL || 'http://localhost:3010'

  try {
    const browserPort = await getBrowserPort()

    const response = await fetch(`${apiBaseUrl}/api/browser/agent-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        message,
        conversationId,
        messageId,
        role,
        timestamp: new Date().toISOString(),
        parts,
        toolCalls,
        browserPort,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Silently handle errors - they're logged on the backend
    }
  } catch (error) {
    // Silently handle errors - they're logged on the backend
  }
}

export const getResponseAndQueryFromMessageId = (
  messages: UIMessage[],
  messageId: string,
) => {
  const messageIndex = messages.findIndex((each) => each.id === messageId)
  const response = messages?.[messageIndex] ?? []
  const query = messages?.[messageIndex - 1] ?? []
  const responseText = response.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n\n')
  const queryText = query.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n')

  return {
    responseText,
    queryText,
  }
}

export const useChatSession = () => {
  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
    selectedLlmProvider,
    isLoadingProviders,
  } = useChatRefs()

  const { providers: llmProviders, setDefaultProvider } = useLlmProviders()

  const {
    baseUrl: agentServerUrl,
    isLoading: isLoadingAgentUrl,
    error: agentUrlError,
  } = useAgentServerUrl()

  const { saveConversation } = useConversations()
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationIdParam = searchParams.get('conversationId')

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const providers: Provider[] = llmProviders.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }))

  const [mode, setMode] = useState<ChatMode>('agent')
  const [textToAction, setTextToAction] = useState<Map<string, ChatAction>>(
    new Map(),
  )
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [disliked, setDisliked] = useState<Record<string, boolean>>({})
  const [conversationId, setConversationId] = useState(crypto.randomUUID())
  const conversationIdRef = useRef(conversationId)

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  const onClickLike = (messageId: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(MESSAGE_LIKE_EVENT, { responseText, queryText, messageId })

    setLiked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const onClickDislike = (messageId: string, comment?: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(MESSAGE_DISLIKE_EVENT, {
      responseText,
      queryText,
      messageId,
      comment,
    })

    setDisliked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const modeRef = useRef<ChatMode>(mode)
  const textToActionRef = useRef<Map<string, ChatAction>>(textToAction)
  const workingDirRef = useRef<string | undefined>(undefined)
  const messagesRef = useRef<UIMessage[]>([])

  useEffect(() => {
    selectedWorkspaceStorage.getValue().then((folder) => {
      workingDirRef.current = folder?.path
    })

    const unwatch = selectedWorkspaceStorage.watch((folder) => {
      workingDirRef.current = folder?.path
    })
    return () => unwatch()
  }, [])

  useDeepCompareEffect(() => {
    modeRef.current = mode
    textToActionRef.current = textToAction
  }, [mode, textToAction])

  const selectedProvider = selectedLlmProvider
    ? {
        id: selectedLlmProvider.id,
        name: selectedLlmProvider.name,
        type:
          selectedLlmProvider.id === 'browseros'
            ? ('browseros' as const)
            : selectedLlmProvider.type,
      }
    : providers[0]

  const {
    messages,
    sendMessage: baseSendMessage,
    setMessages,
    status,
    stop,
    error: chatError,
  } = useChat({
    transport: new DefaultChatTransport({
      // Important: this chat logic is also used in apps/agent/lib/schedules/getChatServerResponse.ts for scheduled jobs. Make sure to keep them in sync for any future changes.
      prepareSendMessagesRequest: async ({ messages }) => {
        const activeTabsList = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        const activeTab = activeTabsList?.[0] ?? undefined
        const message = getLastMessageText(messages)
        const provider = selectedLlmProviderRef.current
        const currentMode = modeRef.current
        const enabledMcpServers = enabledMcpServersRef.current
        const customMcpServers = enabledCustomServersRef.current

        const getActionForMessage = (messageText: string) => {
          return textToActionRef.current.get(messageText)
        }

        const action = getActionForMessage(message)

        const browserContext: {
          windowId?: number
          activeTab?: {
            id?: number
            url?: string
            title?: string
          }
          selectedTabs?: {
            id?: number
            url?: string
            title?: string
          }[]
          enabledMcpServers?: string[]
          customMcpServers?: {
            name: string
            url: string
          }[]
        } = {}

        if (activeTab) {
          browserContext.windowId = activeTab.windowId
          browserContext.activeTab = {
            id: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
          }
        }

        if (action?.tabs?.length) {
          browserContext.selectedTabs = action?.tabs?.map((tab) => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
          }))
        }

        if (enabledMcpServers.length) {
          browserContext.enabledMcpServers = compact(enabledMcpServers)
        }

        if (customMcpServers.length) {
          browserContext.customMcpServers = customMcpServers as {
            name: string
            url: string
          }[]
        }

        // Format previous messages from ref (messagesRef doesn't include current message yet)
        const previousMessages = messagesRef.current
        const previousConversation =
          previousMessages.length > 0
            ? formatConversationHistory(previousMessages)
            : undefined

        return {
          api: `${agentUrlRef.current}/chat`,
          body: {
            message,
            provider: provider?.type,
            providerType: provider?.type,
            providerName: provider?.name,
            apiKey: provider?.apiKey,
            baseUrl: provider?.baseUrl,
            conversationId: conversationIdRef.current,
            model: provider?.modelId ?? 'default',
            mode: currentMode,
            contextWindowSize: provider?.contextWindow,
            temperature: provider?.temperature,
            // Azure-specific
            resourceName: provider?.resourceName,
            // Bedrock-specific
            accessKeyId: provider?.accessKeyId,
            secretAccessKey: provider?.secretAccessKey,
            region: provider?.region,
            sessionToken: provider?.sessionToken,
            browserContext,
            userSystemPrompt: personalizationRef.current,
            userWorkingDir: workingDirRef.current,
            supportsImages: provider?.supportsImages,
            previousConversation,
          },
        }
      },
    }),
  })

  useNotifyActiveTab({
    messages,
    status,
    conversationId: conversationIdRef.current,
  })

  // Track if we've sent 'started' status for current conversation
  const agentStartedRef = useRef<string | null>(null)
  const lastStatusRef = useRef<string | null>(null)

  // Send all status updates to backend
  useEffect(() => {
    // Only send if status changed
    if (status === lastStatusRef.current) return
    lastStatusRef.current = status

    // Send 'started' status when agent begins processing
    if (
      status === 'streaming' &&
      agentStartedRef.current !== conversationIdRef.current
    ) {
      agentStartedRef.current = conversationIdRef.current

      // Get the first user message (query) from messages
      const firstUserMessage = messages.find((msg) => msg.role === 'user')
      const queryMessage = firstUserMessage
        ? firstUserMessage.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('')
        : ''

      // Send started status with query message
      sendAgentStatus(
        'started',
        queryMessage,
        conversationIdRef.current,
        `started_${Date.now()}`,
        'assistant',
        [],
      )
    } else {
      // Send all other status updates (in_progress, streaming, etc.)
      const statusMessage = status === 'streaming' 
        ? 'Agent is processing...'
        : status === 'awaiting_browser_response'
        ? 'Waiting for browser response...'
        : status === 'error'
        ? 'Error occurred'
        : `Status: ${status}`

      sendAgentStatus(
        status,
        statusMessage,
        conversationIdRef.current,
        `${status}_${Date.now()}`,
        'assistant',
        [],
      )
    }
  }, [status, conversationId, messages])

  // Track processed tool calls to avoid duplicates
  const lastProcessedToolCallsRef = useRef<Set<string>>(new Set())

  // Track and send tool calls/results
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant') return

    // Extract tool-related parts
    const toolParts = lastMessage.parts.filter((p) =>
      p.type?.startsWith('tool-'),
    ) as Array<{
      type: string
      toolCallId?: string
      toolName?: string
      input?: Record<string, unknown>
      output?: unknown
      error?: string
      errorText?: string
      state?: string
    }>

    if (toolParts.length === 0) return

    // Process each tool part
    for (const toolPart of toolParts) {
      const toolCallId = toolPart.toolCallId || `${lastMessage.id}_${toolPart.type}`
      const uniqueKey = `${toolCallId}_${toolPart.state || 'unknown'}`
      
      if (lastProcessedToolCallsRef.current.has(uniqueKey)) continue

      // Extract tool name from type (e.g., 'tool-browser_get_active_tab' -> 'browser_get_active_tab')
      const toolName =
        toolPart.toolName ||
        toolPart.type?.replace('tool-', '') ||
        'unknown'

      // Check if this is an error state
      const isError = toolPart.state === 'output-error' || toolPart.error !== undefined || toolPart.errorText !== undefined
      const errorText = toolPart.error || toolPart.errorText || (isError ? 'Tool execution failed' : undefined)

      // Determine if this is a tool call (input available) or tool result (output/error available)
      const isToolCall = toolPart.input !== undefined && !toolPart.output && !isError
      const isToolResult = toolPart.output !== undefined || isError

      if (isToolCall) {
        // Send tool call
        sendAgentStatus(
          'tool_call',
          `Tool call: ${toolName}`,
          conversationIdRef.current,
          toolCallId,
          'assistant',
          [],
          [
            {
              toolCallId,
              toolName,
              input: toolPart.input || {},
              state: toolPart.state || 'pending',
            },
          ],
        )
        lastProcessedToolCallsRef.current.add(uniqueKey)
      } else if (isToolResult) {
        // Send tool result (with error if present)
        sendAgentStatus(
          'tool_result',
          isError ? `Tool error: ${toolName}` : `Tool result: ${toolName}`,
          conversationIdRef.current,
          toolCallId,
          isError ? 'error' : 'assistant',
          [],
          [
            {
              toolCallId,
              toolName,
              input: toolPart.input || {},
              output: toolPart.output,
              error: errorText,
              state: toolPart.state || (isError ? 'output-error' : 'completed'),
            },
          ],
        )
        lastProcessedToolCallsRef.current.add(uniqueKey)
      }
    }
  }, [messages])

  // Log final agent message and send completed status
  const lastSentMessageIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      // Only log final assistant messages (when status is not streaming)
      if (
        lastMessage.role === 'assistant' &&
        status !== 'streaming' &&
        lastMessage.id !== lastSentMessageIdRef.current
      ) {
        const content = lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('')

        // Extract all tool calls from the message
        const toolCalls = lastMessage.parts
          .filter((p) => p.type?.startsWith('tool-'))
          .map((p) => {
            const toolPart = p as any
            const isError = toolPart.state === 'output-error' || toolPart.error !== undefined || toolPart.errorText !== undefined
            const errorText = toolPart.error || toolPart.errorText || (isError ? 'Tool execution failed' : undefined)
            return {
              toolCallId: toolPart.toolCallId || `${lastMessage.id}_${toolPart.type}`,
              toolName:
                toolPart.toolName ||
                toolPart.type?.replace('tool-', '') ||
                'unknown',
              input: toolPart.input || {},
              output: toolPart.output,
              error: errorText,
              state: toolPart.state || (isError ? 'output-error' : 'completed'),
            }
          })

        // Send completed status with tool calls
        sendAgentStatus(
          'completed',
          content,
          conversationIdRef.current,
          lastMessage.id,
          lastMessage.role as 'assistant' | 'error',
          lastMessage.parts
            .filter((p) => p.type === 'text')
            .map((p) => ({
              type: 'text',
              text: p.text,
            })),
          toolCalls.length > 0 ? toolCalls : undefined,
        )

        lastSentMessageIdRef.current = lastMessage.id
        lastProcessedToolCallsRef.current.clear() // Reset for next message
      }
    }
  }, [messages, status])

  // Send error to agent-status API when chatError occurs
  const lastSentErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (chatError && chatError.message !== lastSentErrorRef.current) {
      const errorMessage = chatError.message

      // Send error status
      sendAgentStatus(
        'completed',
        errorMessage,
        conversationIdRef.current,
        `error_${Date.now()}`,
        'error',
        [{ type: 'text', text: errorMessage }],
      )

      lastSentErrorRef.current = errorMessage
    }
  }, [chatError])

  useEffect(() => {
    if (!conversationIdParam) return

    const restoreConversation = async () => {
      const conversations = await conversationStorage.getValue()
      const conversation = conversations?.find(
        (c) => c.id === conversationIdParam,
      )

      if (conversation) {
        setConversationId(
          conversation.id as ReturnType<typeof crypto.randomUUID>,
        )
        setMessages(conversation.messages)
      }

      setSearchParams({}, { replace: true })
    }

    restoreConversation()
  }, [conversationIdParam, setMessages, setSearchParams])

  // biome-ignore lint/correctness/useExhaustiveDependencies: only need to run when messages change
  useEffect(() => {
    messagesRef.current = messages
    if (messages.length > 0) {
      saveConversation(conversationIdRef.current, messages)
    }
  }, [messages])

  const sendMessage = (params: { text: string; action?: ChatAction }) => {
    track(MESSAGE_SENT_EVENT, {
      mode,
      provider_type: selectedLlmProvider?.type,
      model: selectedLlmProvider?.modelId,
    })
    if (params.action) {
      const action = params.action
      setTextToAction((prev) => {
        const next = new Map(prev)
        next.set(params.text, action)
        return next
      })
    }
    baseSendMessage({ text: params.text })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: only need to run this once
  useEffect(() => {
    const unwatch = searchActionsStorage.watch((storageAction) => {
      if (storageAction) {
        setMode(storageAction.mode)
        sendMessage({ text: storageAction.query, action: storageAction.action })
      }
    })
    return () => unwatch()
  }, [])

  const handleSelectProvider = (provider: Provider) => {
    track(PROVIDER_SELECTED_EVENT, {
      provider_id: provider.id,
      provider_type: provider.type,
    })
    setDefaultProvider(provider.id)
  }

  const getActionForMessage = (message: UIMessage) => {
    if (message.role !== 'user') return undefined
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    return textToAction.get(text)
  }

  const resetConversation = () => {
    track(CONVERSATION_RESET_EVENT, { message_count: messages.length })
    stop()
    const newConversationId = crypto.randomUUID()
    setConversationId(newConversationId)
    agentStartedRef.current = null
    lastProcessedToolCallsRef.current.clear()
    setMessages([])
    setTextToAction(new Map())
    setLiked({})
    setDisliked({})
  }

  return {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    stop,
    providers,
    selectedProvider,
    isLoading: isLoadingProviders || isLoadingAgentUrl,
    agentUrlError,
    chatError,
    handleSelectProvider,
    getActionForMessage,
    resetConversation,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
    conversationId,
  }
}
