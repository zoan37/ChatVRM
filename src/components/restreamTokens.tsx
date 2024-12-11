import React, { useState, useEffect } from 'react';
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
      </div>
      <div className="text-sm text-gray-600">
        Your Restream tokens will be stored securely in browser cookies and restored when you return.
      </div>
    </div>
  );
}; 