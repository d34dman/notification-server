import request from "supertest";
import { testConfig } from "./jest.setup";
import { channel } from "diagnostics_channel";
import WebSocket from "ws";
const TEST_PREFIX = "__TEST__:";

const TEST_DATA = {
  clients: {
    clientA: TEST_PREFIX + "A:" + Math.random().toString(36).substring(2, 15),
    clientB: TEST_PREFIX + "B:" + Math.random().toString(36).substring(2, 15),
  },
  channels: {
    public: {
      channel: TEST_PREFIX + "channel:public:" + Math.random().toString(36).substring(2, 15),
      rules: {
        maxSubscribers: 100,
        isPublic: true,
      },
    },
    private: {
      channel: TEST_PREFIX + "channel:private:" + Math.random().toString(36).substring(2, 15),
      rules: {
        maxSubscribers: 100,
        isPublic: false,
      },
    },
    nonExistentChannel: {
      channel: TEST_PREFIX + "channel:non-existent:" + Math.random().toString(36).substring(2, 15),
      rules: {}
    }
  },
};

/**
 * Cleanup function to remove test data
 */
async function cleanupTestData() {
  try {
    // Delete test channels
    await request(testConfig.API_URL)
      .delete(`/api/channels/${TEST_DATA.channels.public.channel}`)
      .expect(200);
    await request(testConfig.API_URL)
      .delete(`/api/channels/${TEST_DATA.channels.private.channel}`)
      .expect(200);
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

/**
 * Setup function to create test data
 */
async function setupTestData() {
  try {
    // Create test channels
    await request(testConfig.API_URL)
      .post("/api/channels")
      .send(TEST_DATA.channels.public)
      .expect(201);

    await request(testConfig.API_URL)
      .post("/api/channels")
      .send(TEST_DATA.channels.private)
      .expect(201);

    // Create test clients
    await request(testConfig.API_URL)
      .post("/api/clients")
      .send({
        clientId: TEST_DATA.clients.clientA,
        metadata: { name: "Test Client A" },
      })
      .expect(201);

    await request(testConfig.API_URL)
      .post("/api/clients")
      .send({
        clientId: TEST_DATA.clients.clientB,
        metadata: { name: "Test Client B" },
      })
      .expect(201);

    // Grant access to private channel for clientA
    await request(testConfig.API_URL)
      .post(`/api/channels/${TEST_DATA.channels.private.channel}/access/${TEST_DATA.clients.clientA}`)
      .expect(200);

  } catch (error) {
    console.error("Error during setup:", error);
    throw error;
  }
}

/**
 * Test suite for HTTP API endpoints
 */
describe("HTTP API E2E Tests", () => {
  // Run cleanup after all tests
  afterAll(async () => {
    await cleanupTestData();
  });

  /**
   * Test the health check endpoint
   */
  describe("GET /api/health", () => {
    it("should return 200 OK with health status", async () => {
      const response = await request(testConfig.API_URL)
        .get("/api/health")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });
  });

  /**
   * Test client management endpoints
   */
  describe("Client Management", () => {
    describe("POST /api/clients", () => {
      it("should create a new client", async () => {
        const clientData = {
          clientId: TEST_DATA.clients.clientA,
          metadata: {
            name: "Test Client A",
          },
        };

        const response = await request(testConfig.API_URL)
          .post("/api/clients")
          .send(clientData)
          .expect("Content-Type", /json/)
          .expect(201);

        expect(response.body).toEqual({
          message: 'New client ID generated',
          clientId: TEST_DATA.clients.clientA,
        });
      });

      it("should return 201 for empty client data", async () => {
        const response = await request(testConfig.API_URL)
          .post("/api/clients")
          .send({})
          .expect("Content-Type", /json/)
          .expect(201);
        expect(response.body).toEqual({
          message: 'New client ID generated',
          clientId: expect.any(String),
        });
        const newClientId = response.body.clientId;
        await request(testConfig.API_URL)
          .delete(`/api/clients/${newClientId}`)
          .expect(200);
      });

      it("should return 200 for duplicate client id", async () => {
        const clientData = {
          clientId: TEST_DATA.clients.clientA,
          metadata: {
            name: "Duplicate Client",
          },
        };

        const response = await request(testConfig.API_URL)
          .post("/api/clients")
          .send(clientData)
          .expect("Content-Type", /json/)
          .expect(200);

        expect(response.body).toEqual({
          message: 'Client ID is valid',
          clientId: TEST_DATA.clients.clientA,
        });
      });
    });

    describe("DELETE /api/clients/:clientId", () => {
      it("should delete an existing client", async () => {
        const response = await request(testConfig.API_URL)
          .delete(`/api/clients/${TEST_DATA.clients.clientA}`)
          .expect("Content-Type", /json/)
          .expect(200);

        expect(response.body).toEqual({
          clientId: TEST_DATA.clients.clientA,
          deletedChannels: 0,
          deletedSubscriptions: 0,
          message: `Client '${TEST_DATA.clients.clientA}' deleted successfully`,
        });
      });

      it("should return 404 for non-existent client", async () => {
        const nonExistentClientId = "non-existent-client";

        await request(testConfig.API_URL)
          .delete(`/api/clients/${nonExistentClientId}`)
          .expect("Content-Type", /json/)
          .expect(404);
      });
    });
  });

  /**
   * Test the channel management endpoints
   */
  describe("Channel Management", () => {
    const testChannel = TEST_DATA.channels.public;
    const testPrivateChannel = TEST_DATA.channels.private;
    it("should create a new public channel", async () => {
      const response = await request(testConfig.API_URL)
        .post("/api/channels")
        .send(testChannel)
        .expect("Content-Type", /json/)
        .expect(201);
      expect(response.body).toEqual({
        ...testChannel
      });
    });

    it("should create a new private channel", async () => {
      const response = await request(testConfig.API_URL)
        .post("/api/channels")
        .send(testPrivateChannel)
        .expect("Content-Type", /json/)
        .expect(201);
      expect(response.body).toEqual({
        ...testPrivateChannel
      });
    });

    it("should return 400 for invalid channel data", async () => {
      const invalidChannel = {
        // Missing required name field
        description: "Invalid channel",
        isPublic: false,
      };

      await request(testConfig.API_URL)
        .post("/api/channels")
        .send(invalidChannel)
        .expect("Content-Type", /json/)
        .expect(400);
    });

    it("should return 409 for duplicate channel name", async () => {
      await request(testConfig.API_URL)
        .post("/api/channels")
        .send(testChannel)
        .expect("Content-Type", /json/)
        .expect(409);
    });
  });

  /**
   * Test the channel access control endpoints
   */
  describe("Channel Access Control", () => {
    const testClientId = TEST_DATA.clients.clientA;
    const testPublicChannel = TEST_DATA.channels.public;
    const testPrivateChannel = TEST_DATA.channels.private;
    describe("POST /api/channels/:channel/access/:clientId", () => {
      it("should grant access to a private channel", async () => {
        const response = await request(testConfig.API_URL)
          .post(`/api/channels/${testPrivateChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(200);
        expect(response.body).toEqual({
          accessGranted: true,
          channel: testPrivateChannel.channel,
          clientId: testClientId,
        });
      });

      it("should return 404 for non-existent channel", async () => {
        const nonExistentChannel = TEST_DATA.channels.nonExistentChannel;

        await request(testConfig.API_URL)
          .post(`/api/channels/${nonExistentChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(404);
      });

      it("should return 400 for public channel", async () => {
        await request(testConfig.API_URL)
          .post(`/api/channels/${testPublicChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(400);
      });
    });

    describe("DELETE /api/channels/:channel/access/:clientId", () => {
      it("should revoke access from a private channel", async () => {
        const response = await request(testConfig.API_URL)
          .delete(`/api/channels/${testPrivateChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(200);

        expect(response.body).toEqual({
          accessRevoked: true,
          channel: testPrivateChannel.channel,
          clientId: testClientId,
        });
      });

      it("should return 404 for non-existent channel", async () => {
        const nonExistentChannel = TEST_DATA.channels.nonExistentChannel;

        await request(testConfig.API_URL)
          .delete(`/api/channels/${nonExistentChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(404);
      });

      it("should return 400 for public channel", async () => {
        await request(testConfig.API_URL)
          .delete(`/api/channels/${testPublicChannel.channel}/access/${testClientId}`)
          .expect("Content-Type", /json/)
          .expect(400);
      });

      it("should return 200 for non-existent access", async () => {
        const nonExistentClientId = TEST_DATA.clients.clientB;

        await request(testConfig.API_URL)
          .delete(`/api/channels/${testPrivateChannel.channel}/access/${nonExistentClientId}`)
          .expect("Content-Type", /json/)
          .expect(200);
      });
    });
  });

  /**
   * Test the notifications endpoint
   */
  describe("POST /api/notifications", () => {
    const testNotification = {
      channel: TEST_DATA.channels.public.channel,
      message: "Test notification",
    };

    it("should create a new notification", async () => {
      const response = await request(testConfig.API_URL)
        .post("/api/notifications")
        .send(testNotification)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        ...testNotification,
        timestamp: expect.any(Number),
      });
    });

    it("should return 400 for invalid notification data", async () => {
      const invalidNotification = {
        channel: TEST_DATA.channels.public.channel,
        // Missing required message field
        type: "info",
      };

      await request(testConfig.API_URL)
        .post("/api/notifications")
        .send(invalidNotification)
        .expect("Content-Type", /json/)
        .expect(400);
    });

    it("should return 400 for non-existent channel", async () => {
      const nonExistentChannelNotification = {
        channel: TEST_PREFIX + "non-existent-channel" + Math.random().toString(36).substring(2, 15),
        message: "Test notification",
      };

      await request(testConfig.API_URL)
        .post("/api/notifications")
        .send(nonExistentChannelNotification)
        .expect("Content-Type", /json/)
        .expect(404);
    });
  });

  /**
   * Test the notifications retrieval endpoint
   */
  describe("GET /api/notifications/:channel", () => {
    const channel = TEST_DATA.channels.public;
    it("should return channel notifications", async () => {
      const response = await request(testConfig.API_URL)
        .get(`/api/notifications/${channel.channel}`)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((notification: unknown) => {
        expect(notification).toHaveProperty("id");
        expect(notification).toHaveProperty("channel", channel.channel);
        expect(notification).toHaveProperty("message");
        expect(notification).toHaveProperty("timestamp");
      });
    });

    it("should return 404 for non-existent channel", async () => {
      const nonExistentChannel = TEST_PREFIX + "non-existent-channel" + Math.random().toString(36).substring(2, 15);

      await request(testConfig.API_URL)
        .get(`/api/notifications/${nonExistentChannel}`)
        .expect("Content-Type", /json/)
        .expect(404);
    });
  });

  /**
   * Test the channel subscription endpoint
   */
  describe("POST /api/channels/:channel/subscribe", () => {
    const testPublicChannel = TEST_DATA.channels.public;
    const testPrivateChannel = TEST_DATA.channels.private;
    const testClientId = "test-client-1";

    it("should subscribe a client to a channel", async () => {
      const response = await request(testConfig.API_URL)
        .post(`/api/channels/${testPublicChannel.channel}/subscribe`)
        .send({ clientId: testClientId })
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        message: `Subscribed to channel: ${testPublicChannel.channel}`,
      });
    });

    it("should return 400 for invalid subscription data", async () => {
      await request(testConfig.API_URL)
        .post(`/api/channels/${testPublicChannel.channel}/subscribe`)
        .send({}) // Missing clientId
        .expect("Content-Type", /json/)
        .expect(400);
    });

    it("should return 404 for non-existent channel", async () => {
      const nonExistentChannel = TEST_PREFIX + "non-existent-channel" + Math.random().toString(36).substring(2, 15) ;

      await request(testConfig.API_URL)
        .post(`/api/channels/${nonExistentChannel}/subscribe`)
        .send({ clientId: testClientId })
        .expect("Content-Type", /json/)
        .expect(404);
    });
  });

  /**
   * Test WebSocket functionality
   */
  describe("WebSocket Tests", () => {
    let wsClient: WebSocket;
    const testMessage = {
      type: "test",
      content: "Test WebSocket message",
    };

    // Setup test data before all WebSocket tests
    beforeAll(async () => {
      await setupTestData();
    });

    afterEach(() => {
      if (wsClient) {
        wsClient.close();
      }
    });

    describe("Connection", () => {
      it("should establish WebSocket connection", (done) => {
        wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);

        wsClient.on("open", () => {
          expect(wsClient.readyState).toBe(WebSocket.OPEN);
          done();
        });

        wsClient.on("error", (error) => {
          done(error);
        });
      });

      it("should handle connection errors", (done) => {
        const invalidWsUrl = "ws://invalid-url";
        wsClient = new WebSocket(invalidWsUrl);

        wsClient.on("error", (error) => {
          expect(error).toBeDefined();
          done();
        });
      });
    });

    describe("Message Handling", () => {
      beforeEach((done) => {
        console.log('----------------0.1------------------');
        wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
        wsClient.on("open", () => {
          console.log('----------------0.2------------------');
          done();
        });
      });

      it("should send and receive messages", async() => {
        console.log('----------------0.3------------------');

        await new Promise((resolve, reject) => {
          wsClient.send(JSON.stringify({
            type: "subscribe",
            channel: TEST_DATA.channels.public.channel,
          }));
          resolve(void 0);
        });
        console.log('----------------0.3.1------------------');
        // Send a notification to the channel after 300ms
        setTimeout(async () => {
          await request(testConfig.API_URL)
            .post("/api/notifications")
            .send({
              channel: TEST_DATA.channels.public.channel,
              message: "Test notification", 
            })
            .expect(200);
        }, 300);
        
        console.log('----------------0.3.1------------------');
        await new Promise((resolve, reject) => {  
          wsClient.on("message", (data) => {
            console.log('----------------1.0------------------');
            const message = JSON.parse(data.toString());
            expect(message).toEqual(testMessage);
            resolve(void 0);
          });
        });
        console.log('----------------0.4------------------');
        
      });

      it("should handle invalid JSON messages", (done) => {
        wsClient.on("error", (error) => {
          expect(error).toBeDefined();
          done();
        });

        wsClient.send("invalid json");
      });
    });

    describe("Channel Subscription", () => {
      it("should receive notifications for subscribed channel", (done) => {
        wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
        wsClient.on("open", () => {
          // Subscribe to channel
          wsClient.send(
            JSON.stringify({
              type: "subscribe",
              channel: TEST_DATA.channels.public.channel,
            })
          );
          // Send a notification to the channel
          request(testConfig.API_URL)
            .post("/api/notifications")
            .send({
              channel: TEST_DATA.channels.public.channel,
              message: "Test notification",
            })
            .expect(200);
        });

        wsClient.on("message", (data) => {
          const message = JSON.parse(data.toString());
          console.log(message);
          if (message.type === "notification") {
            expect(message.channel).toBe(TEST_DATA.channels.public.channel);
            expect(message.message).toBe("Test notification Web Socket");
            done();
          }
        });
      });

      it("should not receive notifications for unsubscribed channel", (done) => {
        wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
        let receivedNotification = false;
        wsClient.on("open", () => {
          // Send a notification to the channel
          request(testConfig.API_URL)
            .post("/api/notifications")
            .send({
              channel: TEST_DATA.channels.public.channel,
              message: "Test notification",
            })
            .expect(200);
          // Wait for a short time to ensure no notification is received
          setTimeout(() => {
            expect(receivedNotification).toBe(false);
            done();
          }, 1000);
        });

        wsClient.on("message", () => {
          receivedNotification = true;
        });
      });
    });

    describe("Disconnection", () => {
      it("should handle client disconnection", (done) => {
        wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
        wsClient.on("open", () => {
          wsClient.close();
        });

        wsClient.on("close", () => {
          expect(wsClient.readyState).toBe(WebSocket.CLOSED);
          done();
        });
      });
    });
  });
}); 