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
import { errorHandler } from "./middleware/error.middleware";
import { validateEnv } from "./utils/env";

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnv();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create WebSocket server with CORS configuration
const wss = new WebSocketServer({ 
  port: parseInt(process.env.WS_PORT || "8080", 10),
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigin = process.env.CORS_ORIGIN || "*";
    
    if (allowedOrigin === "*" || origin === allowedOrigin) {
      callback(true);
    } else {
      logger.warn(`Rejected connection from unauthorized origin: ${origin}`);
      callback(false, 403, "Origin not allowed");
    }
  }
});

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Create services
const notificationService = new NotificationService(redisClient);
const wsManager = new WebSocketManager(wss, notificationService);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use(express.json());

// Routes
app.post("/api/notifications", async (req, res) => {
  try {
    const { channel, message } = req.body;
    
    if (!channel || !message) {
      return res.status(400).json({ error: "Channel and message are required" });
    }
    
    const notification = notificationService.createNotification(channel, message);
    
    await notificationService.storeNotification(notification);
    wsManager.broadcastToChannel(channel, notification);
    
    res.status(201).json(notification);
  } catch (error) {
    logger.error("Error publishing notification:", error);
    res.status(500).json({ error: "Failed to publish notification" });
  }
});

app.get("/api/notifications/:channel", async (req, res) => {
  try {
    const { channel } = req.params;
    const { limit = 10 } = req.query;
    
    const notifications = await notificationService.getNotifications(
      channel,
      Number(limit)
    );
    
    res.json(notifications);
  } catch (error) {
    logger.error("Error getting notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

app.post("/api/channels/:channel/subscribe", (req, res) => {
  const { channel } = req.params;
  const { clientId } = req.body;
  
  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }
  
  wsManager.subscribeToChannel(clientId, channel);
  res.status(200).json({ message: `Subscribed to channel: ${channel}` });
});

app.post("/api/channels/:channel/unsubscribe", (req, res) => {
  const { channel } = req.params;
  const { clientId } = req.body;
  
  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }
  
  wsManager.unsubscribeFromChannel(clientId, channel);
  res.status(200).json({ message: `Unsubscribed from channel: ${channel}` });
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
wss.on('listening', () => {
  logger.info(`WebSocket server running on port ${WS_PORT}`);
});

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    logger.info(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
  });
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