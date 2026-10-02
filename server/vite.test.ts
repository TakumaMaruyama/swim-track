import express from "express";
import request from "supertest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveStatic } from "./vite";

let directory: string;
const script = "console.log('static startup fixture');";
const app = express();

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "swimtrack-static-"));
  await mkdir(path.join(directory, "assets"));
  await writeFile(path.join(directory, "index.html"), "<html>SwimTrack shell</html>");
  await writeFile(path.join(directory, "assets/app-test.js"), script);
  await writeFile(path.join(directory, "assets/app-test.js.gz"), gzipSync(script));
  await writeFile(path.join(directory, "assets/legacy-test.js"), script);
  await writeFile(path.join(directory, "assets/app-test.css"), "body { color: blue; }");
  await writeFile(path.join(directory, "assets/app-test.css.gz"), gzipSync("body { color: blue; }"));
  serveStatic(app, directory);
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

describe("production static delivery", () => {
  it.each(["js", "css"])("negotiates gzip for %s with the original MIME type", async (extension) => {
    const response = await request(app).get(`/assets/app-test.${extension}`).set("Accept-Encoding", "gzip");
    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers["vary"]).toContain("Accept-Encoding");
    expect(response.headers["content-type"]).toContain(extension === "js" ? "javascript" : "text/css");
    expect(response.text).toBe(extension === "js" ? script : "body { color: blue; }");
  });

  it.each(["identity", "gzip;q=0, identity"])("honors an uncompressed client: %s", async (encoding) => {
    const response = await request(app).get("/assets/app-test.js").set("Accept-Encoding", encoding);
    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["vary"]).toContain("Accept-Encoding");
    expect(response.text).toBe(script);
  });

  it("supports HEAD, conditional requests and deployments without a gzip sibling", async () => {
    const head = await request(app).head("/assets/app-test.js").set("Accept-Encoding", "gzip");
    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    const unchanged = await request(app).get("/assets/app-test.js")
      .set("Accept-Encoding", "gzip").set("If-None-Match", head.headers.etag);
    expect(unchanged.status).toBe(304);
    const legacy = await request(app).get("/assets/legacy-test.js").set("Accept-Encoding", "gzip");
    expect(legacy.status).toBe(200);
    expect(legacy.headers["content-encoding"]).toBeUndefined();
    expect(legacy.text).toBe(script);
  });

  it("returns 404 for a retired chunk while retaining SPA deep links", async () => {
    const missing = await request(app).get("/assets/retired-test.js");
    expect(missing.status).toBe(404);
    expect(missing.headers["cache-control"]).toBe("no-store");
    expect(missing.text).not.toContain("SwimTrack shell");
    expect((await request(app).get("/athletes")).text).toContain("SwimTrack shell");
  });
});
