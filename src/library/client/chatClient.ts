import { HPKVNotification, HPKVWebsocketClient, NotificationHandler } from "./hpkvWebsocketClient";

// Define the structure of a chat message
export interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    id?: string; // Optional ID for message identification
}

// Define chat room structure
export interface ChatRoom {
    id: string;
    name: string;
    createdAt: number;
}

// Define the message handler type
export type MessageHandler = (messages: ChatMessage[]) => void;

// Define the chatrooms update handler type
export type ChatroomsHandler = (chatrooms: ChatRoom[]) => void;

export class ChatClient {
    private connectionPromise: Promise<void> | null = null;
    private hpkvClient: HPKVWebsocketClient;
    private messageHandlers: Set<MessageHandler> = new Set();
    private chatroomsHandlers: Set<ChatroomsHandler> = new Set();
    private notificationUnsubscribe: (() => void) | null = null;
    public roomId: string | null = null;
    private initializePromise: Promise<void> | null = null;

    constructor() {
        this.hpkvClient = new HPKVWebsocketClient();
    }

    /**
     * Subscribe to chat message notifications
     * Now provides the entire array of messages
     * 
     * @param handler - The function to be called when messages are received
     * @returns A function to unsubscribe the handler
     */
    public onMessageReceived(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);

        // Return a function to unsubscribe
        return () => {
            this.messageHandlers.delete(handler);
        };
    }

    /**
     * Subscribe to chatrooms registry updates
     * 
     * @param handler - The function to be called when chatrooms registry is updated
     * @returns A function to unsubscribe the handler
     */
    public onChatroomsUpdated(handler: ChatroomsHandler): () => void {
        this.chatroomsHandlers.add(handler);

        // Return a function to unsubscribe
        return () => {
            this.chatroomsHandlers.delete(handler);
        };
    }

    /**
     * Get all messages for the current room
     * 
     * @returns Promise that resolves with an array of ChatMessage objects
     */
    public async getRoomMessages(): Promise<ChatMessage[]> {
        if (!this.roomId) {
            throw new Error('Not joined to any room');
        }
        
        try {
            const chatRoomKey = `chat:${this.roomId}`;
            const response = await this.hpkvClient.get(chatRoomKey);
    
            if (response.value !== null) {
                try {
                    const parsedData = JSON.parse(response.value);
                    
                    // Return messages array if it exists
                    if (parsedData && parsedData.messages && Array.isArray(parsedData.messages)) {
                        return parsedData.messages;
                    }
                } catch (parseError) {
                    console.error("Error parsing messages data:", parseError);
                }
            } 
            
            return [];
        } catch (error) {
            console.error("Error fetching room messages:", error);
            return [];
        }
    }

    /**
     * Retrieves all existing chatrooms
     * 
     * @returns Promise that resolves with an array of ChatRoom objects
     */
    public async getChatrooms(): Promise<ChatRoom[]> {
        try {
            // Ensure we are initialized first
            await this.initialize();
            
            // Add a short delay to ensure the connection is fully established
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check connection state again
            if (!this.hpkvClient.isConnected()) {
                console.log("WebSocket not connected, reinitializing...");
                await this.initialize();
            }
            
            const response = await this.hpkvClient.get('chatrooms');
            
            if (!response.value) {
                return [];
            }
            
            try {
                
                const chatroomsData = JSON.parse(response.value);
                return chatroomsData.chatrooms;

            } catch (parseError) {
                console.error("Error parsing chatrooms data:", parseError);
                
                // Initialize empty chatrooms registry
                await this.hpkvClient.insert('chatrooms', JSON.stringify({ chatrooms: [] }));
                return [];
            }
        } catch (error) {
            console.error("Error fetching chatrooms:", error);
            throw error;
        }
    }

    /**
     * Handle notifications from HPKV and convert them to appropriate events
     */
    private handleNotification(notification: HPKVNotification): void {
        try {
            // Handle chat messages
            if (notification.key === `chat:${this.roomId}` && notification.value) {               
                try {
                    const chatData = JSON.parse(notification.value);
                    
                    // Notify all message handlers with the full array of messages
                    this.messageHandlers.forEach(handler => {
                        try {
                            handler(chatData.messages);
                        } catch (handlerError) {
                            console.error('Error in message handler:', handlerError);
                        }
                    });
                } catch (parseError) {
                    console.error('Error parsing chat notification:', parseError);
                    return;
                }
            } 
            // Handle chatrooms registry updates
            else if (notification.key === 'chatrooms' && notification.value) {                
                try {
                    const chatroomsData = JSON.parse(notification.value);

                    // Extract the chatrooms array
                    const chatrooms = chatroomsData?.chatrooms || [];

                    // Notify all chatrooms handlers
                    this.chatroomsHandlers.forEach(handler => {
                        try {
                            handler(chatrooms);
                        } catch (handlerError) {
                            console.error('Error in chatrooms handler:', handlerError);
                        }
                    });
                } catch (parseError) {
                    console.error('Error parsing chatrooms notification:', parseError);
                    return;
                }
            }
        } catch (error) {
            console.error('Error processing notification:', error);
        }
    }

    public async createChatroom(roomId: string, roomName?: string): Promise<void> {
        const response = await this.hpkvClient.get('chatrooms');
        
        // Parse the response.value which comes as a string
        let chatroomsRegistry: { chatrooms: ChatRoom[] } = { chatrooms: [] };
        
        if (response.value) {
            try {
                chatroomsRegistry = JSON.parse(response.value);
            } catch (parseError) {
                console.error("Error parsing chatrooms data:", parseError);
            }
        } 

        // Make sure chatroomsRegistry has the expected structure
        if (!chatroomsRegistry || !Array.isArray(chatroomsRegistry.chatrooms)) {
            chatroomsRegistry = { chatrooms: [] };
        }

        // Check if roomId already exists in the registry
        if (chatroomsRegistry.chatrooms.some(room => room.id === roomId)) {
            throw new Error(`Chat room with this ID already exists: ${roomId}`);
        }        
        // Add the room to the registry
        const roomInfo = {
            id: roomId,
            name: roomName || roomId, // Use roomName if provided, otherwise use roomId
            createdAt: Date.now()
        };

        chatroomsRegistry.chatrooms.push(roomInfo);

        // Update the chatrooms registry - always stringify
        const chatroomsData = JSON.stringify(chatroomsRegistry);
        await this.hpkvClient.insert('chatrooms', chatroomsData);
    }

    /**
     * Gets a token for the chatroom registry key at the first load
     * This method obtains the token for the chatroom registry key and listens for chatrooms updates
     * 
     * @returns Promise that resolves when token is received
     */
    public async initialize(): Promise<void> {
        // If already connected, return immediately
        if (this.hpkvClient.isConnected()) {
            return Promise.resolve();
        }
        
        // If already initializing, return the existing promise
        if (this.initializePromise) {
            return this.initializePromise;
        }
        
        console.log("Initializing chat client...");
        
        // Create the promise before any async operations to prevent race conditions
        this.initializePromise = (async () => {
            try {
                // Get token from our API endpoint
                const response = await fetch('/api/initialize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Failed to get token: ${errorData.error || response.statusText}`);
                }

                const data = await response.json();
                const token = data.token;
                
                // Connect to WebSocket
                await this.hpkvClient.connect(token);
                console.log("WebSocket connected successfully");

                // Set up notification handler
                if (this.notificationUnsubscribe) {
                    this.notificationUnsubscribe();
                }
                
                this.notificationUnsubscribe = this.hpkvClient.onNotification(
                    this.handleNotification.bind(this)
                );
                
                return;
            } catch (error) {
                console.error("Failed to initialize chat client:", error);
                this.initializePromise = null;
                throw error;
            }
        })();
        
        return this.initializePromise;
    }

    /**
     * Joins the given chat room
     * This method first obtains a token via the local API and listens for chat messages and chatrooms updates.
     * 
     * @param roomId - The room id to connect to
     * @returns Promise that resolves when connection is established
     */
    public async join(roomId: string): Promise<void> {
      // Store the userId for subscription management
     
      // If already connecting, return the existing promise
      if (this.connectionPromise) {
        return this.connectionPromise;
      }
  
      this.connectionPromise = new Promise(async (resolve, reject) => {
        try {
                // disconnect from the previous room or initial connection
                await this.disconnect();

          // Get token from our API endpoint using the userId
          const response = await fetch('/api/join-chatroom', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomId }),
          });
  
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to get token: ${errorData.error || response.statusText}`);
          }
  
          const data = await response.json();
          const token = data.token;

          await this.hpkvClient.connect(token);
                this.roomId = roomId;

                // Subscribe to notifications after connection is established
                this.notificationUnsubscribe = this.hpkvClient.onNotification(
                    this.handleNotification.bind(this)
                );
  
          resolve();
        } catch (error) {
          this.connectionPromise = null;
          reject(error);
        }
      });
  
      return this.connectionPromise;
    }
  
    /**
     * Leaves the current room
     * @returns Promise that resolves when leaving is complete
     */
    public async leave(): Promise<void> {
        try {
            // Set room ID to null first to prevent processing messages for this room
            const previousRoomId = this.roomId;
            this.roomId = null;
            
            // Unsubscribe from notifications
            if (this.notificationUnsubscribe) {
                this.notificationUnsubscribe();
                this.notificationUnsubscribe = null;
            }
            
            // Close the connection - the ChatroomsManager will handle reconnection
            this.hpkvClient.close();
            this.connectionPromise = null;
            this.initializePromise = null;
            
        } catch (err) {
            console.error("Error leaving room:", err);
            throw err;
        }
    }

    /**
     * Disconnects from the current room
     * @returns A promise that resolves when disconnection is complete
     */
    public async disconnect(): Promise<void> {
        // Unsubscribe from notifications
        if (this.notificationUnsubscribe) {
            this.notificationUnsubscribe();
            this.notificationUnsubscribe = null;
        }

        if (this.hpkvClient) {
            this.hpkvClient.close();
            this.connectionPromise = null;
            this.initializePromise = null;
        }
    }

    /**
     * Send a message to the current room
     * This will append the new message to the existing list of messages
     * 
     * @param messageText - The text message to send
     * @returns Promise that resolves when the message is sent
     */
    public async sendMessage(messageText: string): Promise<void> {
        if (!this.roomId) {
            throw new Error('No room joined');
        }

        try {
            // Get username from sessionStorage
            const username = typeof window !== 'undefined' 
                ? sessionStorage.getItem('username') || 'Anonymous' 
                : 'Anonymous';
            
            // Create the new message
            const newMessage: ChatMessage = {
                sender: username,
                message: messageText,
                timestamp: Date.now(),
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            // Get the chat room key
            const chatRoomKey = `chat:${this.roomId}`;
            
            // Fetch current messages for the room
            let existingMessages: ChatMessage[] = [];
            try {
                const response = await this.hpkvClient.get(chatRoomKey);
                if (response.value) {
                    
                    try {
                        const data = JSON.parse(response.value);
                        existingMessages = Array.isArray(data.messages) ? data.messages : [];
                    } catch (parseError) {
                        console.error("Error parsing existing messages:", parseError);
                        existingMessages = [];
                    }
                }
            } catch (error) {
                console.error("Error fetching existing messages:", error);
                existingMessages = [];
            }
            
            // Append the new message
            const updatedMessages = [...existingMessages, newMessage];
            
            // Update the chat room with all messages - always use JSON.stringify
            const messageData = JSON.stringify({ messages: updatedMessages });
                       
            await this.hpkvClient.insert(chatRoomKey, messageData);
            
        } catch (err) {
            console.error('Failed to send message:', err);
            throw err;
        }
    }

    /**
     * Cleans up resources and disconnects
     * Call this method when the client is no longer needed
     */
    public async dispose(): Promise<void> {
        await this.disconnect();
    }

    /**
     * Check if the client is connected to the WebSocket server
     * @returns True if connected, false otherwise
     */
    public isConnected(): boolean {
        return this.hpkvClient.isConnected();
    }
  }
  