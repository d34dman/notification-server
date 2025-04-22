import request from "supertest";
import { testConfig } from "./jest.setup";
import { TEST_DATA, setupTestData, cleanupTestData, TEST_PREFIX } from "./test.data";

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

    it("should return 404 for non-existent channel", async () => {
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
}); 