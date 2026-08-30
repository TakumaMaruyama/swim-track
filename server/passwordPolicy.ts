export const PASSWORD_MIN_CHARACTERS = 6;
export const PASSWORD_MAX_BYTES = 72;

// This is a bcrypt-shaped sentinel with no retained source password. Accounts in
// setup_required state are rejected before password comparison as an additional guard.
export const UNUSABLE_PASSWORD_HASH =
  "$2b$10$.....................................................";

export function validateNewPassword(password: unknown, confirmation: unknown) {
  if (typeof password !== "string" || typeof confirmation !== "string") {
    return "パスワードは6文字以上で確認入力と一致させてください";
  }
  if (Array.from(password).length < PASSWORD_MIN_CHARACTERS) {
    return "パスワードは6文字以上で確認入力と一致させてください";
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return "パスワードはUTF-8で72バイト以内にしてください";
  }
  if (password !== confirmation) {
    return "パスワードは6文字以上で確認入力と一致させてください";
  }
  return null;
}
