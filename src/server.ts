import * as zmq from "zeromq";
import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { RedisManager } from "./config/redis";
import { NotificationMessage, PublishRequest, SubscriptionRequest } from "./types";

/**
 * Notification Server class that handles ZeroMQ pub/sub and HTTP endpoints
 */
class NotificationServer {
  private publisher: zmq.Publisher;
  private subscriber: zmq.Subscriber;
  private redisManager: RedisManager;
  private app: express.Application;

  constructor() {
    this.publisher = new zmq.Publisher();
    this.subscriber = new zmq.Subscriber();
    this.redisManager = RedisManager.getInstance();
    this.app = express();
    this.setupExpress();
  }

  /**
   * Setup Express middleware and routes
   */
  private setupExpress(): void {
    this.app.use(express.json());

    // Publish endpoint
    this.app.post("/publish", async (req: Request<{}, {}, PublishRequest>, res: Response) => {
      try {
        const { channel, content, metadata } = req.body;

        if (!channel || !content) {
          return res.status(400).json({ error: "Channel and content are required" });
        }

        const notification: NotificationMessage = {
          id: uuidv4(),
          channel,
          content,
          timestamp: Date.now(),
          metadata,
        };

        // Store in Redis
        await this.redisManager.storeNotification(channel, JSON.stringify(notification));

        // Publish via ZeroMQ
        await this.publisher.send([channel, JSON.stringify(notification)]);

        res.json({ success: true, notificationId: notification.id });
      } catch (error) {
        console.error("Publish error:", error instanceof Error ? error.message : "Unknown error");
        res.status(500).json({ error: "Failed to publish notification" });
      }
    });

    // Subscribe endpoint
    this.app.post(
      "/subscribe",
      async (req: Request<{}, {}, SubscriptionRequest>, res: Response) => {
        try {
          const { channel, clientId } = req.body;

          if (!channel || !clientId) {
            return res.status(400).json({ error: "Channel and clientId are required" });
          }

          // Store subscription in Redis
          await this.redisManager.storeSubscription(clientId, channel);

          // Subscribe to channel in ZeroMQ
          await this.subscriber.subscribe(channel);

          res.json({ success: true, message: `Subscribed to channel: ${channel}` });
        } catch (error) {
          console.error(
            "Subscribe error:",
            error instanceof Error ? error.message : "Unknown error"
          );
          res.status(500).json({ error: "Failed to subscribe to channel" });
        }
      }
    );

    // Get recent notifications endpoint
    this.app.get(
      "/notifications/:channel",
      async (req: Request<{ channel: string }, {}, {}, { count?: string }>, res: Response) => {
        try {
          const { channel } = req.params;
          const count = parseInt(req.query.count || "10", 10);

          if (isNaN(count) || count < 1) {
            return res.status(400).json({ error: "Invalid count parameter" });
          }

          const notifications = await this.redisManager.getChannelNotifications(channel, count);
          res.json({ notifications: notifications.map((n) => JSON.parse(n)) });
        } catch (error) {
          console.error(
            "Get notifications error:",
            error instanceof Error ? error.message : "Unknown error"
          );
          res.status(500).json({ error: "Failed to retrieve notifications" });
        }
      }
    );
  }

  /**
   * Start the notification server
   */
  public async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redisManager.connect();

      // Bind ZeroMQ sockets
      await this.publisher.bind("tcp://*:5555");
      await this.subscriber.connect("tcp://localhost:5555");

      // Start message receiving loop
      this.startMessageLoop();

      // Start HTTP server
      const port = process.env.PORT || 3000;
      this.app.listen(port, () => {
        console.log(`Notification server running on port ${port}`);
      });
    } catch (error) {
      console.error(
        "Failed to start server:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  }

  /**
   * Start the message receiving loop for subscribers
   */
  private async startMessageLoop(): Promise<void> {
    try {
      for await (const [channel, message] of this.subscriber) {
        console.log(`Received message on channel ${channel}: ${message}`);
      }
    } catch (error) {
      console.error(
        "Message loop error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

// Start the server
const server = new NotificationServer();
server.start().catch((error) => {
  console.error("Server startup error:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
});
