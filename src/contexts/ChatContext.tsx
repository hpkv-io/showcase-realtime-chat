import React, { createContext, useContext, useEffect, useState } from 'react';
import { ChatClient, ChatMessage, ChatRoom } from '../library/client/chatClient';

interface ChatContextType {
  chatClient: ChatClient;
  chatrooms: ChatRoom[];
  currentRoom: string | null;
  isLoading: boolean;
  error: string | null;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  createRoom: (roomId: string, roomName?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [chatClient] = useState(() => new ChatClient());
  const [chatrooms, setChatrooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the chat client and listen for chatroom updates
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoading(true);
        await chatClient.initialize();
        const availableRooms = await chatClient.getChatrooms();
        setChatrooms(availableRooms);
        
        // Subscribe to chatrooms updates
        const unsubscribe = chatClient.onChatroomsUpdated((updatedRooms) => {
          setChatrooms(updatedRooms);
        });
        
        setIsLoading(false);
        
        // Clean up subscription when component unmounts
        return () => {
          unsubscribe();
          chatClient.dispose();
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize chat');
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [chatClient]);

  // Join a chat room
  const joinRoom = async (roomId: string) => {
    try {
      setIsLoading(true);
      await chatClient.join(roomId);
      setCurrentRoom(roomId);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsLoading(false);
      throw err;
    }
  };

  // Leave the current room
  const leaveRoom = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await chatClient.leave();
      const availableRooms = await chatClient.getChatrooms();
        setChatrooms(availableRooms);
      setCurrentRoom(null);
      
      // Don't set isLoading to false here - let the ChatroomsManager handle it
      // since it needs to reconnect and fetch rooms
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave room');
      setIsLoading(false);
      throw err;
    }
  };

  // Create a new chat room
  const createRoom = async (roomId: string, roomName?: string) => {
    try {
      setIsLoading(true);
      await chatClient.createChatroom(roomId, roomName);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsLoading(false);
      throw err;
    }
  };

  // Send a message to the current room
  const sendMessage = async (message: string) => {
    if (!currentRoom) {
      throw new Error('No room joined');
    }

    try {
      await chatClient.sendMessage(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  };

  const value = {
    chatClient,
    chatrooms,
    currentRoom,
    isLoading,
    error,
    joinRoom,
    leaveRoom,
    createRoom,
    sendMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 