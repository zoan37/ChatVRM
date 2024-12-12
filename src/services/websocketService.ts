import { EventEmitter } from 'events';

interface ChatMessage {
    username: string;
    displayName: string;
    timestamp: number;
    text: string;
}

type LLMCallback = (message: string) => Promise<{
    processed: boolean;
    error?: string;
}>;

// TODO: Add middle out. Even though OpenRouter uses middle out, we should do it on our side
// to prevent the requests to OpenRouter from being too large.

// TODO: Refresh access token. Right now, the websocket will fail after 1 hour (time for access token to expire).

export class WebSocketService extends EventEmitter {
    private ws: WebSocket | null = null;
    private accessToken: string | null = null;
    private llmCallback: LLMCallback | null = null;
    
    // New state management properties
    private messageQueue: ChatMessage[] = [];
    private isProcessing: boolean = false;
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 2000; // Wait 2 seconds to batch messages
    
    constructor() {
        super();
    }

    // Updated to handle async callback
    setLLMCallback(callback: LLMCallback) {
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

    public handleChatMessage(messageData: any) {
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
        
        // Take a snapshot of current messages to process, leaving the queue open for new messages
        const messagesToProcess = [...this.messageQueue];
        // Clear only the messages we're about to process
        this.messageQueue = this.messageQueue.slice(messagesToProcess.length);

        try {
            // Format messages from our snapshot
            const formattedMessages = messagesToProcess
                .map(msg => `${msg.displayName}: ${msg.text}`)
                .join('\n');

            console.log(`Processing ${messagesToProcess.length} messages in batch`);
            
            const prompt = `Received these messages from your livestream, please respond:\n${formattedMessages}`;
            
            const result = await this.llmCallback(prompt);
            if (!result.processed) {
                console.log(`Message processing skipped: ${result.error}`);
                // Add failed messages back to the front of the queue
                this.messageQueue = [...messagesToProcess, ...this.messageQueue];
            }
        } catch (error) {
            console.error('Error processing message queue:', error);
            // Add failed messages back to the front of the queue
            this.messageQueue = [...messagesToProcess, ...this.messageQueue];
        } finally {
            this.isProcessing = false;
        }
    }
}

export const websocketService = new WebSocketService(); 