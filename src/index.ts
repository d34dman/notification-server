import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";
import { logger } from "./utils/logger";
import { NotificationService } from "./services/notification.service";
import { WebSocketManager } from "./services/websocket.service";
import { SubscriptionService } from "./services/subscription.service";
import { errorHandler } from "./middleware/error.middleware";
import { validateEnv } from "./utils/env";
import { AccessControlService } from "./services/access-control.service";

// Import version info with fallback for development
let versionInfo: {
  name: string;
  version: string;
  shortCommitHash: string;
  commitHash: string;
  buildTime: string;
};

try {
  versionInfo = require("./version.json");
} catch {
  // Fallback for development when version.json doesn't exist
  const packageJson = require("../package.json");
  versionInfo = {
    name: packageJson.name,
    version: packageJson.version,
    shortCommitHash: "dev",
    commitHash: "development",
    buildTime: new Date().toISOString(),
  };
}

// Load environment variables
const envLoaded = dotenv.config();
if (!envLoaded) {
  logger.error("❌ Failed to load environment variables");
  process.exit(1);
}
logger.debug("[ENV] Environment variables loaded successfully");

// Validate environment variables
try {
  validateEnv();
  logger.debug("[ENV] Environment variables validated successfully");
} catch (error) {
  logger.error("❌ Environment validation failed:", error);
  process.exit(1);
}

// Set logger level
logger.level = process.env.LOG_LEVEL || "info";
logger.debug(`[LOGGER] Log level set to: ${logger.level}`);

// Log application version with commit hash
logger.info(`🚀 Starting ${versionInfo.name} v${versionInfo.version} (${versionInfo.shortCommitHash})`);
logger.debug(`[VERSION] Build time: ${versionInfo.buildTime}`);

// Create Express app
const app = express();
const httpServer = createServer(app);
logger.debug("[SERVER] Express app and HTTP server initialized");

// Parse CORS origins from environment variable
const parseCorsOrigins = (corsOrigin: string): string[] | boolean => {
  if (!corsOrigin || corsOrigin === "*") {
    return true; // Allow all origins
  }
  // Split by comma and trim whitespace
  return corsOrigin
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
};

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN || "*");

// Create WebSocket server with CORS configuration
const wss = new WebSocketServer({
  port: parseInt(process.env.WS_PORT || "8080", 10),
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;

    // If allowedOrigins is true, allow all origins
    if (allowedOrigins === true) {
      callback(true);
      return;
    }

    // Check if origin is in the allowed list
    if (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin)) {
      callback(true);
    } else {
      logger.warn(
        `Rejected WebSocket connection from unauthorized origin: ${origin || "undefined"}`
      );
      callback(false, 403, "Origin not allowed");
    }
  },
});
logger.debug(`[WS] WebSocket server initialized on port ${process.env.WS_PORT || "8080"}`);

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Redis client will connect automatically on first operation

// Create services
const notificationService = new NotificationService(redisClient);
const subscriptionService = new SubscriptionService(redisClient);
const clientIdExpiration = parseInt(process.env.CLIENT_ID_EXPIRATION || "604800"); // Default 7 days in seconds
const accessControl = new AccessControlService(redisClient, clientIdExpiration);
const wsManager = new WebSocketManager(
  redisClient,
  accessControl,
  notificationService,
  subscriptionService
);
logger.debug("[SERVICES] All services initialized successfully");

// Middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  })
);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.get("/api/health", (req, res) => {
  logger.debug("[API] Health check requested");
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Notification Service
 *
 * This endpoint is used to send notifications to a specific channel.
 *
 * @group Server API
 * @route POST /api/notifications
 * @param {string} req.body.channel - The channel to send the notification to.
 * @param {string} req.body.message - The message to send to the channel.
 * @returns {object} 200 - The notification object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/notifications", async (req, res) => {
  logger.debug("[API] New notification request received");
  try {
    const { channel, message } = req.body;

    if (!channel || !message) {
      return res.status(400).json({ error: "Channel and message are required" });
    }

    // Check if channel exists
    const exists = await accessControl.validateChannel(channel);
    if (!exists) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const notification = {
      id: uuidv4(),
      channel,
      message,
      timestamp: Date.now(),
    };

    // Store notification
    await notificationService.storeNotification(notification);

    // Broadcast to subscribers
    await wsManager.broadcastNotification(channel, notification);

    res.json(notification);
  } catch (error) {
    logger.error(`Error publishing notification: ${error}`);
    res.status(500).json({ error: "Failed to publish notification" });
  }
});

/**
 * Notification Service
 *
 * This endpoint is used to get notifications from a specific channel.
 *
 * @group Server API
 * @route GET /api/notifications/:channel
 * @param {string} req.params.channel - The channel to get notifications from.
 * @param {number} req.query.limit - The number of notifications to get.
 * @returns {object} 200 - The notifications object.
 * @returns {object} 400 - The error object.
 */
