/**
 * MT Nexus Global ERP — Centralized Error Handling Middleware
 */

const { ZodError } = require("zod");
const { Prisma } = require("@prisma/client");

function errorHandler(err, req, res, next) {
  console.error(
    `[API ERROR] ${req.method} ${req.path}: ${err.code || err.name || "Error"}`,
  );

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // 2. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = err.meta && err.meta.target ? err.meta.target : "field";
      return res.status(409).json({
        success: false,
        error: "Conflict Error",
        message: `A record with this unique ${target} already exists.`,
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "The requested database record does not exist or was deleted.",
      });
    }
  }

  // 3. Custom / Handled Application Errors
  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: err.name || "ServerError",
    message:
      statusCode >= 500 && process.env.NODE_ENV === "production"
        ? "An internal error occurred."
        : message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
