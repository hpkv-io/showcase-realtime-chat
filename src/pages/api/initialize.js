import { HPKVRestClient } from '../../library/server/hpkvRestClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Initialize the HPKV REST client
    const hpkvClient = new HPKVRestClient();
    
    // Check for the 'chatrooms' registry key
    try {
      await hpkvClient.get('chatrooms');
    } catch (error) {
      // If the key doesn't exist, initialize it with an empty array
      if (error.message.includes('Record not found')) {
        await hpkvClient.insert('chatrooms', { chatrooms: [] });
      } else {
        throw error;
      }
    }
    
    // Generate WebSocket token with subscription to the chatrooms key
    // Using accessPattern "^chatrooms$" to restrict operations to only the exact "chatrooms" key
    const tokenData = await hpkvClient.generateWebsocketToken(['chatrooms'], '^chatrooms$');
    
    res.status(200).json(tokenData);
  } catch (error) {
    console.error('Error initializing client:', error);
    res.status(500).json({ 
      message: 'Failed to initialize client', 
      error: error.message 
    });
  }
} 