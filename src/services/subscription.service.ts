import Redis from "ioredis";
import { logger } from "../utils/logger";

/**
 * Service for managing channel subscriptions
 */
export class SubscriptionService {
  private readonly redis: Redis;
  private readonly SUBSCRIPTION_PREFIX = "subscription:";
  private readonly CLIENT_SUBSCRIPTIONS_PREFIX = "client-subscriptions:";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Subscribe a client to a channel
   */
  public async subscribe(clientId: string, channel: string): Promise<void> {
    try {
      // Add channel to client's subscriptions
      await this.redis.sadd(`${this.CLIENT_SUBSCRIPTIONS_PREFIX}${clientId}`, channel);
      // Add client to channel's subscribers
      await this.redis.sadd(`${this.SUBSCRIPTION_PREFIX}${channel}`, clientId);
      logger.info(`Client ${clientId} subscribed to channel ${channel}`);
    } catch (error) {
      logger.error(`Error subscribing client ${clientId} to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe a client from a channel
   */
  public async unsubscribe(clientId: string, channel: string): Promise<void> {
    try {
      // Remove channel from client's subscriptions
      await this.redis.srem(`${this.CLIENT_SUBSCRIPTIONS_PREFIX}${clientId}`, channel);
      // Remove client from channel's subscribers
      await this.redis.srem(`${this.SUBSCRIPTION_PREFIX}${channel}`, clientId);
      logger.info(`Client ${clientId} unsubscribed from channel ${channel}`);
    } catch (error) {
      logger.error(`Error unsubscribing client ${clientId} from channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Get all channels a client is subscribed to
   */
  public async getClientSubscriptions(clientId: string): Promise<string[]> {
    try {
      return await this.redis.smembers(`${this.CLIENT_SUBSCRIPTIONS_PREFIX}${clientId}`);
    } catch (error) {
      logger.error(`Error getting subscriptions for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Get all clients subscribed to a channel
   */
  public async getChannelSubscribers(channel: string): Promise<string[]> {
    try {
      return await this.redis.smembers(`${this.SUBSCRIPTION_PREFIX}${channel}`);
    } catch (error) {
      logger.error(`Error getting subscribers for channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Check if a client is subscribed to a channel
   */
  public async isSubscribed(clientId: string, channel: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(`${this.CLIENT_SUBSCRIPTIONS_PREFIX}${clientId}`, channel);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking subscription status for client ${clientId} on channel ${channel}:`, error);
      throw error;
    }
  }
} 