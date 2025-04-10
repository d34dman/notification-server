import { logger } from "./logger";

interface EnvVariables {
  PORT: string;
  REDIS_URL: string;
  WS_PORT: string;
}

export function validateEnv(): void {
  const requiredEnvVars: (keyof EnvVariables)[] = ["PORT", "REDIS_URL", "WS_PORT"];
  
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingEnvVars.length > 0) {
    logger.error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`
    );
    process.exit(1);
  }
  
  logger.info("Environment variables validated successfully");
} 