// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AthleteLogin from "./AthleteLogin";

const auth = vi.hoisted(() => ({
  identify: vi.fn(),
  login: vi.fn(),
  setupPassword: vi.fn(),
  isAuthenticated: false,
  mustChangePassword: false,
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("wouter", () => ({ useLocation: () => ["/login", navigate] }));

describe("AthleteLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated = false;
    auth.mustChangePassword = false;
  });

  it("starts initial setup only after identity verification and submits password confirmation", async () => {
    auth.identify.mockResolvedValue({ ok: true, state: "initial_setup" });
    auth.setupPassword.mockResolvedValue({ ok: true, user: { id: 10 } });
    render(<AthleteLogin />);

    fireEvent.click(screen.getByRole("button", { name: "初めての方（パスワード設定）" }));
    fireEvent.change(screen.getByLabelText("登録済みの氏名（フルネーム）"), {
      target: { value: "山田\u3000太郎" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await screen.findByText("初回パスワード設定");
    expect(auth.identify).toHaveBeenCalledWith("山田\u3000太郎");

    fireEvent.change(screen.getByLabelText("新しいパスワード（6文字以上）"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), {
      target: { value: "secret1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "設定してログイン" }));

    await waitFor(() =>
      expect(auth.setupPassword).toHaveBeenCalledWith("山田\u3000太郎", "secret1", "secret1"),
    );
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("does not submit initial setup when the confirmation differs", async () => {
    auth.identify.mockResolvedValue({ ok: true, state: "initial_setup" });
    render(<AthleteLogin />);

    fireEvent.click(screen.getByRole("button", { name: "初めての方（パスワード設定）" }));
    fireEvent.change(screen.getByLabelText("登録済みの氏名（フルネーム）"), { target: { value: "山田太郎" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await screen.findByText("初回パスワード設定");
    fireEvent.change(screen.getByLabelText("新しいパスワード（6文字以上）"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), { target: { value: "secret2" } });
    fireEvent.click(screen.getByRole("button", { name: "設定してログイン" }));

    expect(await screen.findByText("確認用パスワードが一致しません")).toBeTruthy();
    expect(auth.setupPassword).not.toHaveBeenCalled();
  });
});