import { useEffect, useState } from 'react';
import Head from 'next/head';
import { ChatProvider } from '../contexts/ChatContext';
import ChatroomsManager from '../components/ChatroomsManager';
import Chatroom from '../components/Chatroom';
import { useChatContext } from '../contexts/ChatContext';

// Main chat app content
const ChatContent = () => {
  const { currentRoom } = useChatContext();
  return currentRoom ? <Chatroom /> : <ChatroomsManager />;
};

// Home page component
export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <Head>
        <title>Live Chat App</title>
        <meta name="description" content="A real-time chat application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="min-h-screen bg-white text-gray-800 flex flex-col">
        <header className="py-4 px-6 border-b border-gray-200">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-3xl font-bold text-blue-600">Live Chat</h1>
            <p className="text-gray-500">Real-time messaging app</p>
          </div>
        </header>
        
        <main className="flex-1 p-4">
          <ChatProvider>
            {mounted && <ChatContent />}
          </ChatProvider>
        </main>
        
        <footer className="py-4 px-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <div className="max-w-6xl mx-auto">
            <p>© {new Date().getFullYear()} Live Chat App. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
} 