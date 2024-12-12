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
    private llmCallback: ((messages: string) => Promise<void>) | null = null;
    
    // New state management properties
    private messageQueue: ChatMessage[] = [];
    private isProcessing: boolean = false;
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 2000; // Wait 2 seconds to batch messages
    
    constructor() {
        super();
    }

    // Updated to handle async callback
    setLLMCallback(callback: (messages: string) => Promise<void>) {
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
        // Clear the interval when disconnecting
        if (this.batchTimeout) {
            clearInterval(this.batchTimeout);
            this.batchTimeout = null;
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
        this.queueMessage(chatMessage);
    }

    private queueMessage(message: ChatMessage) {
        this.messageQueue.push(message);
        
        // Only start the interval if it's not already running
        if (!this.batchTimeout) {
            this.batchTimeout = setInterval(() => {
                this.processMessageQueue();
            }, this.BATCH_DELAY);
        }
    }

    private async processMessageQueue() {
        // If already processing or no messages, return
        if (this.isProcessing || this.messageQueue.length === 0 || !this.llmCallback) {
            return;
        }

        this.isProcessing = true;

        try {
            // Format all queued messages
            const formattedMessages = this.messageQueue
                .map(msg => `${msg.displayName}: ${msg.text}`)
                .join('\n');
            
            const prompt = `Received these messages from your livestream, please respond:\n${formattedMessages}`;
            
            // Clear the queue before processing
            this.messageQueue = [];
            
            // Wait for the LLM processing and audio playback to complete
            await this.llmCallback(prompt);
        } catch (error) {
            console.error('Error processing message queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }
}

export const websocketService = new WebSocketService(); 