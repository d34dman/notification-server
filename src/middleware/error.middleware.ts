import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  
  logger.error(`Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    statusCode,
  });
  
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
  });
} 