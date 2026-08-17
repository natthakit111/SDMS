type ErrorCode =
  | "AUTH_MISSING_CREDENTIALS"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_ACCOUNT_DISABLED"
  | "AUTH_NO_PASSWORD_SET"
  | "AUTH_INVALID_PASSWORD";

export const errorMessages: Record<ErrorCode, { th: string; en: string }> = {
  AUTH_MISSING_CREDENTIALS: {
    th: "กรุณากรอกข้อมูลเข้าสู่ระบบ",
    en: "Please enter your login information",
  },
  AUTH_USER_NOT_FOUND: {
    th: "ไม่พบข้อมูลเบอร์โทรศัพท์ อีเมล หรือชื่อผู้ใช้นี้",
    en: "Phone number, email, or username not found",
  },
  AUTH_ACCOUNT_DISABLED: {
    th: "บัญชีนี้ถูกปิดการใช้งาน",
    en: "This account has been disabled",
  },
  AUTH_NO_PASSWORD_SET: {
    th: "บัญชีนี้ใช้การเข้าสู่ระบบด้วย Google",
    en: "This account signs in with Google",
  },
  AUTH_INVALID_PASSWORD: {
    th: "รหัสผ่านไม่ถูกต้อง",
    en: "Incorrect password",
  },
};

export const getErrorMessage = (error: any, lang: "th" | "en"): string => {
  const code = error?.response?.data?.code as ErrorCode | undefined;
  if (code && errorMessages[code]) {
    return errorMessages[code][lang];
  }
  // fallback: ไม่มี code (controller อื่นที่ยังไม่แก้) → ใช้ message เดิมจาก backend
  return (
    error?.response?.data?.message ||
    (lang === "th"
      ? "เกิดข้อผิดพลาด กรุณาลองใหม่"
      : "Something went wrong, please try again")
  );
};
