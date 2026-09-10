// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useSWR, { SWRConfig, useSWRConfig } from "swr";
import { SessionDataBoundary } from "./SessionDataBoundary";
import { useAuth, type AuthResponse } from "@/hooks/use-auth";

vi.mock("wouter", () => ({ useLocation: () => ["/athletes", vi.fn()] }));

const admin: AuthResponse = {
  ok: true,
  user: { id: 1, username: "admin", role: "admin", isActive: true, credentialState: "active" },
};
const student: AuthResponse = {
  ok: true,
  user: { id: 2, username: "student", role: "student", isActive: true, credentialState: "active" },
};
const dataKeys = ["/api/athletes", "/api/swim-records", "/api/records/improvement-summary"];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function Data({ url }: { url: string }) {
  const { data } = useSWR<string[]>(url);
  return <div>{url}: {data?.join(",") ?? "loading"}</div>;
}

function Page() {
  const { user, logout, athleteLogin, login } = useAuth();
  const { mutate } = useSWRConfig();
  const [selectedAthlete, setSelectedAthlete] = useState("");
  return <>
    <span data-testid="role">{user?.role ?? "guest"}</span>
    {dataKeys.map((url) => <Data key={url} url={url} />)}
    <p>{selectedAthlete}</p>
    <button onClick={() => setSelectedAthlete("inactive-selected")}>select</button>
    <button onClick={() => void logout()}>logout</button>
    <button onClick={() => void athleteLogin("student", "password")}>student login</button>
    <button onClick={() => void login({ username: "admin", password: "password" })}>admin login</button>
    <button onClick={() => void mutate(dataKeys[0])}>refresh data</button>
  </>;
}

function SessionRefresh() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => void mutate("/api/auth/session")}>refresh session</button>;
}

function setup(initialSession: AuthResponse | null = admin, initialSessionError?: Error) {
  let currentSession = initialSession;
  let sessionError = initialSessionError;
  let pendingData: Promise<string[]> | undefined;
  const fetcher = vi.fn(async (url: string) => {
    if (url === "/api/auth/session") {
      if (sessionError) throw sessionError;
      return currentSession;
    }
    if (pendingData) return pendingData;
    return currentSession?.user?.role === "admin" ? ["active", "inactive"] : ["active"];
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    currentSession = url.endsWith("logout") ? null : url.endsWith("athlete/login") ? student : admin;
    sessionError = undefined;
    return { ok: true, json: async () => currentSession ?? { ok: true } };
  }));
  render(
    <SWRConfig value={{
      provider: () => new Map(), fetcher, keepPreviousData: true,
      dedupingInterval: 0, shouldRetryOnError: false,
    }}>
      <SessionRefresh />
      <SessionDataBoundary fallback={<p>session loading</p>}><Page /></SessionDataBoundary>
    </SWRConfig>,
  );
  return {
    fetcher,
    setSession: (value: AuthResponse | null) => { currentSession = value; },
    setSessionError: (value: Error) => { sessionError = value; },
    setPendingData: (value: Promise<string[]>) => { pendingData = value; },
  };
}

async function expectAdminData() {
  await waitFor(() => expect(screen.getAllByText(/inactive/)).toHaveLength(dataKeys.length));
}

describe("session data cache isolation", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("supports public browsing and login after the initial session returns 401", async () => {
    setup(null, Object.assign(new Error("unauthenticated"), { status: 401 }));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("guest"));
    await waitFor(() => expect(screen.getAllByText(/: active$/)).toHaveLength(dataKeys.length));
    fireEvent.click(screen.getByText("admin login"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("admin"));
    await expectAdminData();
  });

  it("drops admin responses and local selections on logout, including late in-flight responses", async () => {
    const app = setup();
    await expectAdminData();
    fireEvent.click(screen.getByText("select"));
    const oldRequest = deferred<string[]>();
    app.setPendingData(oldRequest.promise);
    const callsBeforeRefresh = app.fetcher.mock.calls.length;
    fireEvent.click(screen.getByText("refresh data"));
    await waitFor(() => expect(app.fetcher.mock.calls.length).toBeGreaterThan(callsBeforeRefresh));

    const guestRequest = deferred<string[]>();
    app.setPendingData(guestRequest.promise);
    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("guest"));
    expect(screen.queryByText(/inactive/)).toBeNull();
    await act(async () => { oldRequest.resolve(["active", "inactive-late"]); });
    expect(screen.queryByText(/inactive/)).toBeNull();
    await act(async () => { guestRequest.resolve(["active"]); });
    await waitFor(() => expect(screen.getAllByText(/: active$/)).toHaveLength(dataKeys.length));
    expect(screen.queryByText(/inactive/)).toBeNull();
  });

  it("starts a new cache on athlete login and can fetch admin-only data again after admin login", async () => {
    const app = setup();
    await expectAdminData();
    const studentRequest = deferred<string[]>();
    app.setPendingData(studentRequest.promise);
    fireEvent.click(screen.getByText("student login"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("student"));
    expect(screen.queryByText(/inactive/)).toBeNull();
    await act(async () => { studentRequest.resolve(["active"]); });
    await waitFor(() => expect(screen.getAllByText(/: active$/)).toHaveLength(dataKeys.length));

    const adminRequest = deferred<string[]>();
    app.setPendingData(adminRequest.promise);
    fireEvent.click(screen.getByText("admin login"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("admin"));
    expect(screen.queryByText(/inactive/)).toBeNull();
    await act(async () => { adminRequest.resolve(["active", "inactive"]); });
    await expectAdminData();
  });

  it.each(["demotion", "expired"])("discards admin cache after session revalidation: %s", async (mode) => {
    const app = setup();
    await expectAdminData();
    const nextRequest = deferred<string[]>();
    app.setPendingData(nextRequest.promise);
    if (mode === "expired") app.setSessionError(Object.assign(new Error("expired"), { status: 401 }));
    else app.setSession({ ...admin, user: { ...admin.user!, role: "student" } });
    fireEvent.click(screen.getByText("refresh session"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe(mode === "expired" ? "guest" : "student"));
    expect(screen.queryByText(/inactive/)).toBeNull();
    await act(async () => { nextRequest.resolve(["active"]); });
    await waitFor(() => expect(screen.getAllByText(/: active$/)).toHaveLength(dataKeys.length));
  });

  it("hides stale admin data when session verification fails", async () => {
    const app = setup();
    await expectAdminData();
    app.setSessionError(Object.assign(new Error("unavailable"), { status: 500 }));
    fireEvent.click(screen.getByText("refresh session"));
    await screen.findByRole("alert");
    expect(screen.queryByText(/inactive/)).toBeNull();
    expect(screen.queryByTestId("role")).toBeNull();
  });
});
