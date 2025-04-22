import { WebSocket } from "ws";
import { Redis } from "ioredis";
import { logger } from "../utils/logger";
import { AccessControlService } from "./access-control.service";
import { NotificationService } from "./notification.service";
import { SubscriptionService } from "./subscription.service";

interface WebSocketClient {
  ws: WebSocket;
  clientId: string;
  subscribedChannels: Set<string>;
  lastValidation: number;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private readonly redis: Redis;
  private readonly accessControl: AccessControlService;
  private readonly notificationService: NotificationService;
  private readonly subscriptionService: SubscriptionService;
  private readonly validationInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    redis: Redis,
    accessControl: AccessControlService,
    notificationService: NotificationService,
    subscriptionService: SubscriptionService
  ) {
    console.log("🟥 👻 WebSocketManager constructor");
    this.redis = redis;
    this.accessControl = accessControl;
    this.notificationService = notificationService;
    this.subscriptionService = subscriptionService;
  }

  /**
   * Handles new WebSocket connections
   * @param ws WebSocket connection
   * @param clientId Client ID from query parameters
   */
  public async handleConnection(ws: WebSocket, clientId: string): Promise<void> {
    console.log("🟥 👻 handleConnection");
    try {
      // Validate client ID
      const isValid = await this.accessControl.validateClientId(clientId);
      if (!isValid) {
        logger.warn(`Invalid client ID: ${clientId}`);
        ws.close(4001, "Invalid client ID");
        return;
      }

      // Create client record with validation timestamp
      const client: WebSocketClient = {
        ws,
        clientId,
        subscribedChannels: new Set(),
        lastValidation: Date.now(),
      };

      // Store client
      this.clients.set(clientId, client);

      // Send connection confirmation
      ws.send(
        JSON.stringify({
          type: "connection",
          clientId,
          message: "Connected successfully",
        })
      );

      logger.info(`Client connected: ${clientId}`);

      // Set up message handler
      ws.on("message", (message: string) => this.handleMessage(ws, message));

      // Set up close handler
      ws.on("close", () => this.handleClientDisconnect(clientId));

      // Set up periodic validation
      this.setupValidationInterval(client);
    } catch (error) {
      logger.error(`Connection error: ${error}`);
      ws.close(4000, "Connection error");
    }
  }

  /**
   * Sets up periodic validation for a client
   * @param client WebSocket client
   */
  private setupValidationInterval(client: WebSocketClient): void {
    console.log("🟥 👻 setupValidationInterval");
    const interval = setInterval(async () => {
      try {
        if (!this.clients.has(client.clientId)) {
          clearInterval(interval);
          return;
        }

        const isValid = await this.accessControl.validateClientId(client.clientId);
        if (!isValid) {
          logger.warn(`Client ID validation failed: ${client.clientId}`);
          client.ws.close(4001, "Client ID validation failed");
          this.handleClientDisconnect(client.clientId);
          clearInterval(interval);
        } else {
          client.lastValidation = Date.now();
        }
      } catch (error) {
        logger.error(`Validation error for client ${client.clientId}:`, error);
      }
    }, this.validationInterval);
  }

  /**
   * Handles incoming WebSocket messages
   * @param ws WebSocket connection
   * @param message Raw message string
   */
  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
    console.log("🟥 👻 handleMessage");
    try {
      const data = JSON.parse(message);
      const client = this.getClientByWebSocket(ws);

      if (!client) {
        logger.warn("Received message from unknown client");
        return;
      }

      // Validate client ID before processing message
      const isValid = await this.accessControl.validateClientId(client.clientId);
      if (!isValid) {
        logger.warn(`Invalid client ID during message handling: ${client.clientId}`);
        ws.close(4001, "Invalid client ID");
        return;
      }

      client.lastValidation = Date.now();
      logger.debug("Received WebSocket message:", { data, clientId: client.clientId });

      // Handle both "subscription" and direct "subscribe"/"unsubscribe" message types
      if (
        data.type === "subscription" ||
        data.type === "subscribe" ||
        data.type === "unsubscribe"
      ) {
        const action = data.type === "subscription" ? data.action : data.type;
        const channel = data.channel;

        logger.debug("Processing subscription message:", {
          action,
          channel,
          clientId: client.clientId,
        });

        await this.handleSubscription(client, {
          action,
          channel,
        });
      } else {
        logger.warn(`Unknown message type: ${data.type}`, { data });
      }
    } catch (error) {
      logger.error(`Message handling error: ${error}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    }
  }

  /**
   * Handles subscription requests
   * @param client WebSocket client
   * @param data Subscription request data
   */
  private async handleSubscription(
    client: WebSocketClient,
    data: { action: string; channel: string }
  ): Promise<void> {
    console.log("🟥 👻 handleSubscription");
    const { action, channel } = data;

    try {
      logger.debug("Checking channel access:", { clientId: client.clientId, channel });

      // Check channel access
      const hasAccess = await this.accessControl.hasChannelAccess(client.clientId, channel);
      logger.debug("Channel access check result:", {
        hasAccess,
        clientId: client.clientId,
        channel,
      });

      if (!hasAccess) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: `Access denied to channel: ${channel}`,
          })
        );
        return;
      }

      if (action === "subscribe") {
        await this.subscribeToChannel(client, channel);
      } else if (action === "unsubscribe") {
        await this.unsubscribeFromChannel(client, channel);
      }
    } catch (error) {
      logger.error(`Subscription error: ${error}`);
      client.ws.send(
        JSON.stringify({
          type: "error",
          message: "Subscription error",
        })
      );
    }
  }

  /**
   * Subscribes a client to a channel
   * @param client WebSocket client
   * @param channel Channel name
   */
  private async subscribeToChannel(client: WebSocketClient, channel: string): Promise<void> {
    console.log("🟥 👻 subscribeToChannel");
    try {
      // Use subscription service to manage subscriptions
      await this.subscriptionService.subscribe(client.clientId, channel);

      // Update local state
      client.subscribedChannels.add(channel);

      client.ws.send(
        JSON.stringify({
          type: "subscription",
          action: "subscribed",
          channel,
        })
      );

      logger.info(`Client ${client.clientId} subscribed to channel ${channel}`);
    } catch (error) {
      logger.error(`Error subscribing client ${client.clientId} to channel ${channel}:`, error);
      client.ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to subscribe to channel",
        })
      );
    }
  }

  /**
   * Unsubscribes a client from a channel
   * @param client WebSocket client
   * @param channel Channel name
   */
  private async unsubscribeFromChannel(client: WebSocketClient, channel: string): Promise<void> {
    console.log("🟥 👻 unsubscribeFromChannel");
    try {
      // Use subscription service to manage subscriptions
      await this.subscriptionService.unsubscribe(client.clientId, channel);

      // Update local state
      client.subscribedChannels.delete(channel);

      client.ws.send(
        JSON.stringify({
          type: "subscription",
          action: "unsubscribed",
          channel,
        })
      );

      logger.info(`Client ${client.clientId} unsubscribed from channel ${channel}`);
    } catch (error) {
      logger.error(`Error unsubscribing client ${client.clientId} from channel ${channel}:`, error);
      client.ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to unsubscribe from channel",
        })
      );
    }
  }

  /**
   * Handles client disconnection
   * @param clientId Client ID
   */
  private async handleClientDisconnect(clientId: string): Promise<void> {
    console.log("🟥 👻 handleClientDisconnect");
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Unsubscribe from all channels using subscription service
      for (const channel of client.subscribedChannels) {
        await this.subscriptionService.unsubscribe(clientId, channel);
      }

      // Remove client from local state
      this.clients.delete(clientId);
      logger.info(`Client disconnected: ${clientId}`);
    } catch (error) {
      logger.error(`Error handling client disconnect for ${clientId}:`, error);
    }
  }

  /**
   * Gets client by WebSocket instance
   * @param ws WebSocket instance
   * @returns WebSocket client or undefined
   */
  private getClientByWebSocket(ws: WebSocket): WebSocketClient | undefined {
    console.log("🟥 👻 getClientByWebSocket");
    for (const client of this.clients.values()) {
      if (client.ws === ws) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Broadcasts a notification to all subscribers of a channel
   * @param channel Channel name
   * @param notification Notification data
   */
  public async broadcastNotification(channel: string, notification: unknown): Promise<void> {
    console.log("🟥 👻 broadcastNotification");
    try {
      const subscribers = await this.subscriptionService.getChannelSubscribers(channel);
      console.log("🟥 👻 broadcastNotification:subscribers", subscribers);
      for (const clientId of subscribers) {
        // Check if client still has access to the channel
        const hasAccess = await this.accessControl.hasChannelAccess(clientId, channel);
        if (!hasAccess) {
          console.log("🟥 👻 broadcastNotification:unsubscribe");
          // Remove client from subscribers if they no longer have access
          await this.subscriptionService.unsubscribe(clientId, channel);
          logger.warn(
            `Removed client ${clientId} from channel ${channel} subscribers due to revoked access`
          );
          continue;
        }

        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          console.log("🟥 👻 broadcastNotification:send", clientId);
          client.ws.send(
            JSON.stringify({
              type: "notification",
              channel,
              data: notification,
            })
          );
        }
      }
    } catch (error) {
      logger.error(`Error broadcasting notification to channel ${channel}:`, error);
    }
  }
}
