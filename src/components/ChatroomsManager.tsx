import React, { useState, useEffect } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import { ChatRoom } from '@/library/client/chatClient';

const ChatroomsManager: React.FC = () => {
  const { chatClient, joinRoom, createRoom, currentRoom, isLoading: contextLoading, error: contextError } = useChatContext();
  const [newRoomName, setNewRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [chatrooms, setChatrooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Use useEffect to safely access sessionStorage (client-side only)
  useEffect(() => {
    // This code only runs in the browser, after mount
    const storedUsername = sessionStorage.getItem('username') || '';
    setUsername(storedUsername);
  }, []);

  // Handle reconnection and chatroom fetching
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let chatroomsUnsubscribe: (() => void) | null = null;

    const initializeConnection = async () => {
      if (!isMounted) return;
      
      setIsReconnecting(true);
      setIsLoading(true);
      setError(null);
      
      try {
        // First ensure we're disconnected
        if (chatClient.isConnected()) {
          chatClient.disconnect();
        }
        
        // Wait a moment before reconnecting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Initialize the connection
        await chatClient.initialize();
        
        // Wait a bit more to ensure the connection is stable
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now fetch chatrooms
        if (isMounted) {
          await fetchChatrooms();
          
          // Subscribe to chatrooms updates
          chatroomsUnsubscribe = chatClient.onChatroomsUpdated((updatedRooms) => {
            if (isMounted) {
              console.log('Received chatrooms update:', updatedRooms);
              setChatrooms(updatedRooms);
            }
          });
          
          setIsReconnecting(false);
        }
      } catch (err) {
        console.error('Connection initialization failed:', err);
        if (isMounted) {
          setError('Failed to connect. Please refresh the page.');
          setIsLoading(false);
          setIsReconnecting(false);
        }
      }
    };

    const fetchChatrooms = async () => {
      if (!isMounted) return;
      
      try {
        // Only proceed if we're connected
        if (!chatClient.isConnected()) {
          throw new Error('Not connected');
        }
        
        const rooms = await chatClient.getChatrooms();
        
        if (isMounted) {
          console.log('Initial chatrooms loaded:', rooms);
          setChatrooms([...rooms]);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch chatrooms:', err);
        if (isMounted) {
          setError('Failed to load chat rooms. Please try again.');
          setIsLoading(false);
        }
      }
    };

    // Start the initialization process
    timeoutId = setTimeout(initializeConnection, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      
      // Clean up subscription when component unmounts
      if (chatroomsUnsubscribe) {
        chatroomsUnsubscribe();
      }
    };
  }, [chatClient]);

  // Save username to sessionStorage when it changes
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    // Only access sessionStorage on the client
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('username', value);
    }
  };

  // Generate unique room ID
  const generateRoomId = () => {
    return `room_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  };

  // Handle room creation
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    try {
      setIsLoading(true);
      // Generate a unique room ID
      const roomId = generateRoomId();
      
      await createRoom(roomId, newRoomName.trim());
      setNewRoomName('');
      setCreatingRoom(false);
      
      // The UI will be updated automatically through the onChatroomsUpdated subscription
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to create room:', err);
      setError('Failed to create room. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle joining a room
  const handleJoinRoom = async (roomId: string) => {
    if (!username.trim()) {
      alert('Please enter a username before joining a room');
      return;
    }
    
    try {
      await joinRoom(roomId);
    } catch (err) {
      console.error('Failed to join room:', err);
      setError('Failed to join room. Please try again.');
    }
  };

  // Sort rooms by creation date (newest first)
  const sortedRooms = [...chatrooms].sort((a, b) => b.createdAt - a.createdAt);

  // Combine isLoading from context and local state
  const showLoading = isLoading || contextLoading || isReconnecting;
  // Combine errors from context and local state
  const displayError = error || contextError;

  return (
    <div className="app-card p-5 max-w-2xl mx-auto animate-fade-in">
      <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">Chat Rooms</h2>
      
      {isReconnecting && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-5">
          Reconnecting to chat server...
        </div>
      )}
      
      {displayError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-5">
          {displayError}
        </div>
      )}
      
      <div className="mb-5">
        <label htmlFor="username" className="block mb-2 font-medium text-gray-700">Your Name:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Enter your name"
          required
          className="app-input w-full p-2"
        />
      </div>
      
      {creatingRoom ? (
        <form onSubmit={handleCreateRoom} className="app-card mb-5 p-4">
          <h3 className="text-xl font-semibold mb-3 text-gray-700">Create New Room</h3>
          <div className="mb-4">
            <label htmlFor="roomName" className="block mb-1 font-medium text-gray-700">Room Name:</label>
            <input
              type="text"
              id="roomName"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="My Awesome Room"
              required
              className="app-input w-full p-2"
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="submit" 
              disabled={showLoading || !newRoomName.trim()}
              className="app-button"
            >
              {showLoading ? 'Creating...' : 'Create Room'}
            </button>
            <button 
              type="button" 
              onClick={() => setCreatingRoom(false)}
              disabled={showLoading}
              className="bg-gray-100 border border-gray-300 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button 
          onClick={() => setCreatingRoom(true)}
          disabled={showLoading}
          className="app-button w-full mb-5"
        >
          Create New Room
        </button>
      )}
      
      <div className="app-card p-4">
        <h3 className="text-xl font-semibold mb-3 text-center text-gray-700">Available Rooms</h3>
        {showLoading ? (
          <div className="py-5 text-center text-gray-500">Loading rooms...</div>
        ) : sortedRooms.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {sortedRooms.map(room => (
              <li 
                key={room.id} 
                className={`py-4 flex justify-between items-center ${currentRoom === room.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{room.name}</h4>
                  <span className="text-xs text-gray-500 block">ID: {room.id}</span>
                  <span className="text-xs text-gray-500 block">
                    Created: {new Date(room.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button 
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={showLoading || currentRoom === room.id}
                  className="app-button"
                >
                  {currentRoom === room.id ? 'Joined' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-5 text-center text-gray-500">No rooms available. Create one to get started!</div>
        )}
      </div>
    </div>
  );
};

export default ChatroomsManager; 