import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { NotificationMessage } from "../types";

/**
 * Service for managing notifications using Redis
 */
export class NotificationService {
  private readonly redis: Redis;
  private readonly NOTIFICATION_PREFIX = "notification:";
  private readonly SUBSCRIPTION_PREFIX = "subscription:";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Store a notification in Redis
   */
  public async storeNotification(notification: NotificationMessage): Promise<void> {
    const key = `${this.NOTIFICATION_PREFIX}${notification.channel}`;
    try {
      await this.redis.lpush(key, JSON.stringify(notification));
      await this.redis.ltrim(key, 0, 999); // Keep last 1000 notifications
      logger.debug(`Stored notification in channel ${notification.channel}`);
    } catch (error) {
      logger.error("Error storing notification:", error);
      throw error;
    }
  }

  /**
   * Get recent notifications for a channel
   */
  public async getNotifications(
    channel: string,
    limit: number = 10
  ): Promise<NotificationMessage[]> {
    const key = `${this.NOTIFICATION_PREFIX}${channel}`;
    try {
      const notifications = await this.redis.lrange(key, 0, limit - 1);
      return notifications.map((n) => JSON.parse(n));
    } catch (error) {
      logger.error("Error getting notifications:", error);
      throw error;
    }
  }

  /**
   * Store a client subscription
   */
  public async storeSubscription(clientId: string, channel: string): Promise<void> {
    const key = `${this.SUBSCRIPTION_PREFIX}${clientId}`;
    try {
      await this.redis.sadd(key, channel);
      logger.debug(`Stored subscription for client ${clientId} to channel ${channel}`);
    } catch (error) {
      logger.error("Error storing subscription:", error);
      throw error;
    }
  }

  /**
   * Remove a client subscription
   */
  public async removeSubscription(clientId: string, channel: string): Promise<void> {
    const key = `${this.SUBSCRIPTION_PREFIX}${clientId}`;
    try {
      await this.redis.srem(key, channel);
      logger.debug(`Removed subscription for client ${clientId} from channel ${channel}`);
    } catch (error) {
      logger.error("Error removing subscription:", error);
      throw error;
    }
  }

  /**
   * Get all channels a client is subscribed to
   */
  public async getClientSubscriptions(clientId: string): Promise<string[]> {
    const key = `${this.SUBSCRIPTION_PREFIX}${clientId}`;
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      logger.error("Error getting client subscriptions:", error);
      throw error;
    }
  }

  /**
   * Create a new notification
   */
  public createNotification(channel: string, message: string): NotificationMessage {
    return {
      id: uuidv4(),
      channel,
      message,
      timestamp: Date.now(),
    };
  }
}
