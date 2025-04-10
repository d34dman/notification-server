# Notification Server

A real-time notification server with WebSocket support for instant message delivery and Redis for persistent storage.

## Features

- **Real-time Notifications**: WebSocket-based delivery for instant notifications
- **Channel-based Communication**: Organize notifications into channels
- **Persistent Storage**: Redis-backed storage for notification history
- **RESTful API**: HTTP endpoints for publishing and retrieving notifications
- **Scalable Architecture**: Designed for high-throughput notification delivery
- **Developer Tools**: Test client for easy development and testing

## Architecture

The notification server consists of:

1. **HTTP Server**: RESTful API for publishing notifications and retrieving history
2. **WebSocket Server**: Real-time notification delivery to subscribed clients
3. **Redis Backend**: Persistent storage for notification data
4. **Test Client**: Web-based tool for testing the server functionality

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Redis server
- Docker and Docker Compose (optional)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/notification-server.git
   cd notification-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   PORT=3000
   REDIS_URL=redis://localhost:6379
   WS_PORT=8080
   ```

### Running the Server

#### Development Mode

```
npm run dev
```

#### Production Mode

```
npm run build
npm start
```

#### Using Docker

```
cd docker
docker-compose up -d
```

## API Reference

### HTTP Endpoints

#### Publish a Notification

```
POST /api/notifications
```

Request body:
```json
{
  "channel": "channel-name",
  "message": "Your notification message"
}
```

Response:
```json
{
  "id": "notification-id",
  "channel": "channel-name",
  "message": "Your notification message",
  "timestamp": 1234567890
}
```

#### Get Notification History

```
GET /api/notifications/:channel?limit=10
```

Response:
```json
[
  {
    "id": "notification-id",
    "channel": "channel-name",
    "message": "Your notification message",
    "timestamp": 1234567890
  },
  ...
]
```

### WebSocket Protocol

#### Connection

Connect to the WebSocket server at `ws://localhost:8080`. Upon connection, you'll receive a client ID:

```json
{
  "type": "connection",
  "clientId": "client_1234567890"
}
```

#### Subscribe to a Channel

```json
{
  "type": "subscribe",
  "channel": "channel-name"
}
```

Response:
```json
{
  "type": "subscribed",
  "channel": "channel-name"
}
```

#### Unsubscribe from a Channel

```json
{
  "type": "unsubscribe",
  "channel": "channel-name"
}
```

Response:
```json
{
  "type": "unsubscribed",
  "channel": "channel-name"
}
```

#### Receiving Notifications

When a notification is published to a channel you're subscribed to, you'll receive:

```json
{
  "type": "notification",
  "channel": "channel-name",
  "data": {
    "id": "notification-id",
    "channel": "channel-name",
    "message": "Your notification message",
    "timestamp": 1234567890
  }
}
```

## Test Client

The notification server includes a built-in test client for easy development and testing.

### Starting the Test Client

```
npm run test:client
```

Then open your browser to http://localhost:8081

### Test Client Features

- **WebSocket Connection**: Connect to the WebSocket server and manage subscriptions
- **Notification Publishing**: Publish notifications to channels
- **History Retrieval**: View notification history for channels
- **Real-time Updates**: See notifications as they arrive
- **Logging**: Detailed logs of all operations

### Using the Test Client

1. **Connect to WebSocket**:
   - Enter the WebSocket URL (default: ws://localhost:8080)
   - Click "Connect"
   - You'll receive a client ID upon successful connection

2. **Subscribe to Channels**:
   - Enter a channel name
   - Click "Subscribe"
   - You'll receive a confirmation message

3. **Publish Notifications**:
   - Switch to the "Publish" tab
   - Enter a channel name and message
   - Click "Publish Notification"
   - The notification will be sent to all subscribers

4. **View Notification History**:
   - Switch to the "History" tab
   - Enter a channel name and limit
   - Click "Get History"
   - View the notifications in the history container

## Development

### Scripts

- `npm run dev`: Start the server in development mode with hot reloading
- `npm run build`: Build the TypeScript code
- `npm start`: Start the server in production mode
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm run validate:openapi`: Validate OpenAPI specification
- `npm run test:client`: Start the test client server

### Project Structure

```
notification-server/
├── src/                  # Source code
│   ├── index.ts          # Main server file
│   ├── services/         # Service implementations
│   ├── middleware/       # Express middleware
│   └── utils/            # Utility functions
├── docker/               # Docker configuration
├── .github/              # GitHub configuration
├── test-client.html      # Test client HTML
├── serve-test-client.js  # Test client server
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## License

ISC 