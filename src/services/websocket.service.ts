import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../utils/logger";
import { NotificationService } from "./notification.service";
import { NotificationMessage } from "../types";

export class WebSocketManager {
  private readonly wss: WebSocketServer;
  private readonly notificationService: NotificationService;
  private readonly clients: Map<string, WebSocket> = new Map();
  private readonly channelSubscriptions: Map<string, Set<string>> = new Map();
  
  constructor(wss: WebSocketServer, notificationService: NotificationService) {
    this.wss = wss;
    this.notificationService = notificationService;
    
    this.setupWebSocketServer();
  }
  
  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      logger.info(`Client ${clientId} connected`);
      
      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (error) {
          logger.error(`Error handling message from client ${clientId}:`, error);
          this.sendError(ws, "Invalid message format");
        }
      });
      
      ws.on("close", () => {
        this.handleClientDisconnect(clientId);
      });
      
      // Send client ID to the client
      this.sendMessage(ws, { type: "connection", clientId });
    });
  }
  
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private handleMessage(clientId: string, data: any): void {
    const ws = this.clients.get(clientId);
    if (!ws) return;
    
    switch (data.type) {
      case "subscribe":
        if (data.channel) {
          this.subscribeToChannel(clientId, data.channel);
          this.sendMessage(ws, {
            type: "subscribed",
            channel: data.channel,
          });
        }
        break;
        
      case "unsubscribe":
        if (data.channel) {
          this.unsubscribeFromChannel(clientId, data.channel);
          this.sendMessage(ws, {
            type: "unsubscribed",
            channel: data.channel,
          });
        }
        break;
        
      default:
        this.sendError(ws, "Unknown message type");
    }
  }
  
  private handleClientDisconnect(clientId: string): void {
    // Remove client from all channel subscriptions
    this.channelSubscriptions.forEach((clients, channel) => {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    });
    
    // Remove client from clients map
    this.clients.delete(clientId);
    
    logger.info(`Client ${clientId} disconnected`);
  }
  
  subscribeToChannel(clientId: string, channel: string): void {
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    
    this.channelSubscriptions.get(channel)?.add(clientId);
    logger.info(`Client ${clientId} subscribed to channel ${channel}`);
  }
  
  unsubscribeFromChannel(clientId: string, channel: string): void {
    this.channelSubscriptions.get(channel)?.delete(clientId);
    
    if (this.channelSubscriptions.get(channel)?.size === 0) {
      this.channelSubscriptions.delete(channel);
    }
    
    logger.info(`Client ${clientId} unsubscribed from channel ${channel}`);
  }
  
  broadcastToChannel(channel: string, notification: NotificationMessage): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) return;
    
    const message = JSON.stringify({
      type: "notification",
      channel,
      data: notification,
    });
    
    subscribers.forEach((clientId) => {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  private sendMessage(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
  
  private sendError(ws: WebSocket, message: string): void {
    this.sendMessage(ws, {
      type: "error",
      message,
    });
  }
} 