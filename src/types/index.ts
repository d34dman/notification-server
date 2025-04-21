/**
 * Interface representing a notification message
 */
export interface NotificationMessage {
  /** Unique identifier for the notification */
  id: string;
  /** Channel to which the notification belongs */
  channel: string;
  /** The actual notification content */
  message: string;
  /** Timestamp when the notification was created */
  timestamp: number;
}

/**
 * Interface representing a subscription request
 */
export interface SubscriptionRequest {
  /** Channel to subscribe to */
  channel: string;
  /** Client identifier */
  clientId: string;
}

/**
 * Interface representing a publish request
 */
export interface PublishRequest {
  /** Channel to publish to */
  channel: string;
  /** Notification content */
  message: string;
}

/**
 * Type representing Redis channel key format
 */
export type RedisChannelKey = `notification:channel:${string}`;

/**
 * Type representing Redis client key format
 */
export type RedisClientKey = `notification:client:${string}` | `subscription:client:${string}`;

export interface WebSocketMessage {
  type:
    | "subscribe"
    | "unsubscribe"
    | "notification"
    | "error"
    | "connection"
    | "subscribed"
    | "unsubscribed";
  channel?: string;
  clientId?: string;
  message?: string;
  data?: NotificationMessage;
}
