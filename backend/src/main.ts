import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app";
import { configuration, ConfigurationError } from "./config";
import { ApiError, ErrorFilter } from "./common/errors";
import { strictJson } from "./common/strict-json";
import { Security } from "./security/security";

export async function createApp() {
  const config = configuration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    const id = randomUUID();
    res.locals.correlationId = id;
    res.setHeader("X-Request-ID", id);
    res.setHeader("Cache-Control", "no-store");
    res.on("finish", () => {
      if (config.NODE_ENV !== "test")
        console.log(
          JSON.stringify({
            event: "request_completed",
            request_id: id,
            method: req.method,
            status: res.statusCode,
            elapsed_ms: Math.round(performance.now() - started),
          }),
        );
    });
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.use(
    json({
      limit: 32768,
      strict: true,
      verify: (_req, _res, buffer) => {
        strictJson(buffer.toString("utf8"));
      },
    }),
  );
  const security = app.get(Security);
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // No per-socket limit: behind the proxy chain the socket is a container, so it would be a
      // second, smaller global bucket that one client could exhaust for everyone (G5).
      await security.rate("global", 6000);
      if (req.headers.authorization)
        await security.authenticatedRate(req.headers.authorization);
      next();
    } catch (error) {
      const limited =
        error instanceof ApiError && error.code === "RATE_LIMITED";
      res.status(limited ? 429 : 503).json({
        error: {
          code: limited ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE",
          request_id: res.locals.correlationId,
        },
      });
    }
  });
  app.useGlobalFilters(new ErrorFilter());
  // Express parser errors precede Nest filters. Never echo malformed bodies or parse diagnostics.
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (!error) {
        next();
        return;
      }
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          request_id: res.locals.correlationId,
        },
      });
    },
  );
  app.enableShutdownHooks();
  await app.init();
  const server = app.getHttpServer() as import("node:http").Server;
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  return app;
}
if (require.main === module)
  createApp()
    .then((app) => app.listen(configuration().PORT, "0.0.0.0"))
    .catch((error: unknown) => {
      console.error(
        error instanceof ConfigurationError
          ? error.message
          : "BACKEND_STARTUP_REFUSED: inspect configuration and production gates",
      );
      process.exitCode = 1;
    });
