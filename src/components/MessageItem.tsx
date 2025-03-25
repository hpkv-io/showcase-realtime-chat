import React from 'react';
import { ChatMessage } from '../library/client/chatClient';
import { useChatContext } from '../contexts/ChatContext';

interface MessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

// Extending the reaction type for our enhanced features
type MessageReactions = {
  likes?: number;
  fire?: number;
  heart?: number;
  laugh?: number;
};

// Helper function to get consistent color for a username
const getUserColor = (username: string) => {
  // Simple hash function for username to get consistent color
  const colors = [
    'from-green-400 to-green-500',   // Soft green
    'from-orange-400 to-orange-500', // Light orange
    'from-blue-400 to-blue-500',     // Blue
    'from-pink-400 to-pink-500',     // Pink
    'from-yellow-400 to-yellow-500', // Yellow
    'from-teal-400 to-teal-500',     // Teal
  ];
  
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const MessageItem: React.FC<MessageItemProps> = ({ message, isOwnMessage }) => {
  const { chatClient } = useChatContext();
  
  // Ensure message content is a string
  const messageContent = typeof message.message === 'string' 
    ? message.message 
    : String(message.message || '');
  
  // Ensure sender is a string
  const sender = typeof message.sender === 'string' ? message.sender : 'Unknown';
  
  // Get user color based on username
  const userColor = isOwnMessage 
    ? 'from-indigo-500 to-purple-600' 
    : getUserColor(sender);
  
  // Get bubble color based on user
  const bubbleColor = isOwnMessage
    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
    : 'bg-gray-100 text-gray-700';
  
  const formatTime = (timestamp: number | undefined) => {
    if (!timestamp || isNaN(timestamp)) return '';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const handleReaction = async (type: 'likes' | 'fire' | 'heart' | 'laugh') => {
    if (!message.id || !chatClient) return;
    
    try {
      // Cast the reactions to our extended type to avoid TypeScript errors
      const currentReactions = (message.reactions || { likes: 0, fire: 0 }) as MessageReactions;
      // Add heart and laugh if they don't exist
      if (currentReactions.heart === undefined) currentReactions.heart = 0;
      if (currentReactions.laugh === undefined) currentReactions.laugh = 0;
      
      const updatedReactions = {
        ...currentReactions,
        [type]: (currentReactions[type] || 0) + 1
      };
      
      // Get current room messages
      const messages = await chatClient.getRoomMessages();
      
      // Find and update the target message - ensure it matches the ChatMessage type
      const updatedMessages = messages.map(msg => {
        if (msg.id === message.id) {
          // Create a properly typed object that matches ChatMessage
          const updatedMsg = { ...msg };
          // Update the reactions while preserving the ChatMessage type
          updatedMsg.reactions = updatedReactions as any; // Force type to match what the API expects
          return updatedMsg;
        }
        return msg;
      });
      
      // Update the messages in the room
      await chatClient.updateRoomMessages(updatedMessages);
    } catch (error) {
      console.error('Failed to update reaction:', error);
    }
  };

  // Cast reactions to our extended type
  const messageReactions = (message.reactions || {}) as MessageReactions;

  // Check if message has any reactions
  const hasReactions = messageReactions && (
    (messageReactions.likes || 0) > 0 || 
    (messageReactions.fire || 0) > 0 ||
    (messageReactions.heart || 0) > 0 ||
    (messageReactions.laugh || 0) > 0
  );

  // Get reaction counts safely
  const likesCount = messageReactions.likes || 0;
  const fireCount = messageReactions.fire || 0;
  const heartCount = messageReactions.heart || 0;
  const laughCount = messageReactions.laugh || 0;

  return (
    <li className={`flex gap-3 px-4 py-2 group hover:bg-gray-50/50 transition-colors ${isOwnMessage ? 'flex-row-reverse' : ''} relative`}>
      {/* Timeline connector */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-100 -z-10"></div>
      
      {/* Avatar */}
      <div className="flex-shrink-0 z-10">
        <div className={`avatar bg-gradient-to-br ${userColor} w-11 h-11 text-lg`}>
          {sender.charAt(0).toUpperCase()}
        </div>
      </div>
      
      {/* Message content */}
      <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Sender and time */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-gray-700">{sender}</span>
          <span className="text-xs text-gray-400 italic">{formatTime(message.timestamp)}</span>
        </div>
        
        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${bubbleColor}`}>
          <div className="text-[15px] leading-relaxed">{messageContent}</div>
        </div>

        {/* Reactions container */}
        <div className={`flex items-center gap-2 mt-2 text-sm ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          {/* Show reactions that have counts */}
          {likesCount > 0 && (
            <div className="reaction-count">
              <span className="text-lg">👍</span>
              <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                {likesCount}
              </span>
            </div>
          )}
          {fireCount > 0 && (
            <div className="reaction-count">
              <span className="text-lg">🔥</span>
              <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                {fireCount}
              </span>
            </div>
          )}
          {heartCount > 0 && (
            <div className="reaction-count">
              <span className="text-lg">❤️</span>
              <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                {heartCount}
              </span>
            </div>
          )}
          {laughCount > 0 && (
            <div className="reaction-count">
              <span className="text-lg">😂</span>
              <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                {laughCount}
              </span>
            </div>
          )}
          
          {/* Reaction buttons - only visible on hover */}
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            hasReactions ? 'ml-2' : ''
          }`}>
            <button 
              onClick={() => handleReaction('likes')}
              className="reaction-button-hover text-lg"
              title="Like"
            >
              👍
            </button>
            <button 
              onClick={() => handleReaction('fire')}
              className="reaction-button-hover text-lg"
              title="Fire"
            >
              🔥
            </button>
            <button 
              onClick={() => handleReaction('heart')}
              className="reaction-button-hover text-lg"
              title="Heart"
            >
              ❤️
            </button>
            <button 
              onClick={() => handleReaction('laugh')}
              className="reaction-button-hover text-lg"
              title="Laugh"
            >
              😂
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

export default MessageItem; 