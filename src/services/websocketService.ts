import { EventEmitter } from 'events';

interface ChatMessage {
    username: string;
    displayName: string;
    timestamp: number;
    text: string;
}

class WebSocketService extends EventEmitter {
    private ws: WebSocket | null = null;
    private accessToken: string | null = null;
    private llmCallback: ((message: string) => void) | null = null;
    
    constructor() {
        super();
    }

    setLLMCallback(callback: (message: string) => void) {
        this.llmCallback = callback;
    }

    connect(accessToken: string) {
        this.accessToken = accessToken;
        const url = `wss://chat.api.restream.io/ws?accessToken=${accessToken}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.emit('connectionChange', true);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit('rawMessage', data);
                
                if (data.action === 'event' && data.payload.eventTypeId === 24) {
                    this.handleChatMessage(data.payload.eventPayload);
                }
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.emit('connectionChange', false);
        };

        this.ws.onclose = () => {
            this.emit('connectionChange', false);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    private handleChatMessage(messageData: any) {
        const chatMessage: ChatMessage = {
            username: messageData.author.username,
            displayName: messageData.author.displayName,
            timestamp: messageData.timestamp,
            text: messageData.text
        };
        
        this.emit('chatMessage', chatMessage);

        // Send to LLM if callback is set
        if (this.llmCallback) {
            const formattedMessage = `Received these messages from your livestream, please respond:\n${chatMessage.displayName}: ${chatMessage.text}`;
            this.llmCallback(formattedMessage);
        }
    }
}

export const websocketService = new WebSocketService(); 