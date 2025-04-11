import { Redis } from "ioredis";
import { logger } from "../utils/logger";

/**
 * Service for managing client IDs and channel access control
 */
export class AccessControlService {
  private readonly redis: Redis;
  private readonly clientIdExpiration: number;

  constructor(redis: Redis, clientIdExpiration: number = 7 * 24 * 60 * 60) { // Default 7 days
    this.redis = redis;
    this.clientIdExpiration = clientIdExpiration;
  }

  /**
   * Generates a new client ID and stores it in Redis
   * @param metadata Optional metadata to store with the client ID
   * @returns Generated client ID
   */
  public async generateClientId(metadata?: Record<string, unknown>): Promise<string> {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store client metadata in Redis with expiration
    await this.redis.hset(`client:${clientId}`, {
      createdAt: Date.now().toString(),
      ...metadata
    });
    
    // Set expiration
    await this.redis.expire(`client:${clientId}`, this.clientIdExpiration);
    
    logger.info(`Generated new client ID: ${clientId}`);
    return clientId;
  }

  /**
   * Refreshes the expiration time for a client ID
   * @param clientId Client ID to refresh
   */
  public async refreshClientId(clientId: string): Promise<void> {
    const exists = await this.redis.exists(`client:${clientId}`);
    if (exists === 1) {
      await this.redis.expire(`client:${clientId}`, this.clientIdExpiration);
      logger.info(`Refreshed client ID expiration: ${clientId}`);
    }
  }

  /**
   * Validates if a client ID exists and is valid
   * @param clientId Client ID to validate
   * @returns True if client ID is valid
   */
  public async validateClientId(clientId: string): Promise<boolean> {
    const exists = await this.redis.exists(`client:${clientId}`);
    if (exists === 1) {
      // Refresh expiration on successful validation
      await this.refreshClientId(clientId);
      return true;
    }
    return false;
  }

  /**
   * Creates a new channel with access control rules
   * @param channel Channel name
   * @param rules Access control rules for the channel
   */
  public async createChannel(
    channel: string,
    rules: {
      allowedClientIds?: string[];
      allowedPatterns?: string[];
      maxSubscribers?: number;
      isPublic?: boolean;
    }
  ): Promise<void> {
    const channelRules = {
      allowedClientIds: JSON.stringify(rules.allowedClientIds || []),
      allowedPatterns: JSON.stringify(rules.allowedPatterns || []),
      maxSubscribers: rules.maxSubscribers?.toString() || "0",
      isPublic: rules.isPublic ? "1" : "0"
    };

    logger.debug('Creating channel with rules:', { channel, rules: channelRules });
    
    await this.redis.hset(`channel:${channel}:rules`, channelRules);
    
    // Verify the rules were stored correctly
    const storedRules = await this.redis.hgetall(`channel:${channel}:rules`);
    logger.debug('Stored channel rules:', { channel, storedRules });
    
    logger.info(`Created new channel: ${channel} with rules: ${JSON.stringify(rules)}`);
  }

  /**
   * Checks if a client has access to a channel
   * @param clientId Client ID to check
   * @param channel Channel to check access for
   * @returns True if client has access to the channel
   */
  public async hasChannelAccess(clientId: string, channel: string): Promise<boolean> {
    logger.debug('Checking channel access:', { clientId, channel });
    
    // Get channel rules
    const rules = await this.redis.hgetall(`channel:${channel}:rules`);
    logger.debug('Retrieved channel rules:', { channel, rules });
    
    if (!rules) {
      logger.warn(`Channel ${channel} does not exist`);
      return false;
    }

    // If channel is public, allow access
    if (rules.isPublic === "1") {
      logger.debug('Channel is public, allowing access:', { channel, clientId });
      return true;
    }

    // Check explicit client ID allowlist
    const allowedClientIds = JSON.parse(rules.allowedClientIds || "[]");
    logger.debug('Checking allowed client IDs:', { allowedClientIds, clientId });
    
    if (allowedClientIds.includes(clientId)) {
      logger.debug('Client ID found in allowlist:', { clientId, channel });
      return true;
    }

    // Check pattern matching
    const allowedPatterns = JSON.parse(rules.allowedPatterns || "[]");
    logger.debug('Checking allowed patterns:', { allowedPatterns, clientId });
    
    for (const pattern of allowedPatterns) {
      if (new RegExp(pattern).test(clientId)) {
        logger.debug('Client ID matches pattern:', { pattern, clientId, channel });
        return true;
      }
    }

    // If no rules match and channel is not public, deny access
    logger.debug('Access denied - no matching rules:', { clientId, channel });
    return false;
  }

  /**
   * Gets all channels a client has access to
   * @param clientId Client ID to check
   * @returns Array of accessible channel names
   */
  public async getAccessibleChannels(clientId: string): Promise<string[]> {
    const accessibleChannels: string[] = [];
    
    // Get all channel keys
    const channelKeys = await this.redis.keys("channel:*:rules");
    
    for (const key of channelKeys) {
      const channel = key.replace("channel:", "").replace(":rules", "");
      const rules = await this.redis.hgetall(key);
      
      if (!rules) continue;
      
      // Check if client is in allowedClientIds
      const allowedClientIds = JSON.parse(rules.allowedClientIds || "[]");
      if (allowedClientIds.includes(clientId)) {
        accessibleChannels.push(channel);
        continue;
      }
      
      // Check if client matches any allowed patterns
      const allowedPatterns = JSON.parse(rules.allowedPatterns || "[]");
      for (const pattern of allowedPatterns) {
        if (new RegExp(pattern).test(clientId)) {
          accessibleChannels.push(channel);
          break;
        }
      }
    }
    
    return accessibleChannels;
  }

  /**
   * Revokes a client's access to a channel
   * @param clientId Client ID to revoke access for
   * @param channel Channel to revoke access from
   */
  public async revokeChannelAccess(clientId: string, channel: string): Promise<void> {
    const rules = await this.redis.hgetall(`channel:${channel}:rules`);
    if (!rules) {
      throw new Error(`Channel ${channel} does not exist`);
    }

    const allowedClientIds = JSON.parse(rules.allowedClientIds || "[]");
    const updatedClientIds = allowedClientIds.filter((id: string) => id !== clientId);
    
    await this.redis.hset(`channel:${channel}:rules`, {
      allowedClientIds: JSON.stringify(updatedClientIds)
    });
    
    logger.info(`Revoked access for client ${clientId} from channel ${channel}`);
  }
} 