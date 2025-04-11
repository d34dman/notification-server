# Docker Example

A minimal example of consuming the notification server image from GitHub Container Registry.

## Usage

1. Start the services:

```bash
cd docker
docker-compose up -d
```

2. Test the notification server:

```bash
# Publish a notification
curl -X POST http://localhost:3000/publish \
  -H "Content-Type: application/json" \
  -d '{"channel": "news", "content": "Hello World!"}'

# Get recent notifications
curl http://localhost:3000/notifications/news
``` 