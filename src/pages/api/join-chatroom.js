import { HPKVRestClient } from '../../library/server/hpkvRestClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { roomId } = req.body;
    
    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    // Initialize the HPKV REST client
    const hpkvClient = new HPKVRestClient();
    
    // Define the chat room key
    const chatRoomKey = `chat:${roomId}`;
    const response = await hpkvClient.get(chatRoomKey);
    if (!response?.value) {
    // Initialize the chat room with an empty string if it doesn't exist
    await hpkvClient.insert(chatRoomKey, '{"messages":[]}', { partialUpdate: false });
    }
    
    // Generate WebSocket token for this chat room and the chat rooms registry
    // Use accessPattern to restrict operations to only these specific keys
    const accessPattern = `^(${chatRoomKey}|chatrooms)$`;
    const tokenData = await hpkvClient.generateWebsocketToken([chatRoomKey, "chatrooms"], accessPattern);
    
    res.status(200).json(tokenData);
  } catch (error) {
    console.error('Error getting WebSocket token:', error);
    res.status(500).json({ message: 'Failed to get WebSocket token', error: error.message });
  }
} 