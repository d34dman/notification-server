import Redis from "ioredis";
import { RedisChannelKey, RedisClientKey } from "../types";

/**
 * Redis client configuration and initialization
 */
export class RedisManager {
  private static instance: RedisManager;
  private client: Redis;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    this.client = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error("Redis connection failed after 10 retries");
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on("error", (err: Error) => {
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
    try {
      await this.client.ping();
      console.log("Connected to Redis");
    } catch (error) {
      console.error("Redis connection error:", error);
      throw error;
    }
  }

  /**
   * Store a notification in Redis
   */
  public async storeNotification(channel: string, notification: string): Promise<void> {
    const key: RedisChannelKey = `notification:channel:${channel}`;
    await this.client.lpush(key, notification);
    await this.client.ltrim(key, 0, 999); // Keep last 1000 notifications
  }

  /**
   * Store a client subscription
   */
  public async storeSubscription(clientId: string, channel: string): Promise<void> {
    const key: RedisClientKey = `subscription:client:${clientId}`;
    await this.client.sadd(key, channel);
  }

  /**
   * Remove a client subscription
   */
  public async removeSubscription(clientId: string, channel: string): Promise<void> {
    const key: RedisClientKey = `subscription:client:${clientId}`;
    await this.client.srem(key, channel);
  }

  /**
   * Get all channels a client is subscribed to
   */
  public async getClientSubscriptions(clientId: string): Promise<string[]> {
    const key: RedisClientKey = `subscription:client:${clientId}`;
    return await this.client.smembers(key);
  }

  /**
   * Get recent notifications for a channel
   */
  public async getChannelNotifications(channel: string, count: number): Promise<string[]> {
    const key: RedisChannelKey = `notification:channel:${channel}`;
    return await this.client.lrange(key, 0, count - 1);
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
