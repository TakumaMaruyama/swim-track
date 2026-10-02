import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const events: Record<string, (event: any) => void> = {};
  const remove = vi.fn();
  const fetch = vi.fn();
  vm.runInNewContext(readFileSync("client/public/sw.js", "utf8"), {
    self: { location: { origin: "https://swimtrack.test" }, addEventListener: (type: string, handler: any) => { events[type] = handler; }, clients: { claim: vi.fn() } },
    caches: { keys: async () => ["swimtime-static-v2", "swimtime-static-v3", "other-app-cache"], delete: remove },
    fetch, URL, Response,
  });
  return { events, remove, fetch };
}

describe("PWA startup failure boundaries", () => {
  it("provides a retry page when offline navigation fails", async () => {
    const { events, fetch } = worker();
    fetch.mockRejectedValue(new TypeError("offline"));
    let response!: Promise<Response>;
    events.fetch({ request: { method: "GET", mode: "navigate" }, respondWith: (value: Promise<Response>) => { response = value; } });
    const result = await response;
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.text()).toContain("再読み込み");
  });

  it("does not intercept identity-scoped API reads or writes", () => {
    const { events, fetch } = worker();
    const respondWith = vi.fn();
    for (const method of ["GET", "POST"]) {
      events.fetch({ request: { method, mode: "cors", url: "https://swimtrack.test/api/auth/session" }, respondWith });
    }
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only retires this app's old static caches", async () => {
    const { events, remove } = worker();
    let activation!: Promise<void>;
    events.activate({ waitUntil: (value: Promise<void>) => { activation = value; } });
    await activation;
    expect(remove.mock.calls).toEqual([["swimtime-static-v2"]]);
  });
});
