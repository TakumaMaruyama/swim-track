// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRoute, PasswordChangeRoute } from "./AuthRoute";

const auth = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: true,
  mustChangePassword: true,
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("wouter", () => ({ useLocation: () => ["/athletes", navigate] }));

describe("authentication route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isLoading = false;
    auth.isAuthenticated = true;
    auth.mustChangePassword = true;
  });

  it("sends a temporary-password session to password change before rendering protected content", async () => {
    render(<AuthRoute><p>protected content</p></AuthRoute>);
    expect(screen.queryByText("protected content")).toBeNull();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/change-password", { replace: true }));
  });

  it("allows a temporary-password session on the password-change route", () => {
    render(<PasswordChangeRoute><p>password form</p></PasswordChangeRoute>);
    expect(screen.getByText("password form")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});