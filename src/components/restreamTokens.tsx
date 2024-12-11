import React, { useState, useEffect, useRef } from 'react';
import { TextButton } from './textButton';
import Cookies from 'js-cookie';

interface RestreamTokens {
  access_token: string;
  refresh_token: string;
}

type Props = {
  onTokensUpdate: (tokens: RestreamTokens | null) => void;
};

export const RestreamTokens: React.FC<Props> = ({ onTokensUpdate }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Load saved tokens on component mount
  useEffect(() => {
    const savedTokens = Cookies.get('restream_tokens');
    if (savedTokens) {
      try {
        const tokens = JSON.parse(savedTokens);
        setJsonInput(JSON.stringify(tokens, null, 2));
      } catch (err) {
        console.error('Error parsing saved tokens:', err);
      }
    }
  }, []);

  const handleJsonPaste = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(event.target.value);
    setError(null);
  };

  const handleSaveTokens = () => {
    try {
      const tokens: RestreamTokens = JSON.parse(jsonInput);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Invalid token format');
      }

      // Format the JSON string with proper indentation
      const formattedJson = JSON.stringify(tokens, null, 2);
      
      // Save to cookies with 30 days expiry
      Cookies.set('restream_tokens', formattedJson, { expires: 30 });
      onTokensUpdate(tokens);
      setError(null);
      setJsonInput(formattedJson); // Keep the formatted JSON in the textarea
    } catch (err) {
      setError('Invalid JSON format. Please check your input.');
    }
  };

  const handleClearTokens = () => {
    Cookies.remove('restream_tokens');
    onTokensUpdate(null);
    setJsonInput('');
    setError(null);
  };

  const connectWebSocket = () => {
    try {
      const tokens: RestreamTokens = JSON.parse(jsonInput);
      
      if (!tokens.access_token) {
        setError('No access token available');
        return;
      }

      const url = `wss://chat.api.restream.io/ws?accessToken=${tokens.access_token}`;
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const action = JSON.parse(event.data);
          setMessages(prev => [...prev, JSON.stringify(action, null, 2)]);
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setError(null);
      };

    } catch (err) {
      setError('Invalid JSON format or connection error');
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Restream Integration</div>
      <div className="my-16">
        Paste your Restream authentication tokens JSON here:
      </div>
      <textarea
        value={jsonInput}
        onChange={handleJsonPaste}
        placeholder='{"access_token": "...", "refresh_token": "..."}'
        className="px-16 py-8 bg-surface1 hover:bg-surface1-hover h-96 rounded-8 w-full font-mono text-sm"
      />
      {error && (
        <div className="text-red-500 my-8">{error}</div>
      )}
      <div className="flex gap-4 my-16">
        <TextButton onClick={handleSaveTokens}>Save Tokens</TextButton>
        <TextButton onClick={handleClearTokens}>Clear Tokens</TextButton>
        <TextButton 
          onClick={isConnected ? disconnectWebSocket : connectWebSocket}
        >
          {isConnected ? 'Stop Listening' : 'Start Listening'}
        </TextButton>
      </div>

      {/* Connection Status */}
      <div className={`my-8 p-8 rounded-4 ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}>
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Messages Display */}
      {messages.length > 0 && (
        <div className="my-16">
          <div className="typography-16 font-bold mb-8">Incoming Messages:</div>
          <div className="bg-surface1 p-16 rounded-8 max-h-[400px] overflow-y-auto">
            {messages.map((msg, index) => (
              <pre key={index} className="font-mono text-sm mb-8 whitespace-pre-wrap">
                {msg}
              </pre>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        Your Restream tokens will be stored securely in browser cookies and restored when you return.
      </div>
    </div>
  );
}; 