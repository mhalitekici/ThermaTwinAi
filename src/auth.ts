// Supabase email OTP length is configurable from 6 to 10 digits.
// Keep the input and submit guard on the same rule; the server verifies the token.
export const emailOtpInput = {
  minLength: 6,
  maxLength: 10,
  pattern: "[0-9]{6,10}",
} as const;
export const emailOtpPattern = new RegExp(`^${emailOtpInput.pattern}$`);

export function isPublicSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const part = key.split(".")[1];
    return (
      JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).role ===
      "anon"
    );
  } catch {
    return false;
  }
}
export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "otp_expired" || code === "invalid_credentials")
    return "Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  )
    return "Çok fazla istek gönderildi. Biraz bekleyip yeniden deneyin.";
  return "İşlem tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.";
}
