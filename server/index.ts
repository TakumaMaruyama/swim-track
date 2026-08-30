import { createServer } from "node:http";
import { createApp } from "./app";
import { assertAuthSchemaReady } from "./authReadiness";
import configuration from "./config";
import { serveStatic, setupVite } from "./vite";

const app = createApp({ requestLog: true });

async function startServer() {
  await assertAuthSchemaReady();
  const server = createServer(app);
  if (configuration.nodeEnv === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(configuration.port, "0.0.0.0", () => {
    console.log("SwimTrack server started", {
      port: configuration.port,
      environment: configuration.nodeEnv,
      apiAccess: "same-origin",
      sessionCookie: "swimtrack.sid",
    });
  });
}

startServer().catch((error) => {
  console.error("SwimTrack server failed to start", error);
  process.exitCode = 1;
});