app.get("/api/notifications/:channel", async (req, res) => {
  logger.debug(`[API] Get notifications request for channel: ${req.params.channel}`);
  try {
    const { channel } = req.params;
    const { limit = 10 } = req.query;
    // First check if the channel exists
    const exists = await accessControl.validateChannel(channel);
    if (!exists) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const notifications = await notificationService.getNotifications(channel, Number(limit));

    res.json(notifications);
  } catch (error) {
    logger.error("Error getting notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

/**
 * Subscription Service
 *
 * This endpoint is used to subscribe to a specific channel.
 *
 * @group Server API
 * @route POST /api/channels/:channel/subscribe
 * @param {string} req.params.channel - The channel to subscribe to.
 * @param {string} req.body.clientId - The client ID to subscribe to the channel with.
 * @returns {object} 200 - The message object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/channels/:channel/subscribe", async (req, res) => {
  logger.debug(`[API] Subscribe request for channel: ${req.params.channel}`);
  const { channel } = req.params;
  const { clientId } = req.body;
  // First check if the channel exists
  const exists = await accessControl.validateChannel(channel);
  if (!exists) {
    return res.status(404).json({ error: "Channel not found" });
  }

  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }

  try {
    await subscriptionService.subscribe(clientId, channel);
    res.status(200).json({ message: `Subscribed to channel: ${channel}` });
  } catch (error) {
    logger.error("Error subscribing to channel:", error);
    res.status(500).json({ error: "Failed to subscribe to channel" });
  }
});

/**
 * Subscription Service
 *
 * This endpoint is used to unsubscribe from a specific channel.
 *
 * @group Server API
 * @route POST /api/channels/:channel/unsubscribe
 * @param {string} req.params.channel - The channel to unsubscribe from.
 * @param {string} req.body.clientId - The client ID to unsubscribe.
 * @returns {object} 200 - The message object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/channels/:channel/unsubscribe", async (req, res) => {
  logger.debug(`[API] Unsubscribe request for channel: ${req.params.channel}`);
  const { channel } = req.params;
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }

  try {
    await subscriptionService.unsubscribe(clientId, channel);
    res.status(200).json({ message: `Unsubscribed from channel: ${channel}` });
  } catch (error) {
    logger.error("Error unsubscribing from channel:", error);
    res.status(500).json({ error: "Failed to unsubscribe from channel" });
  }
});

/**
 * Subscription Service
 *
 * This endpoint is used to get the client's subscriptions.
 *
 * @group Server API
 * @route GET /api/clients/:clientId/subscriptions
 * @param {string} req.params.clientId - The client ID to get subscriptions for.
 * @returns {object} 200 - The subscriptions object.
 * @returns {object} 400 - The error object.
 */
app.get("/api/clients/:clientId/subscriptions", async (req, res) => {
  logger.debug(`[API] Get subscriptions request for client: ${req.params.clientId}`);
  const { clientId } = req.params;

  try {
    const subscriptions = await subscriptionService.getClientSubscriptions(clientId);
    res.json({ subscriptions });
  } catch (error) {
    logger.error("Error getting client subscriptions:", error);
    res.status(500).json({ error: "Failed to get client subscriptions" });
  }
});

/**
 * Subscription Service
 *
 * This endpoint is used to get the subscribers of a specific channel.
 *
 * @group Server API
 * @route GET /api/channels/:channel/subscribers
 * @param {string} req.params.channel - The channel to get subscribers for.
 * @returns {object} 200 - The subscribers object.
 * @returns {object} 400 - The error object.
 */
app.get("/api/channels/:channel/subscribers", async (req, res) => {
  logger.debug(`[API] Get subscribers request for channel: ${req.params.channel}`);
  const { channel } = req.params;

  try {
    const subscribers = await subscriptionService.getChannelSubscribers(channel);
    res.json({ subscribers });
  } catch (error) {
    logger.error("Error getting channel subscribers:", error);
    res.status(500).json({ error: "Failed to get channel subscribers" });
  }
});

/**
 * Subscription Service
 *
 * This endpoint is used to check if a client is subscribed to a specific channel.
 *
 * @group Server API
 * @route GET /api/clients/:clientId/channels/:channel
 * @param {string} req.params.clientId - The client ID to check subscription for.
 * @param {string} req.params.channel - The channel to check subscription for.
 * @returns {object} 200 - The subscription status object.
 * @returns {object} 400 - The error object.
 */
app.get("/api/clients/:clientId/channels/:channel", async (req, res) => {
  logger.debug(
    `[API] Check access request for client: ${req.params.clientId}, channel: ${req.params.channel}`
  );
  const { clientId, channel } = req.params;

  try {
    const isSubscribed = await subscriptionService.isSubscribed(clientId, channel);
    res.json({ isSubscribed });
  } catch (error) {
    logger.error("Error checking subscription:", error);
    res.status(500).json({ error: "Failed to check subscription" });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to generate a client ID.
 *
 * @group Server API
 * @route POST /api/clients
 * @param {object} req.body.metadata - The metadata to generate the client ID with.
 * @returns {object} 200 - The client ID object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/clients", async (req, res) => {
  logger.debug("[API] Create client request received");
  try {
    const { clientId, metadata } = req.body;

    // If clientId is provided, validate it
    if (clientId) {
      const isValid = await accessControl.validateClientId(clientId);
      if (isValid) {
        // Refresh expiration on successful validation
        await accessControl.refreshClientId(clientId);
        return res.status(200).json({
          clientId,
          message: "Client ID is valid",
        });
      }
    }

    // Generate new client ID using provided clientId or generate a new one
    const newClientId = await accessControl.generateClientId(metadata, clientId);
    res.status(201).json({
      clientId: newClientId,
      message: "New client ID generated",
    });
  } catch (error) {
    console.error("Error in client ID generation:", error);
    res.status(500).json({
      error: "Failed to generate client ID",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to validate a client ID.
 *
 * @group Server API
 * @route GET /api/clients/:clientId
 * @param {string} req.params.clientId - The client ID to validate.
 * @returns {object} 200 - The validation status object.
 * @returns {object} 400 - The error object.
 */
app.get("/api/clients/:clientId", async (req, res) => {
  logger.debug(`[API] Get client request for ID: ${req.params.clientId}`);
  try {
    const { clientId } = req.params;
    const isValid = await accessControl.validateClientId(clientId);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid client ID" });
    }
    // Refresh expiration on successful validation
    await accessControl.refreshClientId(clientId);
    res.json({ isValid });
  } catch (error) {
    logger.error("Error validating client ID:", error);
    res.status(500).json({ error: "Failed to validate client ID" });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to create a channel.
 *
 * @group Server API
 * @route POST /api/channels
 * @param {string} req.body.channel - The channel to create.
 * @param {object} req.body.rules - The rules to create the channel with.
 * @returns {object} 201 - The channel object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/channels", async (req, res) => {
  logger.debug("[API] Create channel request received");
  try {
    const { channel, rules } = req.body;

    if (!channel) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    // Check if channel exists
    const exists = await accessControl.validateChannel(channel);
    if (exists) {
      return res.status(409).json({
        error: "Channel already exists",
        message: `Channel '${channel}' already exists`,
      });
    }

    await accessControl.createChannel(channel, rules || {});
    res.status(201).json({ channel, rules });
  } catch (error) {
    logger.error(`Error creating channel: ${error}`);
    res.status(500).json({ error: "Failed to create channel" });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to grant access to a specific channel.
 *
 * @group Server API
 * @route POST /api/channels/:channel/access/:clientId
 * @param {string} req.params.channel - The channel to grant access to.
 * @param {string} req.params.clientId - The client ID to grant access to.
 * @returns {object} 200 - The message object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/channels/:channel/access/:clientId", async (req, res) => {
  logger.debug(
    `[API] Channel access request received for channel: ${req.params.channel}, client: ${req.params.clientId}`
  );
  try {
    const { channel, clientId } = req.params;

    // First check if the channel exists
    const exists = await accessControl.validateChannel(channel);
    if (!exists) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Get the rules for the channel
    const rules = await accessControl.getChannelRules(channel);

    // Return 400 for public channels
    if (rules.isPublic == "1") {
      return res.status(400).json({ error: "Public channel" });
    }

    // Add client to channel's allowed clients
    const allowedClientIds = JSON.parse(rules.allowedClientIds || "[]");
    if (!allowedClientIds.includes(clientId)) {
      allowedClientIds.push(clientId);
      await redisClient.hset(`channel:${channel}:rules`, {
        ...rules,
        allowedClientIds: JSON.stringify(allowedClientIds),
      });
    }

    // Subscribe the client to the channel
    await subscriptionService.subscribe(clientId, channel);

    res.json({ channel, clientId, accessGranted: true });
  } catch (error) {
    logger.error(`Error granting access: ${error}`);
    res.status(500).json({ error: "Failed to grant access" });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to revoke access to a specific channel.
 *
 * @group Server API
 * @route DELETE /api/channels/:channel/access/:clientId
 * @param {string} req.params.channel - The channel to revoke access from.
 * @param {string} req.params.clientId - The client ID to revoke access from.
 * @returns {object} 200 - The message object.
 * @returns {object} 400 - The error object.
 */
app.delete("/api/channels/:channel/access/:clientId", async (req, res) => {
  logger.debug(`[API] Channel deletion request received for channel: ${req.params.channel}`);
  try {
    const { channel, clientId } = req.params;

    // First check if the channel exists
    const exists = await accessControl.validateChannel(channel);
    if (!exists) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Get the rules for the channel
    const rules = await accessControl.getChannelRules(channel);

    // Return 400 for public channels
    if (rules.isPublic == "1") {
      return res.status(400).json({ error: "Public channel" });
    }
    await accessControl.revokeChannelAccess(clientId, channel);
    res.json({ channel, clientId, accessRevoked: true });
  } catch (error) {
    logger.error(`Error revoking access: ${error}`);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

/**
 * Access Control Service
 *
 * This endpoint is used to create a private channel.
 *
 * @group Server API
 * @route POST /api/test/private-channel
 * @param {string} req.body.clientId - The client ID to create the private channel for.
 * @returns {object} 200 - The message object.
 * @returns {object} 400 - The error object.
 */
app.post("/api/test/private-channel", async (req, res) => {
  logger.debug("[API] Test private channel request received");
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "Client ID is required" });
    }

    // Create private channel
    await accessControl.createChannel("private", {
      isPublic: false,
      allowedClientIds: [clientId],
      maxSubscribers: 100,
    });

    res.json({
      message: "Private channel created",
      channel: "private",
      clientId,
    });
  } catch (error) {
    logger.error("Error creating private channel:", error);
    res.status(500).json({ error: "Failed to create private channel" });
  }
});

// Delete channel endpoint
app.delete("/api/channels/:channel", async (req, res) => {
  logger.debug(`[API] Channel deletion request received for channel: ${req.params.channel}`);
  try {
    const { channel } = req.params;

    if (!channel) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    // Check if channel exists
    const exists = await redisClient.exists(`channel:${channel}:rules`);
    if (!exists) {
      return res.status(404).json({
        error: "Channel not found",
        message: `Channel '${channel}' does not exist`,
      });
    }

    // Delete channel rules
    await redisClient.del(`channel:${channel}:rules`);

    // Delete all subscriptions for this channel
    const subscribers = await redisClient.smembers(`subscription:${channel}`);
    for (const clientId of subscribers) {
      await redisClient.srem(`client-subscriptions:${clientId}`, channel);
    }
    await redisClient.del(`subscription:${channel}`);

    // Delete all notifications for this channel
    await redisClient.del(`notification:${channel}`);

    res.status(200).json({
      message: `Channel '${channel}' deleted successfully`,
      channel,
    });
  } catch (error) {
    logger.error(`Error deleting channel: ${error}`);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

// Client Management
app.delete("/api/clients/:clientId", async (req, res) => {
  logger.debug(`[API] Delete client request for ID: ${req.params.clientId}`);
  try {
    const { clientId } = req.params;
    // Check if client exists
    const exists = await accessControl.validateClientId(clientId);
    if (!exists) {
      return res.status(404).json({
        error: "Client not found",
        message: `Client '${clientId}' does not exist`,
      });
    }

    // Get all channels the client is subscribed to
    const accessibleChannels = await accessControl.getAccessibleChannels(clientId);
    // Remove client from all channel subscriber lists
    for (const channel of accessibleChannels) {
      await accessControl.revokeChannelAccess(clientId, channel);
    }

    // Get all channels the client is subscribed to
    const subscribedChannels = await subscriptionService.getClientSubscriptions(clientId);
    // Remove client from all channel subscriber lists
    for (const channel of subscribedChannels) {
      await subscriptionService.unsubscribe(clientId, channel);
    }

    // Delete client data
    await accessControl.deleteClient(clientId);

    res.status(200).json({
      message: `Client '${clientId}' deleted successfully`,
      clientId,
      deletedSubscriptions: subscribedChannels.length,
      deletedChannels: accessibleChannels.length,
    });
  } catch (error) {
    logger.error(`Error deleting client: ${error}`);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);

// Start HTTP server
httpServer.listen(PORT, () => {
  logger.info(`HTTP server running on port ${PORT}`);
});

// Add WebSocket connection logging
wss.on("listening", () => {
  logger.info(`WebSocket server running on port ${WS_PORT}`);
});

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  try {
    // Extract client ID from URL query parameters
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const url = new URL(req.url || "", `${protocol}://${req.headers.host}`);
    const clientId = url.searchParams.get("clientId");

    if (!clientId) {
      logger.warn("WebSocket connection attempt without client ID");
      ws.close(4000, "Client ID is required");
      return;
    }

    // Handle the connection with the client ID
    await wsManager.handleConnection(ws, clientId);
  } catch (error) {
    logger.error("Error handling WebSocket connection:", error);
    ws.close(4000, "Connection error");
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");

  await redisClient.quit();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// Initialize demo channel
async function initializeDemoChannel(): Promise<void> {
  try {
    await accessControl.createChannel("demo", {
      isPublic: true,
      maxSubscribers: 1000,
    });
    logger.info("Demo channel initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize demo channel:", error);
  }
}

// Initialize demo channel on startup
initializeDemoChannel().catch(error => {
  logger.error("Error during demo channel initialization:", error);
});
