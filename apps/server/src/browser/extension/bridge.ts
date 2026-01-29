/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { Logger } from '../../lib/logger'

interface ControllerRequest {
  id: string
  action: string
  payload: unknown
}

interface ControllerResponse {
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

interface WindowRegistrationPromise {
  resolve: (clientId: string) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class ControllerBridge {
  private wss: WebSocketServer
  private clients = new Map<string, WebSocket>()
  private primaryClientId: string | null = null
  private requestCounter = 0
  private pendingRequests = new Map<string, PendingRequest>()
  private logger: Logger
  // Window ownership: maps windowId to clientId for multi-profile routing
  private windowOwnership = new Map<number, string>()
  // Promises waiting for window registration
  private windowRegistrationPromises = new Map<number, WindowRegistrationPromise>()

  constructor(port: number, logger: Logger) {
    this.logger = logger

    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
    })

    // this.wss.on('listening', () => {
    //   this.logger.info(`WebSocket server listening on ws://127.0.0.1:${port}`)
    // })

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.registerClient(ws)
      // this.logger.info('Extension connected', { clientId })

      ws.on('message', (data: Buffer) => {
        try {
          const message = data.toString()
          const parsed = JSON.parse(message)

          // Handle ping/pong for heartbeat
          if (parsed.type === 'ping') {
            // this.logger.debug('Received ping, sending pong', { clientId })
            ws.send(JSON.stringify({ type: 'pong' }))
            return
          }
          if (parsed.type === 'focused') {
            this.handleFocusEvent(clientId, parsed.windowId)
            return
          }
          // Handle window registration messages
          if (parsed.type === 'register_windows') {
            this.handleRegisterWindows(clientId, parsed.windowIds)
            return
          }
          if (parsed.type === 'window_created') {
            this.handleWindowCreated(clientId, parsed.windowId)
            return
          }
          if (parsed.type === 'window_removed') {
            this.handleWindowRemoved(clientId, parsed.windowId)
            return
          }

          this.logger.debug('Received message from controller client', {
            clientId,
            message,
          })
          const response = parsed as ControllerResponse
          this.handleResponse(response)
        } catch (error) {
          this.logger.error(`Error parsing message from ${clientId}: ${error}`)
        }
      })

