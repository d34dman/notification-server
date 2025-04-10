# Notification Server

A ZeroMQ-based notification server with Redis storage for managing pub/sub notifications.

## Features

- Publish notifications to specific channels
- Subscribe to channels for real-time notifications
- Redis-based persistence for notifications
- REST API endpoints for publishing and subscribing
- ZeroMQ for efficient message distribution

## Prerequisites

- Node.js (v14 or higher)
- Redis server
- ZeroMQ library
- Docker and Docker Compose (optional)

## Installation

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Copy `.env.example` to `.env` and adjust the values as needed.

3. Build the project:
```bash
npm run build
```

### Docker Deployment

1. Build and start the containers:
```bash
docker-compose up --build
```

2. To run in detached mode:
```bash
docker-compose up -d
```

3. To stop the containers:
```bash
docker-compose down
```

## Usage

1. Start the server:
```bash
# Local development
npm start

# Docker
docker-compose up
```

2. API Endpoints:

### Publish a Notification
```bash
POST /publish
Content-Type: application/json

{
  "channel": "my-channel",
  "content": "Hello, world!",
  "metadata": {
    "priority": "high"
  }
}
```

### Subscribe to a Channel
```bash
POST /subscribe
Content-Type: application/json

{
  "channel": "my-channel",
  "clientId": "client-123"
}
```

### Get Recent Notifications
```bash
GET /notifications/my-channel?count=10
```

## Development

Run the development server with hot reload:
```bash
npm run dev
```

## Architecture

- Uses ZeroMQ PUB/SUB pattern for real-time message distribution
- Redis for persistent storage of notifications and subscriptions
- Express.js for REST API endpoints
- TypeScript for type safety and better development experience

## Error Handling

The server includes comprehensive error handling for:
- Invalid requests
- Redis connection issues
- ZeroMQ communication errors
- Server startup failures

## Docker Configuration

The application is containerized using:
- Multi-stage Docker build for optimized image size
- Alpine-based Node.js image for security and size
- Docker Compose for easy deployment with Redis
- Volume mounting for Redis data persistence
- Network isolation between services

For detailed Docker examples and usage instructions, see the [Docker README](docker/README.md).

## License

MIT 