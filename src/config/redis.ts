import { createClient } from "redis";
import { RedisChannelKey, RedisClientKey } from "../types";

/**
 * Redis client configuration and initialization
 */
export class RedisManager {
  private static instance: RedisManager;
  private client;

  private constructor() {
    const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
    
    // Add password to URL if provided
    if (process.env.REDIS_PASSWORD) {
      redisUrl.password = process.env.REDIS_PASSWORD;
    }

    this.client = createClient({
      url: redisUrl.toString(),
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("Redis connection failed after 10 retries");
            return new Error("Redis connection failed");
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });
  }

  /**
   * Get the singleton instance of RedisManager
   */
  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Store a notification in Redis
   */
  public async storeNotification(channel: string, notification: string): Promise<void> {
    const key: RedisChannelKey = `notification:channel:${channel}`;
    await this.client.lPush(key, notification);
  }

  /**
   * Store a client subscription
   */
  public async storeSubscription(clientId: string, channel: string): Promise<void> {
    const key: RedisClientKey = `notification:client:${clientId}`;
    await this.client.sAdd(key, channel);
  }

  /**
   * Get all channels a client is subscribed to
   */
  public async getClientSubscriptions(clientId: string): Promise<string[]> {
    const key: RedisClientKey = `notification:client:${clientId}`;
    return await this.client.sMembers(key);
  }

  /**
   * Get recent notifications for a channel
   */
  public async getChannelNotifications(channel: string, count: number): Promise<string[]> {
    const key: RedisChannelKey = `notification:channel:${channel}`;
    return await this.client.lRange(key, 0, count - 1);
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
} 