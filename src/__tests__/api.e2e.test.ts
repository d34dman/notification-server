import request from "supertest";
import { testConfig } from "./setup";
import { channel } from "diagnostics_channel";
const TEST_PREFIX = "__TEST__:";
const gTestChannelName = TEST_PREFIX + "channel:" + Math.random().toString(36).substring(2, 15);
/**
 * Test suite for HTTP API endpoints
 */
describe("HTTP API E2E Tests", () => {
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
   * Test the channel management endpoints
   */
  describe("Channel Management", () => {
    const testChannel = {
      channel: gTestChannelName,
      rules: {
        maxSubscribers: 100,
        isPublic: true,
      },
    };

    it("should create a new channel", async () => {
      const response = await request(testConfig.API_URL)
        .post("/api/channels")
        .send(testChannel)
        .expect("Content-Type", /json/)
        .expect(201);
      expect(response.body).toEqual({
        ...testChannel
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
   * Test the notifications endpoint
   */
  describe("POST /api/notifications", () => {
    const testNotification = {
      channel: gTestChannelName,
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
        channel: gTestChannelName,
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

    it("should return channel notifications", async () => {
      const response = await request(testConfig.API_URL)
        .get(`/api/notifications/${gTestChannelName}`)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((notification: unknown) => {
        expect(notification).toHaveProperty("id");
        expect(notification).toHaveProperty("channel", gTestChannelName);
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
    const testChannel = gTestChannelName;
    const testClientId = "test-client-1";

    it("should subscribe a client to a channel", async () => {
      const response = await request(testConfig.API_URL)
        .post(`/api/channels/${gTestChannelName}/subscribe`)
        .send({ clientId: testClientId })
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        message: `Subscribed to channel: ${gTestChannelName}`,
      });
    });

    it("should return 400 for invalid subscription data", async () => {
      await request(testConfig.API_URL)
        .post(`/api/channels/${gTestChannelName}/subscribe`)
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