/**
 * Client for interacting with the HPKV REST API.
 * Provides methods for inserting, retrieving data, and generating WebSocket tokens.
 */

interface InsertOptions {
  partialUpdate?: boolean;
}

export class HPKVRestClient {
  private apiKey: string | null = null;
  private baseUrl: string | null = null;

  /**
   * Initialize the client with API key and base URL from environment variables
   */
  constructor() {
    // API key and base URL will be retrieved from environment variables
    this.apiKey = process.env.HPKV_API_KEY || null;
    this.baseUrl = process.env.HPKV_BASE_URL || null;
  }

  /**
   * Insert, update or partially update a record
   * 
   * @param key - The key for the record
   * @param value - The value to store
   * @param options - Optional parameters like partialUpdate
   * @returns Promise that resolves with the response
   */
  public async insert(
    key: string, 
    value: string | number | boolean | object | null,
    options: InsertOptions = {}
  ): Promise<{ success: boolean; message: string }> {

    const response = await fetch(`${this.baseUrl}/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!
      },
      body: JSON.stringify({
        key,
        value: JSON.stringify(value),
        partialUpdate: options.partialUpdate
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to insert record: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get a record from the database by key
   * 
   * @param key - The key to retrieve
   * @returns Promise that resolves with the value
   */
  public async get(key: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/record/${key}`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey || ''
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get record: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Generate a WebSocket token with the specified subscription keys
   * 
   * @param subscribeKeys - Array of keys to subscribe to
   * @param accessPattern - Optional access pattern for the token (regex).
   * @returns Promise that resolves with the token
   */
  public async generateWebsocketToken(
    subscribeKeys: string[],
    accessPattern?: string
  ): Promise<{ token: string }> {
    // Create request body with required subscribeKeys
    const requestBody: any = { subscribeKeys };
    
    // Add accessPattern to the request body if provided
    if (accessPattern !== undefined) {
      requestBody.accessPattern = accessPattern;
    }

    const response = await fetch(`${this.baseUrl}/token/websocket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to generate token: ${response.status} ${errorText}`);
    }

    return await response.json();
  }
} 