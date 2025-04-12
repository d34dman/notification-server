# Notification Server

A real-time notification server that provides secure WebSocket-based pub/sub functionality with HTTP-based access control.

## Features

- **Secure Client Management**
  - Client ID generation and validation
  - Client metadata support
  - Automatic client ID expiration

- **Channel Management**
  - Channel creation with access control rules
  - Channel access control (grant/revoke)
  - Maximum subscriber limits
  - Client pattern-based access rules

- **WebSocket Communication**
  - Real-time notifications
  - WebSocket-only subscription model
  - Connection status tracking
  - Automatic reconnection support

- **Access Control**
  - HTTP-based access management
  - Channel-level access control
  - Client-specific permissions
  - Access pattern validation

## Architecture

The system consists of two main components:

1. **HTTP API** (`openapi.yaml`)
   - Client management
   - Channel creation and access control
   - Notification publishing
   - History retrieval

2. **WebSocket API** (`asyncapi.yaml`)
   - Real-time notifications
   - Subscription management
   - Connection handling
   - Error reporting

## Setup

### Prerequisites

- Node.js (v16 or later)
- Redis (v6 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd notification-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start Redis:
   ```bash
   redis-server
   ```

5. Start the server:
   ```bash
   npm start
   ```

## API Documentation

### HTTP API

The HTTP API is documented in `openapi.yaml` and provides the following endpoints:

- **Client Management**
  - `POST /api/clients` - Generate a new client ID
  - `GET /api/clients/{clientId}` - Validate a client ID

- **Channel Management**
  - `POST /api/channels` - Create a new channel
  - `POST /api/channels/{channel}/access/{clientId}` - Grant channel access
  - `DELETE /api/channels/{channel}/access/{clientId}` - Revoke channel access

- **Notification Management**
  - `POST /api/notifications` - Publish a notification
  - `GET /api/notifications/{channel}` - Get notification history

### WebSocket API

The WebSocket API is documented in `asyncapi.yaml` and supports the following message types:

- **Connection Messages**
  ```json
  {
    "type": "connection",
    "clientId": "client123",
    "metadata": {
      "userAgent": "Demo Client",
      "environment": "development"
    }
  }
  ```

- **Subscription Messages**
  ```json
  {
    "type": "subscription",
    "action": "subscribe",
    "channel": "channel1"
  }
  ```

- **Notification Messages**
  ```json
  {
    "type": "notification",
    "data": {
      "channel": "channel1",
      "message": "Hello, world!",
      "timestamp": "2024-03-20T12:00:00Z",
      "metadata": {
        "priority": "high",
        "tags": ["important"]
      }
    }
  }
  ```

## Security

- Client IDs are required for WebSocket connections
- Channel access is controlled via HTTP API
- Client IDs expire after a configurable period
- Channel access can be revoked at any time
- Access patterns can be restricted using regex patterns

## Usage Example

1. Generate a client ID:
   ```bash
   curl -X POST http://localhost:3111/api/clients \
     -H "Content-Type: application/json" \
     -d '{"metadata": {"userAgent": "Demo Client"}}'
   ```

2. Create a channel:
   ```bash
   curl -X POST http://localhost:3111/api/channels \
     -H "Content-Type: application/json" \
     -d '{
       "channel": "demo",
       "rules": {
         "maxSubscribers": 100,
         "allowedClients": ["client123"],
         "allowedPatterns": ["client.*"]
       }
     }'
   ```

3. Connect via WebSocket:
   ```javascript
   const ws = new WebSocket('ws://localhost:8080?clientId=client123');
   
   ws.onmessage = (event) => {
     const data = JSON.parse(event.data);
     if (data.type === 'notification') {
       console.log('Received notification:', data.data);
     }
   };
   
   // Subscribe to a channel
   ws.send(JSON.stringify({
     type: 'subscription',
     action: 'subscribe',
     channel: 'demo'
   }));
   ```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Channel Management

### Create Channel
```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "my-channel",
    "rules": {
      "isPublic": true,
      "allowedClientIds": ["client1", "client2"],
      "maxSubscribers": 100
    }
  }'
```

### Delete Channel
```bash
curl -X DELETE http://localhost:3000/api/channels/my-channel
```

### Error Handling
- Channel creation will fail with a 409 status if the channel already exists
- Channel deletion will fail with a 404 status if the channel doesn't exist
- Both operations require a valid channel name 