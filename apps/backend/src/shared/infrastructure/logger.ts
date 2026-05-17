type LogLevel = "info" | "warn" | "error";

export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    writeLog("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    writeLog("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    writeLog("error", message, metadata);
  },
};

function writeLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    JSON.stringify(payload),
  );
}
