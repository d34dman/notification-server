import WebSocket from "ws";
import request from "supertest";
import { testConfig } from "./jest.setup";
import { TEST_DATA, setupTestData, cleanupTestData } from "./test.data";

/**
 * Test suite for WebSocket functionality
 */
describe("WebSocket E2E Tests", () => {
  let wsClient: WebSocket;

  // Setup test data before all WebSocket tests
  beforeAll(async () => {
    await setupTestData();
  });

  // Cleanup test data after all tests
  afterAll(async () => {
    await cleanupTestData();
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

  describe("Channel Subscription", () => {
    beforeEach((done) => {
      wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
      wsClient.on("open", () => {
        done();
      });
    });

    it("should receive notifications for subscribed channel", async () => {
      setTimeout(() => {
        wsClient.send(JSON.stringify({
          type: "subscribe",
          channel: TEST_DATA.channels.public.channel,
        }));
      }, 100);

      const testNotification = {
        channel: TEST_DATA.channels.public.channel,
        message: "Test notification",
      };
      // Send a notification to the channel after 300ms
      setTimeout(async () => {
        await request(testConfig.API_URL)
          .post("/api/notifications")
          .send(testNotification)
          .expect(200);
      }, 500);


      // Wait for WebSocket message
      const wsMessage = await new Promise<any>((resolve) => {
        wsClient.on("message", (data: Buffer) => {
          const message = JSON.parse(data.toString());
          if (message.type === "notification") {
            resolve(message);
          }
        });
      });

      // Verify notification content
      expect(wsMessage.data.message).toEqual(testNotification.message);
      expect(wsMessage.channel).toEqual(testNotification.channel);
    });

    it("should not receive notifications for unsubscribed channel", (done) => {
      wsClient = new WebSocket(testConfig.WS_URL + `?clientId=${TEST_DATA.clients.clientA}`);
      let receivedNotification = false;

      wsClient.on("message", (data: Buffer) => {
        const wsMessage = JSON.parse(data.toString());
        if (wsMessage.type === "notification") {
          receivedNotification = true;
        }
      });

      // Send a notification to the channel
      request(testConfig.API_URL)
        .post("/api/notifications")
        .send({
          channel: TEST_DATA.channels.public.channel,
          message: "Test notification on public channel",
        })
        .expect(200);

      // Wait for a short time to ensure no notification is received
      setTimeout(() => {
        expect(receivedNotification).toBe(false);
        wsClient.close();
        done();
      }, 2000);
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