      ws.on('close', () => {
        // this.logger.info('Extension disconnected', { clientId })
        this.handleClientDisconnect(clientId)
      })

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for ${clientId}: ${error.message}`)
      })
    })

    this.wss.on('error', (error: Error) => {
      this.logger.error(`WebSocket server error: ${error.message}`)
    })
  }

  waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onListening = () => {
        this.wss.off('error', onError)
        resolve()
      }
      const onError = (error: Error) => {
        this.wss.off('listening', onListening)
        reject(error)
      }
      this.wss.once('listening', onListening)
      this.wss.once('error', onError)
    })
  }

  isConnected(): boolean {
    return this.primaryClientId !== null
  }

  async sendRequest(
    action: string,
    payload: unknown,
    timeoutMs: number = TIMEOUTS.CONTROLLER_BRIDGE,
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('BrowserOS helper service not connected')
    }

    // Route by windowId if available, otherwise use primary client
    const payloadObj = payload as Record<string, unknown> | null
    const windowId = payloadObj?.windowId as number | undefined

    // Wait for window ownership registration if windowId is provided but not yet registered
    // This fixes the race condition when multiple BrowserOS instances run concurrently
    let targetClientId = this.primaryClientId
    if (windowId !== undefined) {
      const ownerClientId = this.windowOwnership.get(windowId)
      if (ownerClientId && this.clients.has(ownerClientId)) {
        targetClientId = ownerClientId
        this.logger.debug('Routing request by windowId', {
          windowId,
          targetClientId,
        })
      } else {
        // Await window registration using promise-based system (no polling)
        try {
          const registeredClientId = await this.waitForWindowRegistration(windowId, 2000)
          if (registeredClientId && this.clients.has(registeredClientId)) {
            targetClientId = registeredClientId
            this.logger.debug('Window ownership registered after await', {
              windowId,
              targetClientId,
            })
          } else {
            // Fall back to primaryClientId if registration didn't provide valid client
            this.logger.warn('Window registered but client not found, using primary client', {
              windowId,
              registeredClientId,
              primaryClientId: this.primaryClientId,
            })
          }
        } catch (error) {
          // Timeout or error - fall back to primaryClientId
          // This is safe because agent and controller extensions are in the same browser instance
          this.logger.warn('Window registration timeout, using primary client', {
            windowId,
            primaryClientId: this.primaryClientId,
            error: error instanceof Error ? error.message : String(error),
            registeredWindows: Array.from(this.windowOwnership.keys()),
          })
        }
      }
    }

    // Validate that we have a valid client before proceeding
    if (!targetClientId) {
      throw new Error('BrowserOS helper service not connected: no primary client available')
    }

    const client = this.clients.get(targetClientId)
    if (!client) {
      // This should not happen if primaryClientId is set correctly, but handle it gracefully
      this.logger.error('Target client not found in clients map', {
        targetClientId,
        primaryClientId: this.primaryClientId,
        availableClients: Array.from(this.clients.keys()),
        windowId,
      })
      throw new Error(`BrowserOS helper service not connected: client ${targetClientId} not found`)
    }

    const id = `${Date.now()}-${++this.requestCounter}`

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const request: ControllerRequest = { id, action, payload }
      try {
        const message = JSON.stringify(request)
        this.logger.debug(`Sending request to ${targetClientId}: ${message}`)
        client.send(message)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private handleResponse(response: ControllerResponse): void {
    const pending = this.pendingRequests.get(response.id)

    if (!pending) {
      this.logger.warn(
        `Received response for unknown request ID: ${response.id}`,
      )
      return
    }

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.data)
    } else {
      pending.reject(new Error(response.error || 'Unknown error'))
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('ControllerBridge closing'))
        this.pendingRequests.delete(id)
      }

      for (const ws of this.clients.values()) {
        try {
          ws.close()
        } catch {
          // ignore
        }
      }
      this.clients.clear()
      this.primaryClientId = null

      this.wss.close(() => {
        // this.logger.info('WebSocket server closed')
        resolve()
      })
    })
  }

  private registerClient(ws: WebSocket): string {
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    this.clients.set(clientId, ws)

    if (!this.primaryClientId) {
      this.primaryClientId = clientId
      //   this.logger.info('Primary controller assigned', { clientId })
      // } else {
      //   this.logger.info('Controller connected in standby mode', {
      //     clientId,
      //     primaryClientId: this.primaryClientId,
      //   })
    }

    return clientId
  }

  private handleClientDisconnect(clientId: string): void {
    const wasPrimary = this.primaryClientId === clientId
    this.clients.delete(clientId)

    // Clean up window ownership for disconnected client
    for (const [windowId, owner] of this.windowOwnership.entries()) {
      if (owner === clientId) {
        this.windowOwnership.delete(windowId)
      }
    }
    // this.logger.debug('Cleaned up window ownership for disconnected client', {
    //   clientId,
    // })

    if (wasPrimary) {
      this.primaryClientId = null

      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Primary connection closed'))
        this.pendingRequests.delete(id)
      }

      this.promoteNextPrimary()
    }
  }

  private promoteNextPrimary(): void {
    const nextEntry = this.clients.keys().next()
    if (nextEntry.done) {
      // this.logger.warn('No controller connections available to promote')
      return
    }

    this.primaryClientId = nextEntry.value
    // this.logger.info('Promoted controller to primary', {
    //   clientId: this.primaryClientId,
    // })
  }

  private handleFocusEvent(clientId: string, windowId?: number): void {
    // Also register window ownership on focus (confirms ownership)
    if (windowId !== undefined) {
      this.windowOwnership.set(windowId, clientId)
    }

    if (this.primaryClientId === clientId) {
      this.logger.debug('Focus event from current primary', {
        clientId,
        windowId,
      })
      return
    }

    const previousPrimary = this.primaryClientId
    this.primaryClientId = clientId
    // this.logger.info('Primary controller reassigned due to focus event', {
    //   clientId,
    //   previousPrimary,
    //   windowId,
    // })
  }

  private handleRegisterWindows(clientId: string, windowIds: number[]): void {
    if (!Array.isArray(windowIds)) {
      this.logger.warn('Invalid register_windows message', { clientId })
      return
    }

    for (const windowId of windowIds) {
      this.windowOwnership.set(windowId, clientId)
      
      // Resolve any pending promises waiting for this windowId
      const pendingPromise = this.windowRegistrationPromises.get(windowId)
      if (pendingPromise) {
        clearTimeout(pendingPromise.timeout)
        pendingPromise.resolve(clientId)
        this.windowRegistrationPromises.delete(windowId)
      }
    }

    // this.logger.info('Registered windows for client', {
    //   clientId,
    //   windowCount: windowIds.length,
    //   windowIds,
    // })
  }

  private handleWindowCreated(clientId: string, windowId: number): void {
    if (typeof windowId !== 'number') {
      this.logger.warn('Invalid window_created message', { clientId, windowId })
      return
    }

    this.windowOwnership.set(windowId, clientId)
    
    // Resolve any pending promises waiting for this windowId
    const pendingPromise = this.windowRegistrationPromises.get(windowId)
    if (pendingPromise) {
      clearTimeout(pendingPromise.timeout)
      pendingPromise.resolve(clientId)
      this.windowRegistrationPromises.delete(windowId)
    }
    
    // this.logger.info('Window created and registered', { clientId, windowId })
  }

  private handleWindowRemoved(clientId: string, windowId: number): void {
    if (typeof windowId !== 'number') {
      this.logger.warn('Invalid window_removed message', { clientId, windowId })
      return
    }

    // Only remove if this client owns the window
    if (this.windowOwnership.get(windowId) === clientId) {
      this.windowOwnership.delete(windowId)
      this.logger.debug('Window removed from registry', { clientId, windowId })
    }
    
    // Reject any pending promises waiting for this windowId (window was removed before registration)
    const pendingPromise = this.windowRegistrationPromises.get(windowId)
    if (pendingPromise) {
      clearTimeout(pendingPromise.timeout)
      pendingPromise.reject(new Error(`Window ${windowId} was removed before registration completed`))
      this.windowRegistrationPromises.delete(windowId)
    }
  }

  /**
   * Wait for a windowId to be registered in windowOwnership map
   * Returns a promise that resolves when the windowId is registered, or rejects on timeout
   */
  private waitForWindowRegistration(windowId: number, timeoutMs: number): Promise<string> {
    // Check if already registered
    const existingOwner = this.windowOwnership.get(windowId)
    if (existingOwner && this.clients.has(existingOwner)) {
      return Promise.resolve(existingOwner)
    }

    // Check if there's already a pending promise for this windowId
    const existingPromise = this.windowRegistrationPromises.get(windowId)
    if (existingPromise) {
      // Reuse existing promise (multiple requests waiting for same windowId)
      return new Promise((resolve, reject) => {
        const originalResolve = existingPromise.resolve
        const originalReject = existingPromise.reject
        
        existingPromise.resolve = (clientId: string) => {
          originalResolve(clientId)
          resolve(clientId)
        }
        
        existingPromise.reject = (error: Error) => {
          originalReject(error)
          reject(error)
        }
      })
    }

    // Create new promise for this windowId
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.windowRegistrationPromises.delete(windowId)
        reject(new Error(`Window registration timeout for windowId ${windowId} after ${timeoutMs}ms`))
      }, timeoutMs)

      this.windowRegistrationPromises.set(windowId, {
        resolve,
        reject,
        timeout,
      })
    })
  }
}
