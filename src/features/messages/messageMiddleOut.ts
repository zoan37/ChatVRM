import { Message } from "@/features/messages/messages";

export class MessageMiddleOut {
  private maxMessages: number;
  private maxAggregateSize: number;

  constructor(maxMessages: number = 1000, maxAggregateSize: number = 1_000_000) {
    this.maxMessages = maxMessages;
    this.maxAggregateSize = maxAggregateSize;
  }

  private getTotalSize(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  }

  public process(messages: Message[]): Message[] {
    if (messages.length <= this.maxMessages && 
        this.getTotalSize(messages) <= this.maxAggregateSize) {
      return messages;
    }

    // Keep removing from middle until we're under both limits
    while (messages.length > this.maxMessages || 
           this.getTotalSize(messages) > this.maxAggregateSize) {
      
      const middleIndex = Math.floor(messages.length / 2);
      messages.splice(middleIndex, 1);
    }

    return messages;
  }
}