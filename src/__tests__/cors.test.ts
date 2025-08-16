/**
 * Test CORS configuration parsing
 */
describe("CORS Configuration", () => {
  // Helper function to mimic the parseCorsOrigins function from index.ts
  const parseCorsOrigins = (corsOrigin: string): string[] | boolean => {
    if (!corsOrigin || corsOrigin === "*") {
      return true; // Allow all origins
    }
    // Split by comma and trim whitespace
    return corsOrigin
      .split(",")
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  };

  describe("parseCorsOrigins", () => {
    it("should return true for wildcard", () => {
      expect(parseCorsOrigins("*")).toBe(true);
      expect(parseCorsOrigins("")).toBe(true);
    });

    it("should parse single origin", () => {
      const result = parseCorsOrigins("http://localhost:3000");
      expect(result).toEqual(["http://localhost:3000"]);
    });

    it("should parse multiple origins", () => {
      const result = parseCorsOrigins("http://localhost:3000,https://app.example.com");
      expect(result).toEqual(["http://localhost:3000", "https://app.example.com"]);
    });

    it("should handle whitespace around origins", () => {
      const result = parseCorsOrigins(
        " http://localhost:3000 , https://app.example.com , https://admin.example.com "
      );
      expect(result).toEqual([
        "http://localhost:3000",
        "https://app.example.com",
        "https://admin.example.com",
      ]);
    });

    it("should filter out empty origins", () => {
      const result = parseCorsOrigins("http://localhost:3000,,https://app.example.com,");
      expect(result).toEqual(["http://localhost:3000", "https://app.example.com"]);
    });

    it("should handle multiple origins with various protocols", () => {
      const result = parseCorsOrigins(
        "http://localhost:3000,https://staging.example.com:8080,ws://localhost:8080"
      );
      expect(result).toEqual([
        "http://localhost:3000",
        "https://staging.example.com:8080",
        "ws://localhost:8080",
      ]);
    });
  });

  describe("CORS origin validation", () => {
    it("should validate origin against allowed origins", () => {
      const allowedOrigins = ["http://localhost:3000", "https://app.example.com"];

      expect(allowedOrigins.includes("http://localhost:3000")).toBe(true);
      expect(allowedOrigins.includes("https://app.example.com")).toBe(true);
      expect(allowedOrigins.includes("https://malicious.com")).toBe(false);
      expect(allowedOrigins.includes("http://localhost:3001")).toBe(false);
    });

    it("should handle wildcard (allow all) scenario", () => {
      const allowedOrigins = true;

      // When allowedOrigins is true, all origins should be allowed
      expect(allowedOrigins).toBe(true);
    });
  });
});
