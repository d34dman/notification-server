import request from "supertest";
import { testConfig } from "./jest.setup";
import { logger } from "../utils/logger";

export const TEST_PREFIX = "__TEST__:";

export const TEST_DATA = {
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
      rules: {},
    },
  },
};

/**
 * Cleanup function to remove test data
 */
export async function cleanupTestData() {
  try {
    // Delete test channels
    logger.debug(`[TEST] Deleting test channel: ${TEST_DATA.channels.public.channel}`);
    await request(testConfig.API_URL)
      .delete(`/api/channels/${TEST_DATA.channels.public.channel}`)
      .expect(200);
    logger.debug(`[TEST] Deleting test channel: ${TEST_DATA.channels.private.channel}`);
    await request(testConfig.API_URL)
      .delete(`/api/channels/${TEST_DATA.channels.private.channel}`)
      .expect(200);

    // Delete test clients
    logger.debug(`[TEST] Deleting test client: ${TEST_DATA.clients.clientA}`);
    await request(testConfig.API_URL)
      .delete(`/api/clients/${TEST_DATA.clients.clientA}`)
      .expect(res => {
        if (res.status !== 200 && res.status !== 476 && res.status !== 404) {
          throw new Error(`Expected status 200, 476, or 404, got ${res.status}`);
        }
      });
    logger.debug(`[TEST] Deleting test client: ${TEST_DATA.clients.clientB}`);
    await request(testConfig.API_URL)
      .delete(`/api/clients/${TEST_DATA.clients.clientB}`)
      .expect(res => {
        if (res.status !== 200 && res.status !== 476 && res.status !== 404) {
          throw new Error(`Expected status 200, 476, or 404, got ${res.status}`);
        }
      });
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

/**
 * Setup function to create test data
 */
export async function setupTestData() {
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
      .post(
        `/api/channels/${TEST_DATA.channels.private.channel}/access/${TEST_DATA.clients.clientA}`
      )
      .expect(200);
  } catch (error) {
    console.error("Error during setup:", error);
    throw error;
  }
}
