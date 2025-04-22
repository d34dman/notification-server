import { config } from "dotenv";
import path from "path";

/**
 * Type definition for test configuration
 */
export interface TestConfig {
  API_URL: string;
  WS_URL: string;
  TIMEOUT: number;
}

/**
 * Load environment variables from .env.test file
 * Falls back to .env if .env.test doesn't exist
 */
const envPath = path.resolve(process.cwd(), ".env.test");
config({ path: envPath });

/**
 * Test configuration
 */
export const testConfig: TestConfig = {
  API_URL: process.env.API_URL || "http://localhost:3000",
  WS_URL: process.env.WS_URL || "ws://localhost:8080",
  TIMEOUT: 1000, // 3 seconds
}; 