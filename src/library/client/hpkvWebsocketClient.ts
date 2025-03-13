/**
 * Client for interacting with the HPKV WebSocket API.
 * Provides methods for connecting, creating, retrieving, and appending data.
 */

// Define operation types for WebSocket messages
enum OperationType {
  GET = 1,
  CREATE = 2,
  APPEND = 3
}

// Define message structure for WebSocket
interface WebSocketMessage {
  op: OperationType;
  key: string;
  value?: string | null;
  messageId: number;
}

// Define response interface
interface WebSocketResponse {
  key: string;
  value: string | null;
  messageId: number;
  status?: string;
  error?: string;
}

// Define notification interface
export interface HPKVNotification {
  type: 'notification';
  key: string;
  value: string | null;
  timestamp: number;
}

// Define notification handler type
export type NotificationHandler = (notification: HPKVNotification) => void;

export class HPKVWebsocketClient {
  private ws: WebSocket | null = null;
  private messageId: number = 0;
  private connectionPromise: Promise<void> | null = null;
  private callbacks: Map<number, { 
    resolve: (value: WebSocketResponse | PromiseLike<WebSocketResponse>) => void, 
    reject: (reason?: Error | string) => void 
  }> = new Map();
  private wsUrl: string | null = null;
  private notificationHandlers: Set<NotificationHandler> = new Set();

  constructor() {
    // Check if WebSocket URL is set in environment variables
    if (!process.env.NEXT_PUBLIC_WS_URL) {
      throw new Error('NEXT_PUBLIC_WS_URL environment variable is not set');
    }
    this.wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  }

  /**
   * Generates a unique message ID for tracking WebSocket requests
   */
  private getNextMessageId(): number {
    return ++this.messageId;
  }

  /**
   * Subscribe to key change notifications
   * 
   * @param handler - The function to be called when a notification is received
   * @returns A function to unsubscribe the handler
   */
  public onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    
    // Return a function to unsubscribe
    return () => {
      this.notificationHandlers.delete(handler);
    };
  }

  /**
   * Connect to the HPKV WebSocket API using a pre-generated token.
   * This is useful when you have already generated a token using the REST API.
   * 
   * @param token - The WebSocket token
   * @returns Promise that resolves when connection is established
   */
  public async connect(token: string): Promise<void> {
    // If already connected, return immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    // If connecting, return the existing promise
    if (this.connectionPromise && this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return this.connectionPromise;
    }

    // Close any existing connection before creating a new one
    if (this.ws) {
      this.close();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Connect to WebSocket with the token
        this.ws = new WebSocket(`${this.wsUrl}?token=${token}`);

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log(`WebSocket connection closed: ${event.reason}`);
          this.ws = null;
          this.connectionPromise = null;
          
          // Reject all pending promises
          this.callbacks.forEach(({ reject: cbReject }) => {
            cbReject(new Error('WebSocket connection closed'));
          });
          this.callbacks.clear();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection error'));
          this.connectionPromise = null;
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if this is a notification
            if (data.type === 'notification') {
              // Process as a notification
              const notification = data as HPKVNotification;
              
              // Notify all registered handlers
              this.notificationHandlers.forEach(handler => {
                try {
                  handler(notification);
                } catch (handlerError) {
                  console.error('Error in notification handler:', handlerError);
                }
              });
              
              return;
            }
            
            // Process as a response to a request
            const response = data as WebSocketResponse;
            const callback = this.callbacks.get(response.messageId);
            
            if (callback) {
              if (response.error) {
                callback.reject(new Error(response.error));
              } else {
                callback.resolve(response);
              }
              this.callbacks.delete(response.messageId);
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }
  
  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  public isConnecting(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.CONNECTING;
  }

  public isDisconnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.CLOSED;
  }

  public isCloisDisconnecting(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.CLOSING;
  }
  /**
   * Ensures the client is connected before performing operations
   */
  private async ensureConnected(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected. Call connect() first.');
    }
  }

  /**
   * Send a message to the WebSocket and wait for a response
   * 
   * @param message - The message to send
   * @returns Promise that resolves with the response
   */
  private async sendMessage(message: WebSocketMessage): Promise<WebSocketResponse> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      this.callbacks.set(message.messageId, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      // Set a timeout to reject the promise if no response is received
      setTimeout(() => {
        if (this.callbacks.has(message.messageId)) {
          this.callbacks.delete(message.messageId);
          reject(new Error(`Request timed out for messageId: ${message.messageId}`));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  /**
   * Inserts/Updates a new/existing key-value record in the database
   * 
   * @param key - The key for the record
   * @param value - The value to store
   * @returns Promise that resolves with the response
   */
  public async insert(key: string, value: string | null): Promise<WebSocketResponse> {
    const messageId = this.getNextMessageId();
    if(typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    return this.sendMessage({
      op: OperationType.CREATE,
      key,
      value,
      messageId
    });
  }

  /**
   * Get a record from the database by key
   * 
   * @param key - The key to retrieve
   * @returns Promise that resolves with the response containing the value
   */
  public async get(key: string): Promise<WebSocketResponse> {
    const messageId = this.getNextMessageId();
    return this.sendMessage({
      op: OperationType.GET,
      key,
      messageId
    });
  }

  /**
   * Append a value to an existing record.
   * If both existing value and new value are valid JSON objects,
   * a JSON patch operation is performed (merging the objects).
   * Otherwise, the new value is appended to the existing value.
   * 
   * @param key - The key of the record to append to
   * @param value - The value to append
   * @returns Promise that resolves with the response
   */
  public async append(key: string, value: string | null): Promise<WebSocketResponse> {
    const messageId = this.getNextMessageId();
    return this.sendMessage({
      op: OperationType.APPEND,
      key,
      value,
      messageId
    });
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connectionPromise = null;
    }
  }
}
