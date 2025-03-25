import React, { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import MessageItem from './MessageItem';
import { ChatMessage, ChatRoom } from '../library/client/chatClient';

const SendIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="w-5 h-5"
  >
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

const Chatroom: React.FC = () => {
  const { 
    currentRoom, 
    chatClient, 
    chatrooms,
    sendMessage, 
    leaveRoom, 
    isLoading, 
    error: contextError
  } = useChatContext();
  
  const [messageInput, setMessageInput] = useState('');
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only access sessionStorage on the client-side
    if (typeof window !== 'undefined') {
      const storedUsername = sessionStorage.getItem('username') || '';
      setUsername(storedUsername);
    }
  }, []);

  // Load messages when joining a room
  useEffect(() => {
    async function loadRoomMessages() {
      if (!currentRoom || !chatClient) return;
      
      try {
        setLoadingMessages(true);
        setError(null);
        
        // Get messages from the server
        const roomMessages = await chatClient.getRoomMessages();
        console.log(`Loaded ${roomMessages.length} messages from server for room: ${currentRoom}`);
        
        if (Array.isArray(roomMessages)) {
          setMessages(roomMessages);
        } else {
          console.error('Invalid messages format:', roomMessages);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please try leaving and rejoining the room.');
      } finally {
        setLoadingMessages(false);
      }
    }
    
    if (currentRoom && chatClient) {
      loadRoomMessages();
    } else {
      // Clear messages when leaving a room
      setMessages([]);
    }
  }, [currentRoom, chatClient]);

  // Subscribe to message updates
  useEffect(() => {
    if (!currentRoom || !chatClient) return;
    
    // Subscribe to new messages - now we receive full array of messages
    const unsubscribe = chatClient.onMessageReceived((updatedMessages) => {
      console.log(`Received updated messages (${updatedMessages.length}) for room: ${currentRoom}`);
      
      if (Array.isArray(updatedMessages)) {
        // Sort messages by timestamp if needed
        const sortedMessages = [...updatedMessages].sort((a, b) => a.timestamp - b.timestamp);
        setMessages(sortedMessages);
      } else {
        console.error('Received invalid messages format:', updatedMessages);
      }
    });
    
    // Clean up subscription
    return () => {
      unsubscribe();
    };
  }, [currentRoom, chatClient]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !username || sendingMessage) return;
    
    try {
      setSendingMessage(true);
      setError(null);
      await sendMessage(messageInput);
      setMessageInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (!currentRoom) {
    return null;
  }

  // Get room info
  const roomInfo = chatrooms.find((room: ChatRoom) => room.id === currentRoom);
  const displayError = error || contextError;

  return (
    <div className="app-card p-5 mx-auto max-w-4xl h-[85vh] flex flex-col animate-fade-in">
      {displayError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {displayError}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white rounded-lg p-3">
        <div className="flex flex-col">
            <div className="flex items-center mt-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
          <h2 className="text-2xl font-bold text-blue-600">
            Live Chat
          </h2>
          </div>
        </div>
        <div className="flex items-center">
          <div className="flex items-center mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-black">{roomInfo?.name || "General"}</span>
          </div>
          <button 
            onClick={leaveRoom}
            className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-full transition-all hover:scale-105 font-medium"
            disabled={isLoading || loadingMessages}
          >
            Leave Room
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto app-scrollbar mb-4">
        {isLoading || loadingMessages ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length > 0 ? (
          <ul className="space-y-3">
            {messages.map((message, index) => (
              <MessageItem 
                key={message.id || `${message.sender}-${message.timestamp}-${index}`} 
                message={message} 
                isOwnMessage={message.sender === username}
              />
            ))}
            <div ref={messagesEndRef} />
          </ul>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">No messages yet. Be the first to send one!</p>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Share your thoughts..."
          className="app-input flex-1 p-3 border-2 border-gray-200 shadow-sm focus:shadow-md transition-shadow"
          disabled={isLoading || loadingMessages || sendingMessage}
        />
        <button 
          type="submit" 
          disabled={!messageInput.trim() || isLoading || loadingMessages || sendingMessage || !username}
          className={`app-button !px-4 hover:scale-105 transition-all group ${sendingMessage ? 'opacity-70' : ''}`}
        >
          {sendingMessage ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="group-hover:animate-bounce">
              <SendIcon />
            </div>
          )}
        </button>
      </form>
    </div>
  );
};

export default Chatroom; 