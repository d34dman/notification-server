import { WebSocket, WebSocketServer } from "ws";
import { Redis } from "ioredis";
import { logger } from "../utils/logger";
import { AccessControlService } from "./access-control.service";
import { NotificationService } from "./notification.service";
import { NotificationMessage, SubscriptionRequest } from "../types";

interface WebSocketClient {
  ws: WebSocket;
  clientId: string;
  subscribedChannels: Set<string>;
  lastPing: number;
  isAlive: boolean;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient>;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  constructor(
    private redis: Redis,
    private accessControl: AccessControlService,
    private notificationService: NotificationService
  ) {
    this.clients = new Map();
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", this.handleConnection.bind(this));
    this.wss.on("error", this.handleServerError.bind(this));
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      this.checkConnections();
    }, this.PING_INTERVAL);
  }

  private checkConnections(): void {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      if (!client.isAlive) {
        logger.warn(`Client ${clientId} did not respond to ping, closing connection`);
        this.closeClient(clientId, 1001, "No response to ping");
        continue;
      }

      client.isAlive = false;
      client.ws.ping();
    }
  }

  private handleServerError(error: Error): void {
    logger.error("WebSocket server error:", error);
  }

  private async handleConnection(ws: WebSocket, clientId: string): Promise<void> {
    try {
      // Validate client ID
      const isValid = await this.accessControl.validateClientId(clientId);
      if (!isValid) {
        logger.warn(`Invalid client ID: ${clientId}`);
        ws.close(1008, "Invalid client ID");
        return;
      }

      // Create client record
      const client: WebSocketClient = {
        ws,
        clientId,
        subscribedChannels: new Set(),
        lastPing: Date.now(),
        isAlive: true,
      };

      this.clients.set(clientId, client);

      // Setup message handlers
      ws.on("message", (data) => this.handleMessage(clientId, data));
      ws.on("pong", () => this.handlePong(clientId));
      ws.on("close", () => this.handleClose(clientId));
      ws.on("error", (error) => this.handleError(clientId, error));

      // Send connection success message
      ws.send(
        JSON.stringify({
          type: "connection",
          status: "connected",
          clientId,
          timestamp: new Date().toISOString(),
        })
      );

      logger.info(`Client connected: ${clientId}`);
    } catch (error) {
      logger.error(`Error handling connection for client ${clientId}:`, error);
      ws.close(1011, "Internal server error");
    }
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastPing = Date.now();
    }
  }

  private async handleMessage(clientId: string, data: string | Buffer | ArrayBuffer | Buffer[]): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) {
        logger.warn(`Received message from unknown client: ${clientId}`);
        return;
      }

      const message = JSON.parse(data.toString());
      logger.debug(`Received message from client ${clientId}:`, message);

      switch (message.type) {
        case "subscribe":
          await this.handleSubscribe(client, message);
          break;
        case "unsubscribe":
          await this.handleUnsubscribe(client, message);
          break;
        case "ping":
          client.ws.pong();
          break;
        default:
          logger.warn(`Unknown message type from client ${clientId}: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling message from client ${clientId}:`, error);
      this.sendError(clientId, "Invalid message format");
    }
  }

  private async handleSubscribe(
    client: WebSocketClient,
    message: SubscriptionRequest
  ): Promise<void> {
    try {
      const { channel } = message;

      // Check channel access
      const hasAccess = await this.accessControl.hasChannelAccess(client.clientId, channel);
      if (!hasAccess) {
        this.sendError(client.clientId, `Access denied to channel: ${channel}`);
        return;
      }

      // Subscribe to channel
      await this.redis.sadd(`channel:${channel}:subscribers`, client.clientId);
      await this.redis.sadd(`client:${client.clientId}:channels`, channel);
      client.subscribedChannels.add(channel);

      // Send subscription success message
      client.ws.send(
        JSON.stringify({
          type: "subscription",
          status: "subscribed",
          channel,
          timestamp: new Date().toISOString(),
        })
      );

      logger.info(`Client ${client.clientId} subscribed to channel: ${channel}`);
    } catch (error) {
      logger.error(`Error handling subscription for client ${client.clientId}:`, error);
      this.sendError(client.clientId, "Failed to subscribe to channel");
    }
  }

  private async handleUnsubscribe(
    client: WebSocketClient,
    message: SubscriptionRequest
  ): Promise<void> {
    try {
      const { channel } = message;

      // Unsubscribe from channel
      await this.redis.srem(`channel:${channel}:subscribers`, client.clientId);
      await this.redis.srem(`client:${client.clientId}:channels`, channel);
      client.subscribedChannels.delete(channel);

      // Send unsubscription success message
      client.ws.send(
        JSON.stringify({
          type: "subscription",
          status: "unsubscribed",
          channel,
          timestamp: new Date().toISOString(),
        })
      );

      logger.info(`Client ${client.clientId} unsubscribed from channel: ${channel}`);
    } catch (error) {
      logger.error(`Error handling unsubscription for client ${client.clientId}:`, error);
      this.sendError(client.clientId, "Failed to unsubscribe from channel");
    }
  }

  private async handleClose(clientId: string): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Unsubscribe from all channels
      for (const channel of client.subscribedChannels) {
        await this.redis.srem(`channel:${channel}:subscribers`, clientId);
        await this.redis.srem(`client:${clientId}:channels`, channel);
      }

      this.clients.delete(clientId);
      logger.info(`Client disconnected: ${clientId}`);
    } catch (error) {
      logger.error(`Error handling client disconnect: ${clientId}`, error);
    }
  }

  private handleError(clientId: string, error: Error): void {
    logger.error(`WebSocket error for client ${clientId}:`, error);
    this.closeClient(clientId, 1011, "Internal server error");
  }

  private closeClient(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.close(code, reason);
      this.clients.delete(clientId);
    }
  }

  private sendError(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          message,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  public async broadcastNotification(channel: string, notification: NotificationMessage): Promise<void> {
    try {
      const subscribers = await this.redis.smembers(`channel:${channel}:subscribers`);
      
      for (const clientId of subscribers) {
        const client = this.clients.get(clientId);
        if (client && client.subscribedChannels.has(channel)) {
          try {
            client.ws.send(JSON.stringify(notification));
          } catch (error) {
            logger.error(`Error sending notification to client ${clientId}:`, error);
            this.closeClient(clientId, 1011, "Error sending notification");
          }
        }
      }
    } catch (error) {
      logger.error(`Error broadcasting notification to channel ${channel}:`, error);
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getSubscribedChannels(clientId: string): string[] {
    const client = this.clients.get(clientId);
    return client ? Array.from(client.subscribedChannels) : [];
  }

  public cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    for (const [clientId] of this.clients.entries()) {
      this.closeClient(clientId, 1001, "Server shutting down");
    }
    this.wss.close();
  }

  public handleUpgrade(
    request: any,
    socket: any,
    head: any,
    clientId: string
  ): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, clientId);
    });
  }
}
