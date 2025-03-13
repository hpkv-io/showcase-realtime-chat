import React from 'react';
import { ChatMessage } from '../library/client/chatClient';

interface MessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isOwnMessage }) => {
  // Ensure message content is a string
  const messageContent = typeof message.message === 'string' 
    ? message.message 
    : String(message.message || '');
  
  // Ensure sender is a string
  const sender = typeof message.sender === 'string' ? message.sender : 'Unknown';
  
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

  return (
    <li className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`app-message ${isOwnMessage ? 'app-message-sent' : 'app-message-received'} max-w-[75%]`}>
        {!isOwnMessage && <div className="font-bold text-sm mb-1">{sender}</div>}
        <div className="message-content">{messageContent}</div>
        <div className="text-right text-xs text-gray-500 mt-1">
          {formatTime(message.timestamp) || ''}
        </div>
      </div>
    </li>
  );
};

export default MessageItem; 