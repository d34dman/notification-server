# Notification Server Demo Client

A web-based demonstration client for testing and exploring the Notification Server's features.

## Features

- **Client Management**
  - Generate new client IDs
  - Validate existing client IDs
  - View client metadata
  - Automatic client ID expiration handling

- **Channel Management**
  - Create new channels with access rules
  - View accessible channels
  - Manage channel access permissions
  - Set maximum subscriber limits

- **WebSocket Operations**
  - Connect to WebSocket server
  - Subscribe to channels
  - Unsubscribe from channels
  - View real-time notifications
  - Monitor connection status

- **Notification Management**
  - Publish notifications to channels
  - View notification history
  - Filter notifications by channel
  - View notification metadata

## Setup

1. Ensure the Notification Server is running:
   ```bash
   # In the root directory
   npm start
   ```

2. Open the demo client in your browser:
   ```bash
   # The demo client is available at
   http://localhost:8081/demo/client/demo-client.html
   ```

## Usage Guide

### 1. Client Setup

1. **Configure Server URLs**
   - Enter the HTTP API URL (default: `http://localhost:3000`)
   - Enter the WebSocket URL (default: `ws://localhost:8080`)

2. **Generate or Validate Client ID**
   - Click "Generate Client ID" to create a new client
   - Or enter an existing client ID and click "Validate Client ID"
   - The client ID will be used for all subsequent operations

3. **Connect to WebSocket**
   - Click "Connect WebSocket" to establish a connection
   - Monitor the connection status in the status indicator
   - View connection logs in the WebSocket log panel

### 2. Channel Management

1. **Create a Channel**
   - Switch to the "Channel Management" tab
   - Enter a channel name
   - Optionally set maximum subscribers
   - Click "Create Channel"

2. **Manage Channel Access**
   - Enter a channel name
   - Enter a target client ID
   - Click "Grant Access" or "Revoke Access"
   - View access management logs

3. **View Accessible Channels**
   - Click "Refresh Channels" to update the channel list
   - View all channels you have access to
   - Click on a channel to select it for operations

### 3. Subscription Management

1. **Subscribe to a Channel**
   - Select a channel from the list or enter a channel name
   - Click "Subscribe"
   - Monitor the subscription status
   - View subscription confirmation in the logs

2. **Unsubscribe from a Channel**
   - Select the channel to unsubscribe from
   - Click "Unsubscribe"
   - Monitor the unsubscription status
   - View unsubscription confirmation in the logs

3. **Check Subscription Status**
   - Select a channel
   - Click "Check Subscription"
   - View the current subscription status

### 4. Notification Management

1. **Publish Notifications**
   - Switch to the "Publish" tab
   - Select a channel
   - Enter a message
   - Click "Publish"
   - View publication confirmation

2. **View Notification History**
   - Switch to the "History" tab
   - Select a channel
   - Click "Get History"
   - View past notifications

3. **Monitor Real-time Notifications**
   - View incoming notifications in the "Real-time Messages" panel
   - Notifications include:
     - Timestamp
     - Channel name
     - Message content
     - Metadata (if available)

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify the WebSocket URL is correct
   - Ensure the server is running
   - Check browser console for errors

2. **Invalid Client ID**
   - Generate a new client ID
   - Ensure the client ID is properly validated
   - Check the server logs for validation errors

3. **Subscription Failed**
   - Verify you have access to the channel
   - Check the channel exists
   - Ensure the WebSocket connection is active

4. **No Notifications Received**
   - Verify the subscription was successful
   - Check the channel name matches exactly
   - Ensure the WebSocket connection is active

### Logging

- All operations are logged in their respective panels
- WebSocket logs show connection and message events
- Channel management logs show access control operations
- Error messages are displayed in red

## Best Practices

1. **Client ID Management**
   - Always validate client IDs before use
   - Generate new client IDs for different test scenarios
   - Monitor client ID expiration

2. **Channel Management**
   - Use descriptive channel names
   - Set appropriate subscriber limits
   - Regularly review channel access

3. **WebSocket Operations**
   - Monitor connection status
   - Handle reconnection scenarios
   - Clean up subscriptions when disconnecting

4. **Notification Publishing**
   - Include meaningful metadata
   - Use appropriate message formats
   - Monitor notification delivery

## Environment Variables

The demo client can be configured using environment variables in a `.env` file:

```env
API_URL=http://localhost:3111
WS_URL=ws://localhost:8080
DEFAULT_CHANNEL=demo
MAX_SUBSCRIBERS=100
CLIENT_METADATA={"userAgent":"Demo Client","environment":"development"}
```

## Browser Compatibility

The demo client is compatible with modern browsers that support:
- WebSocket API
- ES6 JavaScript features
- CSS Grid and Flexbox

Tested browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest) 