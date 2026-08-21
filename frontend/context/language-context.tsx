//context/language-context.tsx

"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

type Language = "th" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

// ── Translations ──────────────────────────────────────────────────────────────
const translations: Record<string, { th: string; en: string }> = {
  // ── Common ─────────────────────────────────────────────────────────────────
  "common.sending": { th: "กำลังส่ง...", en: "Sending..." },
  "common.saving": { th: "กำลังบันทึก...", en: "Saving..." },
  "common.home": { th: "หน้าแรก", en: "Home" },
  "common.dashboard": { th: "แดชบอร์ด", en: "Dashboard" },
  "common.settings": { th: "ตั้งค่า", en: "Settings" },
  "common.logout": { th: "ออกจากระบบ", en: "Logout" },
  "common.profile": { th: "โปรไฟล์", en: "Profile" },
  "common.admin": { th: "ผู้ดูแลระบบ", en: "Administrator" },
  "common.tenant": { th: "ผู้เช่า", en: "Tenant" },
  "common.notifications": { th: "แจ้งเตือน", en: "Notifications" },
  "common.language": { th: "ภาษา", en: "Language" },
  "common.thai": { th: "ไทย", en: "Thai" },
  "common.english": { th: "อังกฤษ", en: "English" },
  "common.myAccount": { th: "บัญชีของฉัน", en: "My Account" },
  "common.save": { th: "บันทึก", en: "Save" },
  "common.cancel": { th: "ยกเลิก", en: "Cancel" },
  "common.delete": { th: "ลบ", en: "Delete" },
  "common.edit": { th: "แก้ไข", en: "Edit" },
  "common.add": { th: "เพิ่ม", en: "Add" },
  "common.search": { th: "ค้นหา", en: "Search" },
  "common.filter": { th: "กรอง", en: "Filter" },
  "common.all": {
    th: "สถานะทั้งหมด",
    en: "All Statuses",
  },
  "common.loading": { th: "กำลังโหลด...", en: "Loading..." },
  "common.noData": { th: "ไม่พบข้อมูล", en: "No data found" },
  "common.confirm": { th: "ยืนยัน", en: "Confirm" },
  "common.close": { th: "ปิด", en: "Close" },
  "common.view": { th: "ดู", en: "View" },
  "common.download": { th: "ดาวน์โหลด", en: "Download" },
  "common.upload": { th: "อัปโหลด", en: "Upload" },
  "common.status": { th: "สถานะ", en: "Status" },
  "common.actions": { th: "จัดการ", en: "Actions" },
  "common.date": { th: "วันที่", en: "Date" },
  "common.note": { th: "หมายเหตุ", en: "Note" },
  "common.total": { th: "รวม", en: "Total" },
  "common.amount": { th: "จำนวนเงิน", en: "Amount" },
  "common.name": { th: "ชื่อ", en: "Name" },
  "common.phone": { th: "เบอร์โทรศัพท์", en: "Phone" },
  "common.email": { th: "อีเมล", en: "Email" },
  "common.submit": { th: "ส่ง", en: "Submit" },
  "common.viewAll": { th: "ดูทั้งหมด", en: "View all" },
  "common.created": { th: "วันที่สร้าง", en: "Created date" },
  "common.createdAt": { th: "วันที่สร้าง", en: "Created At" },
  "common.firstName": { th: "ชื่อ", en: "First Name" },
  "common.lastName": { th: "นามสกุล", en: "Last Name" },
  "common.username": { th: "ชื่อผู้ใช้", en: "Username" },
  "common.password": { th: "รหัสผ่าน", en: "Password" },
  "common.contact": { th: "ติดต่อ", en: "Contact" },
  "common.allStatus": { th: "ทุกสถานะ", en: "All Statuses" },
  "common.error": { th: "เกิดข้อผิดพลาด", en: "An error occurred" },
  "common.saveSuccess": { th: "บันทึกสำเร็จ", en: "Saved successfully" },
  "common.deleteSuccess": { th: "ลบสำเร็จ", en: "Deleted successfully" },
  "common.confirmDelete": { th: "ยืนยันการลบ?", en: "Confirm delete?" },
  "common.requiredFields": {
    th: "กรุณากรอกข้อมูลให้ครบถ้วน",
    en: "Please fill out all fields",
  },
  "common.required": { th: "จำเป็นต้องกรอก", en: "Required" },

  // ── Login ──────────────────────────────────────────────────────────────────
  "login.subtitle": {
    th: "ระบบบริหารจัดการหอพัก",
    en: "Dormitory Management System",
  },
  "login.orLoginWith": { th: "หรือเข้าสู่ระบบด้วย", en: "or continue with" },
  "login.usernamePlaceholder": { th: "กรอก ชื่อผู้ใช้", en: "Enter username" },
  "login.rememberMe": { th: "จดจำฉัน", en: "Remember me" },
  "login.forgotPassword": { th: "ลืมรหัสผ่าน?", en: "Forgot password?" },
  "login.submit": { th: "เข้าสู่ระบบ", en: "Sign In" },
  "login.loggingIn": { th: "กำลังเข้าสู่ระบบ...", en: "Signing in..." },
  "login.noAccount": { th: "ยังไม่มีบัญชี?", en: "Don't have an account?" },
  "login.register": { th: "สมัครสมาชิก", en: "Register" },
  "login.phoneOrEmail": {
    th: "เบอร์โทรศัพท์ หรือ อีเมล",
    en: "Phone Number or Email",
  },
  "login.phoneOrEmailPlaceholder": {
    th: "0812345678 หรือ your@email.com",
    en: "0812345678 or your@email.com",
  },

  // ── Forgot Password ────────────────────────────────────────────────────────
  "forgotPassword.title": { th: "ลืมรหัสผ่าน", en: "Forgot Password" },
  "forgotPassword.subtitle": {
    th: "กรอกเบอร์โทรศัพท์หรืออีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน",
    en: "Enter your phone number or email to receive a password reset link.",
  },
  "forgotPassword.usernameLabel": {
    th: "ชื่อผู้ใช้ (Username)",
    en: "Username",
  },
  "forgotPassword.usernamePlaceholder": {
    th: "กรอก username ของคุณ",
    en: "Enter your username",
  },
  "forgotPassword.submit": {
    th: "ส่งลิงก์รีเซ็ตรหัสผ่าน",
    en: "Send Reset Link",
  },
  "forgotPassword.backToLogin": {
    th: "กลับไปหน้าเข้าสู่ระบบ",
    en: "Back to Login",
  },
  "forgotPassword.linkExpiry": {
    th: "ลิงก์จะหมดอายุใน",
    en: "Link expires in",
  },
  "forgotPassword.minutes": { th: "นาที", en: "minutes" },

  // ── Reset Password ─────────────────────────────────────────────────────────
  "resetPassword.title": { th: "ตั้งรหัสผ่านใหม่", en: "Reset Password" },
  "resetPassword.subtitle": {
    th: "กรอกรหัสผ่านใหม่ที่ต้องการ",
    en: "Enter your new password",
  },
  "resetPassword.newPassword": { th: "รหัสผ่านใหม่", en: "New Password" },
  "resetPassword.confirmPassword": {
    th: "ยืนยันรหัสผ่านใหม่",
    en: "Confirm New Password",
  },
  "resetPassword.submit": { th: "ตั้งรหัสผ่านใหม่", en: "Set New Password" },
  "resetPassword.invalidLink": { th: "ลิงก์ไม่ถูกต้อง", en: "Invalid Link" },
  "resetPassword.invalidLinkDesc": {
    th: "ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง",
    en: "The reset link has expired or is invalid",
  },
  "resetPassword.requestNew": { th: "ขอลิงก์ใหม่", en: "Request New Link" },
  "resetPassword.success": {
    th: "เปลี่ยนรหัสผ่านสำเร็จ!",
    en: "Password changed successfully!",
  },
  "resetPassword.redirecting": {
    th: "กำลังพาคุณไปหน้าเข้าสู่ระบบ...",
    en: "Redirecting to login...",
  },
  "resetPassword.loginNow": { th: "เข้าสู่ระบบเลย", en: "Login Now" },

  // ── Forced password change (บัญชีที่ยังใช้รหัสผ่านตั้งต้นอยู่) ──────────────
  "forcePasswordChange.title": {
    th: "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน",
    en: "You must change your password",
  },
  "forcePasswordChange.subtitle": {
    th: "บัญชีนี้ยังใช้รหัสผ่านตั้งต้นอยู่ กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งานระบบ",
    en: "This account is still using its default password — set a new one before continuing",
  },
  "forcePasswordChange.currentPassword": {
    th: "รหัสผ่านตั้งต้น",
    en: "Default Password",
  },
  "forcePasswordChange.submit": { th: "เปลี่ยนรหัสผ่านและเข้าใช้งาน", en: "Change Password & Continue" },
  "forcePasswordChange.success": {
    th: "เปลี่ยนรหัสผ่านสำเร็จ กำลังเข้าสู่ระบบ...",
    en: "Password changed. Signing you in...",
  },

  // ── Password strength ──────────────────────────────────────────────────────
  "password.strength": { th: "ความแข็งแรง", en: "Strength" },
  "password.veryWeak": { th: "อ่อนมาก", en: "Very Weak" },
  "password.weak": { th: "อ่อน", en: "Weak" },
  "password.medium": { th: "ปานกลาง", en: "Medium" },
  "password.strong": { th: "แข็งแรง", en: "Strong" },
  "password.veryStrong": { th: "แข็งแรงมาก", en: "Very Strong" },
  "password.match": { th: "รหัสผ่านตรงกัน", en: "Passwords match" },
  "password.noMatch": { th: "รหัสผ่านไม่ตรงกัน", en: "Passwords do not match" },
  "password.minLength": {
    th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    en: "Password must be at least 6 characters",
  },

  // ── Status ─────────────────────────────────────────────────────────────────
  "status.active": { th: "ใช้งานอยู่", en: "Active" },
  "status.inactive": { th: "ไม่ใช้งาน", en: "Inactive" },
  "status.pending": { th: "รอดำเนินการ", en: "Pending" },
  "status.approved": { th: "อนุมัติแล้ว", en: "Approved" },
  "status.rejected": { th: "ไม่อนุมัติ", en: "Rejected" },
  "status.paid": { th: "ชำระแล้ว", en: "Paid" },
  "status.unpaid": { th: "ยังไม่ชำระ", en: "Unpaid" },
  "status.overdue": { th: "เกินกำหนด", en: "Overdue" },
  "status.cancelled": { th: "ยกเลิก", en: "Cancelled" },
  "status.expired": { th: "หมดอายุ", en: "Expired" },
  "status.terminated": { th: "ยกเลิกแล้ว", en: "Terminated" },
  "status.available": { th: "ว่าง", en: "Available" },
  "status.occupied": { th: "มีผู้เช่า", en: "Occupied" },
  "status.maintenance": { th: "ซ่อมบำรุง", en: "Maintenance" },
  "status.resolved": { th: "เสร็จสิ้น", en: "Resolved" },
  "status.in_progress": { th: "กำลังดำเนินการ", en: "In Progress" },
  "status.verified": { th: "ยืนยันแล้ว", en: "Verified" },
  "status.pending_verify": { th: "รอยืนยัน", en: "Pending Verify" },
  "status.active.label": { th: "ใช้งานอยู่", en: "Active" },
  "status.expired.label": { th: "หมดอายุ", en: "Expired" },
  "status.terminated.label": { th: "ยกเลิกแล้ว", en: "Terminated" },
  // Tenant status (สำหรับ TenantStatusBadge)
  "tenant.status.active": { th: "กำลังเช่า", en: "Active" },
  "tenant.status.pending": { th: "รอเข้าพัก", en: "Pending" },
  "tenant.status.moved_out": { th: "ย้ายออกแล้ว", en: "Moved Out" },

  // Priority urgent (ที่ขาด)
  "priority.urgent": { th: "เร่งด่วน", en: "Urgent" },

  // Status partial (ที่ขาด)
  "status.partial": { th: "ชำระบางส่วน", en: "Partial" },
  "status.reserved": { th: "จอง", en: "Reserved" },

  // ── Priority ───────────────────────────────────────────────────────────────
  "priority.low": { th: "ไม่ด่วน", en: "Low" },
  "priority.medium": { th: "ปกติ", en: "Medium" },
  "priority.high": { th: "ด่วน", en: "High" },

  // ── Sidebar / Menu ─────────────────────────────────────────────────────────
  "menu.dashboard": { th: "แดชบอร์ด", en: "Dashboard" },
  "menu.rooms": { th: "ห้องพัก", en: "Rooms" },
  "menu.tenants": { th: "ผู้เช่า", en: "Tenants" },
  "menu.contracts": { th: "สัญญาเช่า", en: "Contracts" },
  "menu.moveOut": { th: "คำร้องย้ายออก", en: "Move-out Requests" },
  "menu.meters": { th: "บันทึกมิเตอร์", en: "Meter Readings" },
  "menu.bills": { th: "บิล", en: "Bills" },
  "menu.payments": { th: "การชำระเงิน", en: "Payments" },
  "menu.deposits": { th: "เงินประกัน", en: "Deposits" },
  "menu.maintenance": { th: "แจ้งซ่อม", en: "Maintenance" },
  "menu.announcements": { th: "ประกาศ", en: "Announcements" },
  "menu.settings": { th: "ตั้งค่า", en: "Settings" },
  "menu.group.main": { th: "หลัก", en: "Main" },
  "menu.group.rooms": { th: "จัดการห้องพัก", en: "Room Management" },
  "menu.group.finance": { th: "การเงิน", en: "Finance" },
  "menu.group.other": { th: "อื่นๆ", en: "Others" },
  "menu.more": { th: "เพิ่มเติม", en: "More" },

  // ── Rooms ──────────────────────────────────────────────────────────────────
  "rooms.title": { th: "จัดการห้องพัก", en: "Room Management" },
  "rooms.subtitle": {
    th: "จัดการห้องพักทั้งหมดในระบบ",
    en: "Manage all rooms in the system",
  },
  "rooms.add": { th: "เพิ่มห้อง", en: "Add Room" },
  "rooms.roomNumber": { th: "หมายเลขห้อง", en: "Room Number" },
  "rooms.floor": { th: "ชั้น", en: "Floor" },
  "rooms.type": { th: "ประเภทห้อง", en: "Room Type" },
  "rooms.area": { th: "พื้นที่ (ตร.ม.)", en: "Area (sqm)" },
  "rooms.rent": { th: "ค่าเช่า/เดือน", en: "Rent/Month" },
  "rooms.list": { th: "รายการห้องพัก", en: "Room List" },
  "rooms.fanRoom": { th: "ห้องพัดลม", en: "Fan Room" },
  "rooms.airConditionedRoom": { th: "ห้องแอร์", en: "Air-conditioned Room" },
  "rooms.searchPlaceholder": {
    th: "ค้นหาหมายเลขห้อง...",
    en: "Search room number...",
  },
  "rooms.sqm": { th: "ตร.ม.", en: "sqm" },
  "rooms.cannotDeleteOccupied": {
    th: "ไม่สามารถลบห้องที่มีผู้เช่า",
    en: "Cannot delete an occupied room",
  },

  // ── Tenants ────────────────────────────────────────────────────────────────
  "tenants.title": { th: "จัดการผู้เช่า", en: "Tenant Management" },
  "tenants.subtitle": {
    th: "จัดการข้อมูลผู้เช่าทั้งหมด",
    en: "Manage all tenant information",
  },

  "tenants.add": { th: "เพิ่มผู้เช่า", en: "Add Tenant" },
  "tenants.addNew": { th: "เพิ่มผู้เช่าใหม่", en: "Add New Tenant" },
  "tenants.addDesc": {
    th: "กรอกข้อมูลผู้เช่าใหม่ — ระบบจะใช้เบอร์โทรศัพท์เป็นชื่อผู้ใช้สำหรับเข้าสู่ระบบโดยอัตโนมัติ",
    en: "Fill in the new tenant's details — the phone number will automatically be used as their login username.",
  },
  "tenants.edit": { th: "แก้ไขข้อมูลผู้เช่า", en: "Edit Tenant" },
  "tenants.editDesc": {
    th: "แก้ไขข้อมูลของผู้เช่ารายนี้",
    en: "Edit this tenant's information",
  },
  "tenants.idCard": { th: "เลขบัตรประชาชน", en: "ID Card Number" },
  "tenants.emergencyName": { th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency Contact" },
  "tenants.emergencyPhone": { th: "เบอร์ติดต่อฉุกเฉิน", en: "Emergency Phone" },
  "tenants.list": { th: "รายการผู้เช่า", en: "Tenant List" },
  "tenants.searchPlaceholder": {
    th: "ค้นหาชื่อ อีเมล เบอร์โทร หรือเลขบัตรประชาชน",
    en: "Search name, email, phone or ID card",
  },
  "tenants.hasContract": { th: "มีสัญญา", en: "Has Contract" },
  "tenants.noContract": { th: "ยังไม่มีสัญญา", en: "No Contract" },
  "tenants.contractStatus": { th: "สถานะสัญญา", en: "Contract Status" },
  "tenants.deleted": { th: "ถูกลบแล้ว", en: "Deactivated" },
  "tenants.viewCurrent": { th: "ดูผู้เช่าปัจจุบัน", en: "View Current" },
  "tenants.viewHistory": { th: "ดูผู้เช่าเก่า", en: "View History" },
  "tenants.cannotDeleteActive": {
    th: "ไม่สามารถลบผู้เช่าที่มีสัญญากำลังใช้งานอยู่ได้",
    en: "Cannot delete a tenant with an active contract",
  },
  "tenants.checkFormErrors": {
    th: "กรุณาตรวจสอบข้อมูลที่กรอก",
    en: "Please check the information you entered",
  },
  "tenants.usernameNote": {
    th: "ระบบจะใช้เบอร์โทรศัพท์เป็นชื่อผู้ใช้สำหรับเข้าสู่ระบบโดยอัตโนมัติ",
    en: "The phone number will be used as the login username automatically.",
  },
  "tenants.generatePassword": { th: "สุ่มรหัสผ่าน", en: "Generate password" },
  "tenants.firstName": { th: "ชื่อ", en: "First Name" },
  "tenants.lastName": { th: "นามสกุล", en: "Last Name" },
  "tenants.emergency": { th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency Contact" },
  "tenants.username": { th: "ชื่อผู้ใช้ (Login)", en: "Username (Login)" },
  "tenants.password": { th: "รหัสผ่าน", en: "Password" },

  "errors.PHONE_REQUIRED": {
    th: "กรุณากรอกเบอร์โทรศัพท์",
    en: "Phone number is required",
  },
  "errors.PHONE_FORMAT": {
    th: "เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)",
    en: "Invalid phone number (must start with 0, 9-10 digits)",
  },
  "errors.EMERGENCY_PHONE_FORMAT": {
    th: "เบอร์ติดต่อฉุกเฉินไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)",
    en: "Invalid emergency contact number (must start with 0, 9-10 digits)",
  },
  "errors.ID_CARD_LENGTH": {
    th: "เลขบัตรประชาชนต้องมี 13 หลัก",
    en: "ID card number must be 13 digits",
  },
  "errors.EMAIL_FORMAT": {
    th: "รูปแบบอีเมลไม่ถูกต้อง",
    en: "Invalid email format",
  },
  "errors.FIRST_NAME_REQUIRED": {
    th: "กรุณากรอกชื่อ",
    en: "First name is required",
  },
  "errors.LAST_NAME_REQUIRED": {
    th: "กรุณากรอกนามสกุล",
    en: "Last name is required",
  },
  "errors.USERNAME_LENGTH": {
    th: "ชื่อผู้ใช้ต้องมี 3-50 ตัวอักษร",
    en: "Username must be 3-50 characters",
  },
  "errors.USERNAME_FORMAT": {
    th: "ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _",
    en: "Username can only contain letters, numbers, and underscore",
  },
  "errors.PASSWORD_MIN_LENGTH": {
    th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    en: "Password must be at least 6 characters",
  },
  "errors.FIRST_NAME_TOO_LONG": {
    th: "ชื่อยาวเกินไป",
    en: "First name is too long",
  },
  "errors.LAST_NAME_TOO_LONG": {
    th: "นามสกุลยาวเกินไป",
    en: "Last name is too long",
  },
  "errors.ID_CARD_FORMAT": {
    th: "เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น",
    en: "ID card number must contain digits only",
  },
  "errors.EMERGENCY_NAME_TOO_LONG": {
    th: "ชื่อผู้ติดต่อฉุกเฉินยาวเกินไป",
    en: "Emergency contact name is too long",
  },
  "errors.PHONE_ALREADY_REGISTERED": {
    th: "เบอร์โทรศัพท์นี้มีบัญชีอยู่ในระบบแล้ว",
    en: "This phone number is already registered",
  },
  "errors.EMAIL_ALREADY_REGISTERED": {
    th: "อีเมลนี้มีบัญชีอยู่ในระบบแล้ว",
    en: "This email is already registered",
  },
  "errors.ID_CARD_ALREADY_REGISTERED": {
    th: "เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว",
    en: "This ID card number is already registered",
  },
  "errors.PHONE_EMAIL_CONFLICT_DIFFERENT_TENANTS": {
    th: "เบอร์โทรและอีเมลผูกกับผู้เช่าคนละคน กรุณาตรวจสอบข้อมูล",
    en: "Phone and email belong to different tenants — please check the data",
  },

  // ── Contracts ──────────────────────────────────────────────────────────────
  "contracts.title": { th: "สัญญาเช่า", en: "Rental Contracts" },
  "contracts.subtitle": {
    th: "จัดการสัญญาเช่าและเงินประกัน",
    en: "Manage rental contracts and deposits",
  },
  "contracts.new": { th: "สัญญาใหม่", en: "New Contract" },
  "contracts.startDate": { th: "วันเริ่มต้น", en: "Start Date" },
  "contracts.endDate": { th: "วันสิ้นสุด", en: "End Date" },
  "contracts.rentAmount": { th: "ค่าเช่า/เดือน", en: "Rent/Month" },
  "contracts.deposit": { th: "เงินประกัน", en: "Deposit" },
  "contracts.totalDeposit": { th: "รวมเงินประกัน", en: "Total Deposit" },
  "contracts.terminate": { th: "ยกเลิกสัญญา", en: "Terminate Contract" },
  "contracts.checkout": { th: "Check-out", en: "Check-out" },
  "contracts.searchPlaceholder": {
    th: "ค้นหา ชื่อ ห้อง หรือ ID...",
    en: "Search name, room or ID...",
  },
  "contracts.newTitle": { th: "สร้างสัญญาเช่าใหม่", en: "Create New Contract" },
  "contracts.newDesc": {
    th: "กรอกข้อมูลสัญญาเช่า",
    en: "Fill in contract details",
  },
  "contracts.tenant": { th: "ผู้เช่า", en: "Tenant" },
  "contracts.selectTenant": { th: "เลือกผู้เช่า", en: "Select tenant" },
  "contracts.availableRoom": {
    th: "ห้องพัก (ว่างอยู่)",
    en: "Room (Available)",
  },
  "contracts.selectRoom": { th: "เลือกห้อง", en: "Select room" },
  "contracts.rentAmountBaht": {
    th: "ค่าเช่า/เดือน (บาท)",
    en: "Rent/Month (THB)",
  },
  "contracts.useRoomRent": { th: "ใช้ค่าเช่าจากห้อง", en: "Use room's rent" },
  "contracts.depositBaht": { th: "เงินประกัน (บาท)", en: "Deposit (THB)" },
  "contracts.noteExtra": { th: "หมายเหตุเพิ่มเติม", en: "Additional note" },
  "contracts.create": { th: "สร้างสัญญา", en: "Create Contract" },
  "contracts.statsTotal": { th: "รวมทั้งหมด", en: "Total" },
  "contracts.statsActive": { th: "ใช้งานอยู่", en: "Active" },
  "contracts.statsExpiredOrTerminated": {
    th: "หมดอายุ/ยกเลิก",
    en: "Expired/Terminated",
  },
  "contracts.statsTotalDeposit": { th: "รวมเงินประกัน", en: "Total Deposit" },
  "contracts.notFound": { th: "ไม่พบสัญญาเช่า", en: "No contracts found" },
  "contracts.detailTitle": {
    th: "รายละเอียดสัญญาเช่า",
    en: "Contract Details",
  },
  "contracts.tenantName": { th: "ชื่อผู้เช่า", en: "Tenant Name" },
  "contracts.room": { th: "ห้อง", en: "Room" },
  "contracts.monthlyRent": { th: "ค่าเช่ารายเดือน", en: "Monthly Rent" },
  "contracts.terminateAction": {
    th: "ยกเลิกสัญญา (Check-out)",
    en: "Terminate Contract (Check-out)",
  },
  "contracts.rentLabel": { th: "ค่าเช่า", en: "Rent" },
  "contracts.depositLabel": { th: "เงินประกัน", en: "Deposit" },
  "contracts.baht": { th: "บาท", en: "THB" },
  "contracts.perMonth": { th: "บาท/เดือน", en: "THB/month" },
  "contracts.confirmTerminate": {
    th: "ต้องการยกเลิกสัญญาของ",
    en: "Confirm termination of contract for",
  },
  "contracts.confirmTerminate2": { th: "ห้อง", en: "room" },
  "contracts.confirmTerminate3": { th: "หรือไม่?", en: "?" },
  "contracts.loadError": {
    th: "โหลดข้อมูลสัญญาไม่สำเร็จ",
    en: "Failed to load contracts",
  },
  "contracts.createSuccess": {
    th: "สร้างสัญญาเรียบร้อย",
    en: "Contract created successfully",
  },
  "contracts.createError": {
    th: "สร้างสัญญาไม่สำเร็จ",
    en: "Failed to create contract",
  },
  "contracts.terminateSuccess": {
    th: "ยกเลิกสัญญาเรียบร้อย",
    en: "Contract terminated successfully",
  },
  "contracts.terminateError": {
    th: "ยกเลิกสัญญาไม่สำเร็จ",
    en: "Failed to terminate contract",
  },
  "contracts.renewAction": {
    th: "ต่อสัญญา",
    en: "Renew Contract",
  },
  "contracts.renewTitle": {
    th: "ต่อสัญญาเช่า",
    en: "Renew Lease Contract",
  },
  "contracts.newEndDate": {
    th: "วันหมดอายุสัญญาใหม่",
    en: "New Contract End Date",
  },
  "contracts.renewConfirm": {
    th: "ยืนยันต่อสัญญา",
    en: "Confirm Renewal",
  },
  "contracts.renewSuccess": {
    th: "ต่อสัญญาสำเร็จ",
    en: "Contract renewed successfully",
  },
  "contracts.renewError": {
    th: "ไม่สามารถต่อสัญญาได้",
    en: "Failed to renew contract",
  },
  "contracts.moveOutAction": {
    th: "ทำเรื่องย้ายออก",
    en: "Process Move-out",
  },
  "contracts.moveOutTitle": {
    th: "ทำเรื่องย้ายออก / เคลียร์ห้อง",
    en: "Move-out / Clear Room",
  },
  "contracts.moveOutDate": {
    th: "วันที่ย้ายออก (เช็คเอาท์)",
    en: "Move-out (Checkout) Date",
  },
  "contracts.moveOutConfirm": {
    th: "ยืนยันย้ายออก",
    en: "Confirm Move-out",
  },
  "contracts.checkoutDepositNote": {
    th: "ระบบจะคำนวณเงินมัดจำคืนให้อัตโนมัติ หากเช็คเอาท์หลังวันหมดสัญญาจะไม่มีค่าปรับ",
    en: "The deposit refund will be calculated automatically. No penalty applies if checkout is after the contract end date.",
  },
  "contracts.checkoutSuccess": {
    th: "ทำเรื่องย้ายออกสำเร็จ",
    en: "Move-out processed successfully",
  },
  "contracts.checkoutError": {
    th: "ไม่สามารถทำเรื่องย้ายออกได้",
    en: "Failed to process move-out",
  },
  "contracts.statsTotalRefunded": {
    th: "เงินประกันที่คืนแล้ว",
    en: "Deposits Refunded",
  },

  // ── Bills ──────────────────────────────────────────────────────────────────
  "bills.title": { th: "จัดการบิล", en: "Bill Management" },
  "bills.subtitle": {
    th: "สร้างและจัดการบิลค่าเช่า",
    en: "Create and manage rental bills",
  },
  "bills.generate": { th: "สร้างบิล", en: "Generate Bill" },
  "bills.month": { th: "เดือน", en: "Month" },
  "bills.year": { th: "ปี", en: "Year" },
  "bills.dueDate": { th: "กำหนดชำระ", en: "Due Date" },
  "bills.rentAmount": { th: "ค่าเช่า", en: "Rent" },
  "bills.electricAmount": { th: "ค่าไฟฟ้า", en: "Electric" },
  "bills.waterAmount": { th: "ค่าน้ำ", en: "Water" },
  "bills.otherAmount": { th: "ค่าอื่นๆ", en: "Other" },
  "bills.outstandingAmount": { th: "ยอดค้างชำระ", en: "Outstanding Amount" },
  "bills.list": { th: "รายการบิล", en: "Bill List" },
  "bills.cancelBill": { th: "ยกเลิกบิล", en: "Cancel Bill" },
  "bills.detail": { th: "รายละเอียดบิล", en: "Bill Detail" },
  "bills.searchPlaceholder": {
    th: "ค้นหาหมายเลขห้อง หรือชื่อผู้เช่า...",
    en: "Search room or tenant...",
  },
  "bills.exportInvoice": {
    th: "ดาวน์โหลดใบเสร็จ",
    en: "Download Receipt",
  },
  "bills.totalAmount": {
    th: "ยอดเงินรวม",
    en: "Total Amount",
  },

  // ── Bill Errors ─────────────────────────────────────────────────────────
  "bills.error.alreadyExists": {
    th: "มีบิลเดือนนี้แล้ว",
    en: "Bill already exists for this month",
  },
  "bills.error.noContract": {
    th: "ห้องนี้ยังไม่มีสัญญาเช่า",
    en: "No active contract for this room",
  },
  "bills.error.noElectricMeter": {
    th: "กรุณาบันทึกมิเตอร์ไฟก่อนสร้างบิล",
    en: "Electric meter reading not found",
  },
  "bills.error.noWaterMeter": {
    th: "กรุณาบันทึกมิเตอร์น้ำก่อนสร้างบิล",
    en: "Water meter reading not found",
  },
  "bills.error.meterHint": {
    th: "กรุณาบันทึกมิเตอร์ก่อนสร้างบิล",
    en: "Please record meter readings before generating the bill",
  },

  // ── Payments (admin shared) ────────────────────────────────────────────────
  "payment.loadError": { th: "โหลดข้อมูลไม่สำเร็จ", en: "Failed to load data" },
  "payment.actionError": { th: "เกิดข้อผิดพลาด", en: "An error occurred" },
  "payment.error.alreadyPaid": {
    th: "บิลนี้ชำระแล้ว",
    en: "This bill has already been paid",
  },
  "payment.error.cancelled": {
    th: "บิลนี้ถูกยกเลิกแล้ว",
    en: "This bill has been cancelled",
  },
  "payment.error.pendingVerify": {
    th: "มีสลิปรอตรวจสอบอยู่แล้ว กรุณารอแอดมินตรวจสอบก่อน",
    en: "A slip is already pending verification. Please wait for admin to review.",
  },
  "payment.error.notYours": {
    th: "บิลนี้ไม่ใช่ของคุณ",
    en: "This bill does not belong to you",
  },
  "payment.error.billNotFound": {
    th: "ไม่พบบิลนี้",
    en: "Bill not found",
  },
  "payment.error.slipRequired": {
    th: "กรุณาแนบรูปสลิปการโอนเงิน",
    en: "Please attach a payment slip",
  },

  "payment.success.submitted": {
    th: "ส่งสลิปสำเร็จ รอแอดมินตรวจสอบ",
    en: "Slip submitted. Awaiting admin verification.",
  },
  "payment.searchPlaceholder": {
    th: "ค้นหา ชื่อ ห้อง บิล หรือ ID...",
    en: "Search name, room, bill or ID...",
  },
  "payment.billNo": { th: "บิล", en: "Bill" },
  "payment.method": { th: "วิธีชำระ", en: "Payment Method" },
  "payment.allMethods": {
    th: "วิธีทั้งหมด",
    en: "All Methods",
  },
  "payment.methodQR": { th: "พร้อมเพย์", en: "PromptPay" },
  "payment.methodCash": { th: "เงินสด", en: "Cash" },
  "payment.methodTransfer": { th: "โอนเงิน", en: "Bank Transfer" },
  "payment.paidOn": { th: "ชำระ", en: "Paid" },
  "payment.paidDate": { th: "วันที่ชำระ", en: "Paid Date" },
  "payment.approvedOn": { th: "อนุมัติ", en: "Approved" },
  "payment.rejectedOn": { th: "ปฏิเสธเมื่อ", en: "Rejected on" },
  "payment.approvedBy": { th: "อนุมัติโดย", en: "Approved by" },
  "payment.processedBy": { th: "ดำเนินการโดย", en: "Processed by" },
  "payment.slip": { th: "รูปสลิป", en: "Slip Image" },
  "payment.noSlip": { th: "ไม่มีสลิป", en: "No slip" },
  "payment.viewFullImage": { th: "ดูรูปขนาดเต็ม", en: "View full image" },
  "payment.detailTitle": { th: "รายละเอียดการชำระเงิน", en: "Payment Details" },
  "payment.approveSuccess": {
    th: "อนุมัติการชำระเงินเรียบร้อย",
    en: "Payment approved successfully",
  },
  "payment.rejectSuccess": {
    th: "ปฏิเสธการชำระเงินแล้ว",
    en: "Payment rejected",
  },
  "payment.reject": { th: "ปฏิเสธ", en: "Reject" },
  "payment.rejectDialogTitle": {
    th: "ปฏิเสธการชำระเงิน",
    en: "Reject Payment",
  },
  "payment.rejectDialogDesc": {
    th: "ระบุเหตุผลในการปฏิเสธ",
    en: "Specify the reason for rejection",
  },
  "payment.rejectReason": { th: "เหตุผล", en: "Reason" },
  "payment.rejectReasonRequired": {
    th: "กรุณาระบุเหตุผล",
    en: "Please enter a reason",
  },
  "payment.rejectReasonPlaceholder": {
    th: "เช่น จำนวนเงินไม่ตรง, สลิปไม่ชัดเจน ฯลฯ",
    en: "e.g. Amount mismatch, slip unclear, etc.",
  },
  "payment.confirmReject": { th: "ยืนยันการปฏิเสธ", en: "Confirm Rejection" },
  "payment.exportSuccess": {
    th: "ส่งออก {fmt} เรียบร้อย",
    en: "Exported {fmt} successfully",
  },
  "payment.exportError": { th: "ส่งออกไม่สำเร็จ", en: "Export failed" },

  // ── Payments (tenant) — ✅ เพิ่มใหม่ ──────────────────────────────────────
  "payments.title": { th: "การชำระเงิน", en: "Payments" },
  "payments.subtitle": {
    th: "รายการชำระเงินทั้งหมดในระบบ",
    en: "All payment records in the system",
  },
  "payments.totalDue": { th: "ยอดค้างชำระ", en: "Total Due" },
  "payments.qr": { th: "QR PromptPay", en: "QR PromptPay" },
  "payments.slip": { th: "อัปโหลดสลิป", en: "Upload Slip" },
  "payments.history": { th: "ประวัติการชำระเงิน", en: "Payment History" },

  // ── Payment History ────────────────────────────────────────────────────────
  "paymentHistory.title": { th: "ประวัติการชำระเงิน", en: "Payment History" },
  "paymentHistory.subtitle": {
    th: "รายการชำระเงินที่ผ่านการอนุมัติแล้ว",
    en: "Verified payment records",
  },
  "paymentHistory.statsMonthly": { th: "รายการเดือนนี้", en: "This Month" },
  "paymentHistory.statsRevenue": {
    th: "รายรับเดือนนี้",
    en: "Revenue This Month",
  },
  "paymentHistory.statsAll": { th: "ทั้งหมดในระบบ", en: "Total in System" },
  "paymentHistory.notFound": { th: "ไม่พบรายการใน", en: "No records in" },
  "paymentHistory.includeRejected": {
    th: "รวมรายการที่ถูกปฏิเสธ",
    en: "Include rejected",
  },
  "paymentHistory.totalIncludesRejected": {
    th: "รวมรายการทั้งหมด",
    en: "Total (includes rejected)",
  },
  "paymentHistory.totalExcludesRejected": {
    th: "ไม่รวมรายการที่ถูกปฏิเสธ",
    en: "Total (excludes rejected)",
  },
  "paymentHistory.countIncludesRejected": {
    th: "รวมทุกสถานะ",
    en: "Count (includes rejected)",
  },
  "paymentHistory.countExcludesRejected": {
    th: "ไม่รวมรายการที่ถูกปฏิเสธ",
    en: "Count (excludes rejected)",
  },

  // ── Payment Verification ───────────────────────────────────────────────────
  "paymentVerify.title": {
    th: "ตรวจสอบการชำระเงิน",
    en: "Payment Verification",
  },
  "paymentVerify.subtitle": {
    th: "ตรวจสอบและอนุมัติการชำระเงินจากสลิป",
    en: "Review and approve payments from slips",
  },
  "paymentVerify.statsTotal": { th: "รวมทั้งหมด", en: "Total" },
  "paymentVerify.statsPending": { th: "รอการตรวจสอบ", en: "Pending Review" },
  "paymentVerify.statsVerified": { th: "ตรวจสอบแล้ว", en: "Verified" },
  "paymentVerify.statsRejected": { th: "ปฏิเสธ", en: "Rejected" },
  "payment.exportUnverifiedWarning": {
    th: "รายการที่ export รวมสถานะที่ยังไม่ตรวจสอบ/ถูกปฏิเสธด้วย แนะนำกรองเฉพาะ 'ชำระแล้ว' ก่อน export เพื่อความถูกต้องทางบัญชี",
    en: "Export includes unverified/rejected items. Filter to 'Verified' only before exporting for accurate accounting.",
  },

  "payment.list": { th: "รายการชำระเงิน", en: "payments" },
  "payment.exportExcel": {
    th: "ส่งออกข้อมูลการชำระเงิน",
    en: "Export Payment Data",
  },

  // ── Maintenance ────────────────────────────────────────────────────────────
  "maintenance.title": { th: "จัดการแจ้งซ่อม", en: "Maintenance Management" },
  "maintenance.subtitle": {
    th: "รับและจัดการคำขอซ่อมแซมจากผู้เช่า",
    en: "Receive and manage repair requests from tenants",
  },
  "maintenance.allStatuses": { th: "สถานะทั้งหมด", en: "All Statuses" },
  "maintenance.searchPlaceholder": {
    th: "ค้นหาหมายเลขห้อง, หมวดหมู่ หรือชื่อผู้เช่า...",
    en: "Search room, category or tenant...",
  },
  "maintenance.pendingAlert": {
    th: "มี {n} รายการที่รอดำเนินการ",
    en: "{n} items pending action",
  },
  "maintenance.list": { th: "รายการแจ้งซ่อม", en: "Maintenance List" },

  "maintenance.totalItems": {
    th: "ทั้งหมด {n} รายการ",
    en: "{n} records total",
  },
  "maintenance.pending": {
    th: "รายการแจ้งซ่อมที่รอดำเนินการ",
    en: "Pending Maintenance",
  },

  "maintenance.colReporter": { th: "ผู้แจ้ง", en: "Reporter" },
  "maintenance.colCategory": { th: "หมวดหมู่", en: "Category" },
  "maintenance.colPriority": { th: "ความสำคัญ", en: "Priority" },
  "maintenance.colReportedAt": { th: "แจ้งเมื่อ", en: "Reported At" },
  "maintenance.notFound": {
    th: "ไม่พบรายการแจ้งซ่อมที่ตรงกับการค้นหา",
    en: "No maintenance requests found",
  },
  "maintenance.detailTitle": {
    th: "รายละเอียดการแจ้งซ่อม",
    en: "Maintenance Request Details",
  },
  "maintenance.detailDesc": {
    th: "ดูรายละเอียดและอัปเดตสถานะ",
    en: "View details and update status",
  },
  "maintenance.description": { th: "รายละเอียด", en: "Description" },
  "maintenance.assignedTo": { th: "มอบหมายให้", en: "Assigned To" },
  "maintenance.assignedPlaceholder": {
    th: "ชื่อช่างหรือผู้รับผิดชอบ",
    en: "Technician or responsible person",
  },
  "maintenance.notePlaceholder": {
    th: "บันทึกเพิ่มเติม...",
    en: "Additional notes...",
  },
  "maintenance.adminNote": { th: "หมายเหตุแอดมิน", en: "Admin Note" },
  "maintenance.updateSuccess": {
    th: "อัปเดตรายการแจ้งซ่อมเรียบร้อย",
    en: "Maintenance request updated successfully",
  },
  "maintenance.updateError": { th: "อัปเดตไม่สำเร็จ", en: "Failed to update" },
  "maintenance.loadError": {
    th: "โหลดข้อมูลไม่สำเร็จ",
    en: "Failed to load data",
  },
  "maintenance.image": { th: "รูปภาพ", en: "Image" },

  // ── Announcements ──────────────────────────────────────────────────────────
  "announcements.title": { th: "ประกาศข่าวสาร", en: "Announcements" },
  "announcements.subtitle": {
    th: "สร้างและจัดการประกาศสำหรับผู้เช่า",
    en: "Create and manage announcements for tenants",
  },
  "announcements.create": { th: "สร้างประกาศ", en: "Create Announcement" },
  "announcements.titleField": { th: "หัวข้อประกาศ", en: "Announcement Title" },
  "announcements.content": { th: "เนื้อหา", en: "Content" },
  "announcements.audience": { th: "กลุ่มเป้าหมาย", en: "Target Audience" },
  "announcements.pinned": { th: "ปักหมุด", en: "Pinned" },
  "announcements.expires": { th: "วันหมดอายุ", en: "Expiry Date" },
  "announcements.everyone": { th: "ทุกคน", en: "Everyone" },
  "announcements.tenantOnly": { th: "ผู้เช่าเท่านั้น", en: "Tenants Only" },
  "announcements.adminOnly": { th: "แอดมินเท่านั้น", en: "Admin Only" },
  "announcements.important": {
    th: "ประกาศสำคัญ",
    en: "Important Announcements",
  },
  "announcements.others": { th: "ประกาศอื่น", en: "Other Announcements" },
  "announcements.empty": { th: "ยังไม่มีประกาศ", en: "No announcements yet" },
  "announcements.floor": {
    th: "ส่งเฉพาะชั้น (ไม่บังคับ)",
    en: "Target floor (optional)",
  },
  "announcements.floorPlaceholder": {
    th: "เว้นว่าง = ส่งทุกชั้น",
    en: "Leave blank to send to all floors",
  },
  "announcements.sendViaTelegram": {
    th: "ส่งประกาศผ่าน Telegram",
    en: "Send via Telegram",
  },
  "announcements.floorBadge": { th: "ชั้น", en: "Floor" },
  "announcements.createNew": {
    th: "สร้างประกาศใหม่",
    en: "Create new announcement",
  },
  "announcements.created": {
    th: "สร้างประกาศสำเร็จ",
    en: "Announcement created successfully",
  },
  "announcements.updated": {
    th: "แก้ไขประกาศสำเร็จ",
    en: "Announcement updated successfully",
  },
  "announcements.urgent": { th: "ประกาศฉุกเฉิน", en: "Urgent Announcement" },
  "announcements.urgentDesc": {
    th: "ส่งถึงผู้เช่าทุกคนเสมอ แม้ผู้เช่าจะปิดการแจ้งเตือนประกาศไว้",
    en: "Always delivered to all tenants, even if they've muted general announcements",
  },
  "announcements.urgentBadge": { th: "ฉุกเฉิน", en: "URGENT" },
  "announcements.edit": { th: "แก้ไขประกาศ", en: "Edit Announcement" },
  "announcements.confirmDelete": {
    th: "ยืนยันการลบประกาศ",
    en: "Confirm delete announcement",
  },
  "announcements.deleted": {
    th: "ลบประกาศสำเร็จ",
    en: "Announcement deleted successfully",
  },
  "announcements.titlePlaceholder": {
    th: "เช่น แจ้งซ่อมลิฟต์ชั่วคราว",
    en: "e.g., Temporary elevator maintenance",
  },
  "announcements.contentPlaceholder": {
    th: "รายละเอียดประกาศ...",
    en: "Announcement details...",
  },
  "announcements.audienceSection": {
    th: "กลุ่มเป้าหมายและการเข้าถึง",
    en: "Target Audience & Reach",
  },
  "announcements.prioritySection": {
    th: "ความสำคัญและระยะเวลา",
    en: "Priority & Duration",
  },
  "announcements.pinTitle": { th: "ปักหมุดไว้บนสุด", en: "Pin to top" },
  "announcements.pinDesc": {
    th: 'แสดงในหัวข้อ "ประกาศสำคัญ" ของผู้เช่า',
    en: 'Shows under the "Important Announcements" section for tenants',
  },
  "announcements.optional": { th: "(ไม่บังคับ)", en: "(Optional)" },
  "announcements.formTab": { th: "ข้อมูลประกาศ", en: "Announcement Info" },
  "announcements.telegramPreviewTab": {
    th: "ตัวอย่าง Telegram",
    en: "Telegram Preview",
  },
  "announcements.telegramPreviewDesc": {
    th: "ตัวอย่างข้อความที่ผู้เช่าจะเห็นใน Telegram",
    en: "Preview of the message tenants will see in Telegram",
  },
  "announcements.previewTitlePlaceholder": {
    th: "หัวข้อประกาศจะแสดงตรงนี้",
    en: "Announcement title will appear here",
  },
  "announcements.previewContentPlaceholder": {
    th: "เนื้อหาประกาศจะแสดงตรงนี้",
    en: "Announcement content will appear here",
  },
  "announcements.fromDorm": {
    th: "ประกาศจากหอพัก",
    en: "Dormitory Announcement",
  },
  "announcements.telegramMuteWarning": {
    th: 'ผู้เช่าที่ปิดการแจ้งเตือน "ประกาศทั่วไป" ไว้จะไม่ได้รับข้อความนี้ ยกเว้นติ๊ก',
    en: 'Tenants who muted "General Announcements" will not receive this message unless you check',
  },
  "announcements.telegramMuteWarningTail": {
    th: "ซึ่งจะส่งถึงทุกคนเสมอ",
    en: "which is always sent to everyone.",
  },

  // ── Meters ─────────────────────────────────────────────────────────────────
  "meters.title": { th: "บันทึกมิเตอร์", en: "Meter Readings" },
  "meters.subtitle": {
    th: "บันทึกค่ามิเตอร์ไฟฟ้าและน้ำประปา",
    en: "Record electric and water meter readings",
  },
  "meters.addBtn": { th: "บันทึกมิเตอร์", en: "Record Meter" },
  "meters.searchPlaceholder": {
    th: "ค้นหาหมายเลขห้อง...",
    en: "Search room number...",
  },
  "meters.allMonths": { th: "เดือนทั้งหมด", en: "All Months" },
  "meters.listTitle": { th: "รายการมิเตอร์", en: "Meter List" },
  "meters.totalItems": { th: "ทั้งหมด {n} รายการ", en: "{n} records total" },
  "meters.colRoom": { th: "ห้อง", en: "Room" },
  "meters.colMonthYear": { th: "เดือน/ปี", en: "Month/Year" },
  "meters.colElectric": { th: "ไฟฟ้า (หน่วย)", en: "Electric (units)" },
  "meters.colWater": { th: "น้ำ (หน่วย)", en: "Water (units)" },
  "meters.colRecordedAt": { th: "บันทึกเมื่อ", en: "Recorded At" },
  "meters.notFound": {
    th: "ไม่พบรายการมิเตอร์",
    en: "No meter readings found",
  },
  "meters.viewPhotos": { th: "ดูรูปภาพ", en: "View Photos" },
  "meters.addTitle": { th: "บันทึกมิเตอร์ใหม่", en: "New Meter Reading" },
  "meters.editTitle": { th: "แก้ไขมิเตอร์", en: "Edit Meter Reading" },
  "meters.dialogDesc": {
    th: "กรอกค่ามิเตอร์ไฟฟ้าและน้ำประปา",
    en: "Enter electric and water meter values",
  },
  "meters.electricMeter": { th: "มิเตอร์ไฟฟ้า", en: "Electric Meter" },
  "meters.waterMeter": { th: "มิเตอร์น้ำ", en: "Water Meter" },
  "meters.rate": { th: "อัตรา", en: "Rate" },
  "meters.bahtPerUnit": { th: "บาท/หน่วย", en: "THB/unit" },
  "meters.previousUnit": { th: "เลขก่อนหน้า", en: "Previous Reading" },
  "meters.currentUnit": { th: "เลขปัจจุบัน", en: "Current Reading" },
  "meters.elecPhotoLabel": {
    th: "รูปมิเตอร์ไฟฟ้า (ไม่บังคับ)",
    en: "Electric Meter Photo (optional)",
  },
  "meters.waterPhotoLabel": {
    th: "รูปมิเตอร์น้ำ (ไม่บังคับ)",
    en: "Water Meter Photo (optional)",
  },
  "meters.uploadElecPhoto": {
    th: "อัปโหลดรูปมิเตอร์ไฟฟ้า",
    en: "Upload Electric Meter Photo",
  },
  "meters.uploadWaterPhoto": {
    th: "อัปโหลดรูปมิเตอร์น้ำ",
    en: "Upload Water Meter Photo",
  },
  "meters.noPhoto": { th: "ไม่มีรูป", en: "No photo" },
  "meters.flatRate": { th: "เหมาจ่าย", en: "Flat Rate" },
  "meters.flatRateDesc": {
    th: "ค่าน้ำเหมาจ่ายเดือนละ",
    en: "Flat water rate per month:",
  },
  "meters.perMonth": { th: "บาท/เดือน", en: "THB/month" },
  "meters.flatRateNoMeter": {
    th: "ไม่ต้องบันทึกมิเตอร์น้ำ ระบบจะใช้ค่าเหมาจ่ายอัตโนมัติ",
    en: "No water meter recording needed. The system will use the flat rate automatically.",
  },
  "meters.photoDialogTitle": {
    th: "รูปมิเตอร์ห้อง",
    en: "Meter Photos — Room",
  },
  "meters.errorSelectRoom": {
    th: "กรุณาเลือกห้อง",
    en: "Please select a room",
  },
  "meters.errorAtLeastOne": {
    th: "กรุณากรอกค่ามิเตอร์อย่างน้อย 1 ประเภท",
    en: "Please enter at least one meter reading",
  },
  "meters.errorElecOrder": {
    th: "ไฟฟ้า: ค่าปัจจุบันต้องมากกว่าก่อนหน้า",
    en: "Electric: current must be greater than previous",
  },
  "meters.errorWaterOrder": {
    th: "น้ำ: ค่าปัจจุบันต้องมากกว่าก่อนหน้า",
    en: "Water: current must be greater than previous",
  },
  // ── Meters – backend error codes ──────────────────────────────────────────
  "meters.error.noContract": {
    th: "ห้องนี้ยังไม่มีสัญญาเช่าที่ใช้งานอยู่",
    en: "This room has no active rental contract",
  },
  "meters.error.alreadyExists": {
    th: "มีข้อมูลมิเตอร์เดือนนี้แล้ว กรุณาแก้ไขแทน",
    en: "Meter reading already exists for this month",
  },
  "meters.error.noElectricRate": {
    th: "ยังไม่ได้ตั้งค่าอัตราค่าไฟฟ้า กรุณาตั้งค่าใน Utility Rates ก่อน",
    en: "No electric rate configured. Please set a rate in Utility Rates first.",
  },
  "meters.error.noWaterRate": {
    th: "ยังไม่ได้ตั้งค่าอัตราค่าน้ำประปา กรุณาตั้งค่าใน Utility Rates ก่อน",
    en: "No water rate configured. Please set a rate in Utility Rates first.",
  },
  "meters.error.unitLessThanPrev": {
    th: "เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขก่อนหน้า",
    en: "Current reading cannot be less than the previous reading",
  },
  "meters.error.notFound": {
    th: "ไม่พบข้อมูลมิเตอร์",
    en: "Meter reading not found",
  },
  "meters.saveSuccess": {
    th: "บันทึกมิเตอร์เรียบร้อย",
    en: "Meter reading saved successfully",
  },
  "meters.updateSuccess": {
    th: "อัปเดตมิเตอร์เรียบร้อย",
    en: "Meter reading updated successfully",
  },
  "meters.saveError": { th: "เกิดข้อผิดพลาด", en: "An error occurred" },
  "meters.loadError": { th: "โหลดข้อมูลไม่สำเร็จ", en: "Failed to load data" },
  "meters.image": { th: "รูปมิเตอร์", en: "Meter Photo" },
  "meters.used": { th: "หน่วย", en: "units" },
  "meters.electric": { th: "ไฟฟ้า", en: "Electric" },
  "meters.water": { th: "น้ำ", en: "Water" },

  // ── Deposits ───────────────────────────────────────────────────────────────
  "deposits.title": { th: "เงินประกัน", en: "Deposits" },
  "deposits.subtitle": {
    th: "จัดการเงินประกันและการคืนเงิน",
    en: "Manage deposits and refunds",
  },
  "deposits.statsTotal": { th: "รวมทั้งหมด", en: "Total" },
  "deposits.statusHeld": { th: "เก็บไว้", en: "Held" },
  "deposits.statusRefunded": { th: "คืนเงินแล้ว", en: "Refunded" },
  "deposits.statusDeducted": { th: "หักเงิน", en: "Deducted" },
  "deposits.searchPlaceholder": {
    th: "ค้นหา ชื่อ ห้อง หรือ ID...",
    en: "Search name, room or ID...",
  },
  "deposits.depositedOn": { th: "ฝากเมื่อ", en: "Deposited on" },
  "deposits.returnedOn": { th: "คืนเมื่อ", en: "Returned on" },
  "deposits.refundBtn": { th: "คืนเงิน", en: "Refund" },
  "deposits.notFound": { th: "ไม่พบเงินประกัน", en: "No deposits found" },
  "deposits.refundDialogTitle": { th: "คืนเงินประกัน", en: "Refund Deposit" },
  "deposits.refundDialogDesc": {
    th: "ระบุจำนวนเงินที่จะคืนให้ผู้เช่า",
    en: "Specify the amount to refund to the tenant",
  },
  "deposits.totalDeposit": { th: "เงินประกันทั้งหมด", en: "Total Deposit" },
  "deposits.refundAmount": { th: "เงินที่คืน", en: "Refund Amount" },
  "deposits.notePlaceholder": {
    th: "เช่น หักค่าเสียหาย 500 บาท ฯลฯ",
    en: "e.g. Deducted 500 THB for damages, etc.",
  },
  "deposits.confirmRefund": { th: "ยืนยันการคืนเงิน", en: "Confirm Refund" },
  "deposits.refundSuccess": {
    th: "บันทึกการคืนมัดจำเรียบร้อย",
    en: "Deposit refund recorded successfully",
  },
  "deposits.refundError": { th: "เกิดข้อผิดพลาด", en: "An error occurred" },
  "deposits.loadError": {
    th: "โหลดข้อมูลไม่สำเร็จ",
    en: "Failed to load data",
  },

  // ── Auth / Register / Login ────────────────────────────────────────────────
  "register.title": { th: "สมัครสมาชิก", en: "Create Account" },
  "register.subtitle": {
    th: "สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ",
    en: "Create a new account to get started",
  },
  "register.fullName": { th: "ชื่อ-นามสกุล", en: "Full Name" },
  "register.usernamePlaceholder": {
    th: "ชื่อผู้ใช้สำหรับล็อกอิน",
    en: "Login username",
  },
  "register.confirmPassword": { th: "ยืนยันรหัสผ่าน", en: "Confirm Password" },
  "register.submit": { th: "สมัครสมาชิก", en: "Create Account" },
  "register.loading": { th: "กำลังสมัครสมาชิก...", en: "Creating account..." },
  "register.hasAccount": {
    th: "มีบัญชีอยู่แล้ว?",
    en: "Already have an account?",
  },
  "register.login": { th: "เข้าสู่ระบบ", en: "Sign in" },
  "register.errorPasswordMismatch": {
    th: "รหัสผ่านไม่ตรงกัน",
    en: "Passwords do not match",
  },
  "register.errorPasswordLength": {
    th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    en: "Password must be at least 6 characters",
  },
  "register.errorInvalidEmail": {
    th: "รูปแบบอีเมลไม่ถูกต้อง",
    en: "Invalid email format",
  },
  "register.errorDuplicate": {
    th: "อีเมลหรือเบอร์โทรศัพท์นี้ ถูกใช้สมัครสมาชิกไปแล้ว",
    en: "This email or phone number is already registered.",
  },
  "register.errorInvalidPhone": {
    th: "รูปแบบเบอร์โทรไม่ถูกต้อง",
    en: "Invalid phone number format",
  },
  "register.errorNameLength": {
    th: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร",
    en: "Name must be at least 2 characters",
  },
  "register.fullNamePlaceholder": {
    th: "กรอกชื่อและนามสกุลของคุณ",
    en: "Enter your full name",
  },
  "register.emailPlaceholder": {
    th: "กรอกอีเมลของคุณ",
    en: "Enter your email",
  },
  "register.phonePlaceholder": {
    th: "กรอกเบอร์โทรศัพท์ของคุณ",
    en: "Enter your phone number",
  },

  PHONE_ALREADY_REGISTERED: {
    th: "เบอร์โทรศัพท์นี้มีผู้เช่าลงทะเบียนไว้แล้ว",
    en: "This phone number is already registered to a tenant",
  },
  EMAIL_ALREADY_REGISTERED: {
    th: "อีเมลนี้มีผู้เช่าลงทะเบียนไว้แล้ว",
    en: "This email is already registered to a tenant",
  },
  PHONE_EMAIL_CONFLICT_DIFFERENT_TENANTS: {
    th: "เบอร์โทรศัพท์และอีเมลที่กรอกตรงกับผู้เช่าคนละคนกันในระบบ กรุณาตรวจสอบข้อมูลอีกครั้ง หรือติดต่อผู้ดูแลระบบ",
    en: "The phone and email match different tenants in the system. Please double-check the information or contact the system administrator.",
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  "settings.title": { th: "ตั้งค่าระบบ", en: "System Settings" },
  "settings.subtitle": {
    th: "จัดการการตั้งค่าและกำหนดค่าของระบบ",
    en: "Manage system settings and configuration",
  },
  "settings.tabGeneral": { th: "ทั่วไป", en: "General" },
  "settings.tabFinancial": { th: "การเงิน", en: "Financial" },
  "settings.tabNotifications": { th: "แจ้งเตือน", en: "Notifications" },
  "settings.tabSecurity": { th: "ความปลอดภัย", en: "Security" },
  "settings.generalTitle": { th: "ข้อมูลทั่วไป", en: "General Information" },
  "settings.generalDesc": {
    th: "จัดการข้อมูลหอพักและข้อมูลผู้ดูแล",
    en: "Manage dormitory and admin information",
  },
  "settings.dormName": { th: "ชื่อหอพัก", en: "Dormitory Name" },
  "settings.dormAddress": { th: "ที่อยู่", en: "Address" },
  "settings.adminEmail": { th: "อีเมลผู้ดูแล", en: "Admin Email" },
  "settings.currency": { th: "สกุลเงิน", en: "Currency" },
  "settings.currencyTHB": { th: "บาทไทย (THB)", en: "Thai Baht (THB)" },
  "settings.currencyUSD": { th: "ดอลลาร์สหรัฐ (USD)", en: "US Dollar (USD)" },
  "settings.taxRate": { th: "อัตราภาษี (%)", en: "Tax Rate (%)" },
  "settings.saveGeneral": { th: "บันทึกการตั้งค่า", en: "Save Settings" },
  "settings.financialTitle": {
    th: "ข้อมูลการเงิน",
    en: "Financial Information",
  },
  "settings.financialDesc": {
    th: "จัดการข้อมูลธนาคารและการชำระเงิน",
    en: "Manage bank and payment information",
  },
  "settings.bankName": { th: "ชื่อธนาคาร", en: "Bank Name" },
  "settings.bankAccount": {
    th: "หมายเลขบัญชีธนาคาร",
    en: "Bank Account Number",
  },
  "settings.bankAccountName": {
    th: "ชื่อเจ้าของบัญชี",
    en: "Account Holder Name",
  },
  "settings.saveFinancial": {
    th: "บันทึกข้อมูลการเงิน",
    en: "Save Financial Info",
  },
  "settings.notifyTitle": { th: "การแจ้งเตือน", en: "Notifications" },
  "settings.notifyDesc": {
    th: "กำหนดการแจ้งเตือนต่างๆ ของระบบ",
    en: "Configure system notifications",
  },
  "settings.notifyPayment": {
    th: "แจ้งเตือนการชำระเงิน",
    en: "Payment Notifications",
  },
  "settings.notifyPaymentSub": {
    th: "ส่งอีเมลแจ้งเตือนเมื่อมีการชำระเงิน",
    en: "Send email when payment is received",
  },
  "settings.notifyMaintenance": {
    th: "แจ้งเตือนการซ่อมแซม",
    en: "Maintenance Notifications",
  },
  "settings.notifyMaintenanceSub": {
    th: "ส่งแจ้งเตือนเมื่อมีการแจ้งซ่อม",
    en: "Send notification when maintenance is requested",
  },
  "settings.notifyOverdue": {
    th: "แจ้งเตือนเงินค้างชำระ",
    en: "Overdue Notifications",
  },
  "settings.notifyOverdueSub": {
    th: "ส่งอีเมลแจ้งเตือนเมื่อมีเงินค้างชำระ",
    en: "Send email when payment is overdue",
  },
  "settings.saveNotifications": {
    th: "บันทึกการตั้งค่าการแจ้งเตือน",
    en: "Save Notification Settings",
  },
  "settings.telegramTitle": {
    th: "ตั้งค่า Telegram Bot",
    en: "Telegram Bot Setup",
  },
  "settings.telegramDesc": {
    th: "เชื่อมต่อ Telegram Bot สำหรับการแจ้งเตือน",
    en: "Connect Telegram Bot for notifications",
  },
  "settings.telegramStep1Title": {
    th: "สร้าง Telegram Bot",
    en: "Create a Telegram Bot",
  },
  "settings.telegramStep1Desc": {
    th: "สร้าง Bot ผ่าน @BotFather แล้วนำ Token ไปใส่ใน .env ของ backend",
    en: "Create a bot via @BotFather and add the token to your backend .env",
  },
  "settings.tgInstruct1": {
    th: "เปิด Telegram แล้วค้นหา",
    en: "Open Telegram and search for",
  },
  "settings.tgInstruct1b": { th: "แล้วกด Start", en: "then tap Start" },
  "settings.tgInstruct2": { th: "พิมพ์", en: "Type" },
  "settings.tgInstruct3": {
    th: "ตั้งชื่อ bot แล้วคัดลอก Bot Token ที่ได้รับ",
    en: "Name your bot and copy the Bot Token",
  },
  "settings.tgInstruct4": {
    th: "เพิ่ม Token ใน .env backend:",
    en: "Add the token to backend .env as",
  },
  "settings.tgInstruct4b": { th: "", en: "" },
  "settings.tgBotUsername": {
    th: "ชื่อผู้ใช้ของ Bot (@username)",
    en: "Bot Username (@username)",
  },
  "settings.tgBotUsernameHint": {
    th: "ใส่ไว้เพื่อแสดง link ให้ผู้เช่าใช้งาน",
    en: "Used to show a link to tenants",
  },
  "settings.telegramStep2Title": {
    th: "เชื่อม Telegram ของ Admin",
    en: "Link Admin Telegram Account",
  },
  "settings.telegramStep2Desc": {
    th: "เชื่อม Telegram ของคุณเพื่อรับแจ้งเตือนการชำระเงินและแจ้งซ่อม",
    en: "Link your Telegram to receive payment and maintenance alerts",
  },
  "settings.tgLinkHowTo": {
    th: "วิธีรับ Chat ID:",
    en: "How to get your Chat ID:",
  },
  "settings.tgLinkStep1": { th: "เปิด Bot ของคุณ:", en: "Open your bot:" },
  "settings.tgLinkStep2": { th: "พิมพ์คำสั่ง", en: "Send the command" },
  "settings.tgLinkStep3": {
    th: "หรือหา Chat ID ที่",
    en: "Or find Chat ID at",
  },
  "settings.tgChatIdPlaceholder": {
    th: "กรอก Chat ID เช่น 123456789",
    en: "Enter Chat ID e.g. 123456789",
  },
  "settings.tgChatIdRequired": {
    th: "กรุณากรอก Chat ID",
    en: "Please enter Chat ID",
  },
  "settings.telegramLink": { th: "เชื่อมต่อ", en: "Link" },
  "settings.telegramUnlink": { th: "ยกเลิกการเชื่อมต่อ", en: "Unlink" },
  "settings.telegramUnlinkConfirm": {
    th: "ยืนยันการยกเลิกเชื่อมต่อ Telegram?",
    en: "Confirm unlink Telegram?",
  },
  "settings.telegramStep3Title": {
    th: "ให้ผู้เช่าเชื่อมต่อ",
    en: "Tenant Setup",
  },
  "settings.telegramStep3Desc": {
    th: "แชร์ชื่อ Bot ให้ผู้เช่าทุกคนเชื่อมต่อด้วยตัวเอง",
    en: "Share the bot username so tenants can link their accounts themselves",
  },
  "settings.tgTenantStep1": {
    th: "ผู้เช่าเปิด Bot:",
    en: "Tenant opens the bot:",
  },
  "settings.tgTenantStep2": { th: "พิมพ์คำสั่ง", en: "Send the command" },
  "settings.tgTenantStep2b": {
    th: "(ใช้ username ที่ล็อกอินในแอป)",
    en: "(use their app login username)",
  },
  "settings.tgTenantStep3": {
    th: "Bot จะยืนยันและเชื่อมต่ออัตโนมัติ",
    en: "The bot will confirm and link automatically",
  },
  "settings.telegramConnected": { th: "เชื่อมต่อสำเร็จ", en: "Connected" },
  "settings.telegramConnectedSub": {
    th: "ระบบจะส่งการแจ้งเตือนผ่าน Telegram",
    en: "System will send notifications via Telegram",
  },
  "settings.telegramDisconnected": {
    th: "ยกเลิกการเชื่อมต่อ Telegram แล้ว",
    en: "Telegram disconnected",
  },
  "settings.telegramBroadcastTitle": {
    th: "ส่งข้อความหาผู้เช่าทุกคน",
    en: "Broadcast to All Tenants",
  },
  "settings.telegramBroadcastDesc": {
    th: "ส่งข้อความหาผู้เช่าทุกคนที่เชื่อมต่อ Telegram แล้ว",
    en: "Send a message to all tenants who have linked Telegram",
  },
  "settings.telegramBroadcastPlaceholder": {
    th: "พิมพ์ข้อความที่ต้องการส่ง...",
    en: "Type your message...",
  },
  "settings.telegramBroadcastSend": { th: "ส่งข้อความ", en: "Send Message" },
  "settings.telegramBroadcastRequired": {
    th: "กรุณากรอกข้อความ",
    en: "Please enter a message",
  },
  "settings.telegramBroadcastSuccess": {
    th: "ส่งข้อความสำเร็จ {n} คน",
    en: "Message sent to {n} tenant(s)",
  },
  "settings.telegramBroadcastError": {
    th: "ส่งข้อความไม่สำเร็จ",
    en: "Failed to send message",
  },
  "settings.securityTitle": { th: "ความปลอดภัย", en: "Security" },
  "settings.securityDesc": {
    th: "จัดการรหัสผ่านและความปลอดภัย",
    en: "Manage password and security",
  },
  "settings.oldPassword": { th: "รหัสผ่านเดิม", en: "Current Password" },
  "settings.oldPasswordPlaceholder": {
    th: "กรอกรหัสผ่านเดิม",
    en: "Enter current password",
  },
  "settings.newPassword": { th: "รหัสผ่านใหม่", en: "New Password" },
  "settings.newPasswordPlaceholder": {
    th: "กรอกรหัสผ่านใหม่",
    en: "Enter new password",
  },
  "settings.confirmPassword": {
    th: "ยืนยันรหัสผ่านใหม่",
    en: "Confirm New Password",
  },
  "settings.confirmPasswordPlaceholder": {
    th: "ยืนยันรหัสผ่าน",
    en: "Confirm password",
  },
  "settings.changePassword": { th: "เปลี่ยนรหัสผ่าน", en: "Change Password" },
  "settings.loadError": {
    th: "โหลดการตั้งค่าไม่สำเร็จ",
    en: "Failed to load settings",
  },
  "settings.saveError": { th: "บันทึกไม่สำเร็จ", en: "Save failed" },
  "settings.generalSaveSuccess": {
    th: "บันทึกการตั้งค่าทั่วไปสำเร็จ",
    en: "General settings saved successfully",
  },
  "settings.financialSaveSuccess": {
    th: "บันทึกการตั้งค่าการเงินสำเร็จ",
    en: "Financial settings saved successfully",
  },
  "settings.notifySaveSuccess": {
    th: "บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ",
    en: "Notification settings saved successfully",
  },
  "settings.passwordChangeSuccess": {
    th: "เปลี่ยนรหัสผ่านสำเร็จ",
    en: "Password changed successfully",
  },
  "settings.errorFillAll": {
    th: "กรุณากรอกข้อมูลให้ครบถ้วน",
    en: "Please fill in all required fields",
  },
  "settings.errorFillBank": {
    th: "กรุณากรอกข้อมูลธนาคารให้ครบถ้วน",
    en: "Please fill in all bank information",
  },
  "settings.errorFillPassword": {
    th: "กรุณากรอกรหัสผ่านให้ครบถ้วน",
    en: "Please fill in all password fields",
  },
  "settings.errorFillTelegram": {
    th: "กรุณากรอก Bot Token และ Chat ID",
    en: "Please enter Bot Token and Chat ID",
  },
  "settings.errorPasswordMismatch": {
    th: "รหัสผ่านใหม่ไม่ตรงกัน",
    en: "New passwords do not match",
  },
  "settings.errorPasswordLength": {
    th: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
    en: "Password must be at least 6 characters",
  },
  "settings.errorOldPassword": {
    th: "รหัสผ่านเดิมไม่ถูกต้อง",
    en: "Current password is incorrect",
  },
  "settings.errorInvalidEmail": {
    th: "รูปแบบอีเมลไม่ถูกต้อง",
    en: "Invalid email format",
  },
  "settings.errorInvalidPhone": {
    th: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก และขึ้นต้นด้วย 0",
    en: "Phone number must be 9-10 digits starting with 0",
  },
  "settings.errorPasswordSame": {
    th: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    en: "New password must be different from the old password",
  },
  "settings.profileDesc": {
    th: "จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี",
    en: "Manage your profile information and account security",
  },
  // เพิ่มเข้าไปใน object คำแปลของ frontend/context/language-context.tsx
  // ตาม format: "KEY": { th: "...", en: "..." }
  VALIDATION_FAILED: {
    th: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    en: "Validation failed, please check your input",
  },
  NO_VALID_FIELDS: {
    th: "ไม่มีข้อมูลที่จะอัปเดต",
    en: "No valid fields to update",
  },
  PROMPTPAY_TYPE_INVALID: {
    th: "กรุณาเลือกประเภท PromptPay ให้ถูกต้อง",
    en: "Please select a valid PromptPay type",
  },
  PROMPTPAY_PHONE_FORMAT: {
    th: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0",
    en: "Phone number must be 10 digits starting with 0",
  },
  PROMPTPAY_CITIZENID_FORMAT: {
    th: "เลขบัตรประชาชน/นิติบุคคลต้องเป็นตัวเลข 13 หลัก",
    en: "Citizen/corporate ID must be 13 digits",
  },
  PROMPTPAY_ID_FORMAT: {
    th: "รูปแบบหมายเลข PromptPay ไม่ถูกต้อง",
    en: "Invalid PromptPay ID format",
  },
  BANK_ACCOUNT_FORMAT: {
    th: "เลขที่บัญชีต้องเป็นตัวเลข 5-20 หลัก",
    en: "Bank account number must be 5-20 digits",
  },
  TAX_RATE_RANGE: {
    th: "อัตราภาษีต้องอยู่ระหว่าง 0-100",
    en: "Tax rate must be between 0-100",
  },
  WATER_FLAT_RATE_RANGE: {
    th: "ค่าน้ำเหมาจ่ายต้องเป็นตัวเลขไม่ติดลบ",
    en: "Flat water rate must be a non-negative number",
  },
  SETTINGS_UPDATED: {
    th: "บันทึกการตั้งค่าสำเร็จ",
    en: "Settings updated successfully",
  },

  // ── Tenant Telegram ────────────────────────────────────────────────────────
  "tgTenant.title": {
    th: "การแจ้งเตือน Telegram",
    en: "Telegram Notifications",
  },
  "tgTenant.subtitle": {
    th: "เชื่อมต่อ Telegram เพื่อรับแจ้งเตือนบิล การชำระเงิน และข่าวสาร",
    en: "Link Telegram to receive bill, payment and announcement alerts",
  },
  "tgTenant.connected": {
    th: "เชื่อมต่อ Telegram สำเร็จ",
    en: "Telegram linked successfully",
  },
  "tgTenant.notifyBill": {
    th: "รับแจ้งเตือนเมื่อมีบิลใหม่",
    en: "Bill notifications",
  },
  "tgTenant.notifyPayment": {
    th: "รับแจ้งเตือนเมื่อการชำระเงินได้รับการยืนยัน",
    en: "Payment confirmations",
  },
  "tgTenant.notifyMaintenance": {
    th: "รับอัปเดตสถานะการแจ้งซ่อม",
    en: "Maintenance status updates",
  },
  "tgTenant.notifyAnnouncement": {
    th: "รับประกาศจากหอพัก",
    en: "Dormitory announcements",
  },
  "tgTenant.howToTitle": {
    th: "วิธีเชื่อมต่อ Telegram",
    en: "How to link Telegram",
  },
  "tgTenant.howToDesc": {
    th: "ทำตาม 4 ขั้นตอนนี้เพื่อรับแจ้งเตือนผ่าน Telegram",
    en: "Follow these 4 steps to receive notifications via Telegram",
  },
  "tgTenant.step1": {
    th: "เปิด Telegram แล้วค้นหา",
    en: "Open Telegram and find",
  },
  "tgTenant.step1b": { th: "แล้วกด Start", en: "then tap Start" },
  "tgTenant.step2": { th: "พิมพ์คำสั่ง", en: "Send the command" },
  "tgTenant.step2b": {
    th: "(username ที่ใช้ login ในแอป)",
    en: "(your app login username)",
  },
  "tgTenant.step3": {
    th: "Bot จะตอบกลับพร้อม Chat ID ของคุณ — คัดลอกไว้",
    en: "The bot will reply with your Chat ID — copy it",
  },
  "tgTenant.step4": {
    th: "วาง Chat ID ด้านล่างแล้วกดเชื่อมต่อ",
    en: "Paste the Chat ID below and tap Link",
  },
  "tgTenant.orManual": {
    th: "กรอก Chat ID ด้วยตัวเอง",
    en: "Enter Chat ID manually",
  },
  "tgTenant.chatIdHint": {
    th: "หา Chat ID ได้จาก Bot หรือ @userinfobot",
    en: "Get your Chat ID from the bot or @userinfobot",
  },
  "tgTenant.linkSuccess": {
    th: "เชื่อมต่อ Telegram สำเร็จ! 🎉",
    en: "Telegram linked successfully! 🎉",
  },
  "tgTenant.commandsTitle": { th: "คำสั่งที่ใช้ได้", en: "Available Commands" },
  "tgTenant.cmdStart": {
    th: "เชื่อมต่อบัญชีกับระบบ",
    en: "Link your account to the system",
  },
  "tgTenant.cmdStatus": { th: "ดูบิลค้างชำระ", en: "Check pending bills" },
  "tgTenant.cmdHelp": { th: "ดูคำสั่งทั้งหมด", en: "Show all commands" },

  // ── Move-out ───────────────────────────────────────────────────────────────
  "moveout.title": { th: "คำร้องขอย้ายออก", en: "Move-out Requests" },
  "moveout.subtitle": {
    th: "ตรวจสอบและอนุมัติคำร้องขอย้ายออกจากผู้เช่า",
    en: "Review and approve move-out requests from tenants",
  },
  "moveout.searchPlaceholder": {
    th: "ค้นหาชื่อผู้เช่า หรือหมายเลขห้อง...",
    en: "Search tenant name or room number...",
  },
  "moveout.allStatuses": { th: "สถานะทั้งหมด", en: "All Statuses" },
  "moveout.statusPending": { th: "รอพิจารณา", en: "Pending Review" },
  "moveout.statusApproved": { th: "อนุมัติแล้ว", en: "Approved" },
  "moveout.statusRejected": { th: "ไม่อนุมัติ", en: "Rejected" },
  "moveout.listTitle": { th: "รายการคำร้องทั้งหมด", en: "All Requests" },
  "moveout.totalItems": { th: "ทั้งหมด {n} รายการ", en: "{n} records total" },
  "moveout.colMoveOutDate": { th: "วันที่ต้องการย้ายออก", en: "Move-out Date" },
  "moveout.colSubmittedAt": { th: "วันที่ส่งคำร้อง", en: "Submitted At" },
  "moveout.notFound": {
    th: "ไม่พบคำร้องขอย้ายออก",
    en: "No move-out requests found",
  },
  "moveout.actualCheckoutDateLabel": {
    th: "วันที่ย้ายออกจริง",
    en: "Actual Check-out Date",
  },
  "moveout.actualCheckoutDateHint": {
    th: "ใช้วันที่นี้คำนวณค่าปรับและเงินคืนประกัน (ไม่ใช่วันที่ผู้เช่าแจ้งไว้)",
    en: "Use this date to calculate penalties and deposit refunds (not the date requested by the tenant)",
  },

  // ── Move-out Clearance & Deposit Refund ─────────────────────────────
  "moveout.clearanceButton": {
    th: "เคลียร์เงินประกัน",
    en: "Clear Deposit",
  },
  "moveout.clearanceTitle": {
    th: "คำนวณคืนเงินประกัน (ห้อง {room})",
    en: "Deposit Refund Calculation (Room {room})",
  },
  "moveout.clearanceDesc": {
    th: "ตรวจสอบและคำนวณรายการหักค่าใช้จ่ายก่อนคืนกุญแจ",
    en: "Review and calculate deductions before key return",
  },
  "moveout.depositAmount": {
    th: "เงินประกันตั้งต้น (บาท)",
    en: "Initial Security Deposit (THB)",
  },
  "moveout.utilityAmount": {
    th: "หัก: ค่าน้ำ-ไฟ งวดสุดท้าย (บาท)",
    en: "Deduct: Final Utility Bill (THB)",
  },
  "moveout.damageAmount": {
    th: "หัก: ค่าเสียหาย / ค่าปรับผิดสัญญา (บาท)",
    en: "Deduct: Damages / Penalty (THB)",
  },
  "moveout.clearanceNote": {
    th: "หมายเหตุการหักเงิน (ถ้ามี)",
    en: "Deduction Note (optional)",
  },
  "moveout.clearanceNotePlaceholder": {
    th: "เช่น ล้างแอร์, กุญแจชำรุด...",
    en: "e.g., AC cleaning fee, broken key...",
  },
  "moveout.refundToTenant": {
    th: "ยอดเงินที่ต้องโอนคืนผู้เช่า",
    en: "Net Refund to Tenant",
  },
  "moveout.payByTenant": {
    th: "ผู้เช่าต้องชำระส่วนต่างเพิ่ม",
    en: "Tenant Must Pay Difference",
  },
  "moveout.confirmClearance": {
    th: "ยืนยันเคลียร์ยอด",
    en: "Confirm Clearance",
  },
  "moveout.clearanceSuccess": {
    th: "บันทึกการเคลียร์ยอดห้อง {room} เรียบร้อยแล้ว",
    en: "Clearance recorded for room {room}",
  },
  "moveout.clearanceError": {
    th: "เกิดข้อผิดพลาดในการเคลียร์ยอด",
    en: "Failed to process clearance",
  },
  "moveout.detailTitle": {
    th: "รายละเอียดคำร้องขอย้ายออก",
    en: "Move-out Request Details",
  },
  // ── Move-out Smart Meter Clearance ────────────────────────────────
  "moveout.meterSection": {
    th: "คำนวณมิเตอร์น้ำ-ไฟ งวดสุดท้าย",
    en: "Final Utility Meter Calculation",
  },
  "moveout.waterStart": {
    th: "มิเตอร์น้ำเดิม (หน่วย)",
    en: "Prev Water Meter",
  },
  "moveout.waterEnd": {
    th: "มิเตอร์น้ำวันออก (หน่วย)",
    en: "Final Water Meter",
  },
  "moveout.electricStart": {
    th: "มิเตอร์ไฟเดิม (หน่วย)",
    en: "Prev Electric Meter",
  },
  "moveout.electricEnd": {
    th: "มิเตอร์ไฟวันออก (หน่วย)",
    en: "Final Electric Meter",
  },
  "moveout.utilityTotal": {
    th: "รวมค่าน้ำ-ไฟ ที่ต้องหัก",
    en: "Total Utility Cost to Deduct",
  },

  "moveout.detailDesc": {
    th: "ตรวจสอบข้อมูลและดำเนินการ",
    en: "Review information and take action",
  },
  "moveout.reason": { th: "เหตุผล", en: "Reason" },
  "moveout.adminNoteLabel": {
    th: "หมายเหตุ (ถ้าปฏิเสธต้องกรอก)",
    en: "Note (required if rejecting)",
  },
  "moveout.adminNotePlaceholder": {
    th: "เหตุผลที่อนุมัติหรือไม่อนุมัติ...",
    en: "Reason for approval or rejection...",
  },
  "moveout.adminNoteTitle": { th: "หมายเหตุแอดมิน", en: "Admin Note" },
  "moveout.approve": { th: "อนุมัติ", en: "Approve" },
  "moveout.reject": { th: "ไม่อนุมัติ", en: "Reject" },
  "moveout.confirmApprove": {
    th: "อนุมัติการย้ายออกของ",
    en: "Approve move-out for",
  },
  "moveout.confirmApproveDetail": {
    th: "สัญญาจะถูกยกเลิกและห้องจะว่างทันที",
    en: "The contract will be terminated and the room will be available immediately.",
  },
  "moveout.approveSuccess": {
    th: "อนุมัติการย้ายออกเรียบร้อย ห้องพร้อมให้เช่าแล้ว",
    en: "Move-out approved. Room is now available for rent.",
  },
  "moveout.approveError": { th: "อนุมัติไม่สำเร็จ", en: "Failed to approve" },
  "moveout.rejectNoteRequired": {
    th: "กรุณากรอกเหตุผลที่ไม่อนุมัติ",
    en: "Please enter a reason for rejection",
  },
  "moveout.rejectSuccess": {
    th: "ปฏิเสธคำร้องเรียบร้อย",
    en: "Request rejected successfully",
  },
  "moveout.rejectError": { th: "ดำเนินการไม่สำเร็จ", en: "Action failed" },
  "moveout.loadError": { th: "โหลดข้อมูลไม่สำเร็จ", en: "Failed to load data" },
  "moveout.request": {
    th: "ส่งคำร้องขอย้ายออก",
    en: "Submit Move-out Request",
  },
  "moveout.moveOutDate": { th: "วันที่ต้องการย้ายออก", en: "Move-out Date" },
  "moveout.notice30": {
    th: "กรุณาแจ้งล่วงหน้าอย่างน้อย 30 วันก่อนวันที่ต้องการย้ายออก เพื่อให้ผู้ดูแลหอพักเตรียมการได้ทัน",
    en: "Please give at least 30 days advance notice before your intended move-out date so we can prepare.",
  },
  "moveout.infoFine": {
    th: "หากย้ายออกขณะที่สัญญาเช่ายังเหลือมากกว่า 30 วัน จะมีค่าปรับผิดสัญญาเท่ากับค่าเช่า 1 เดือน หักจากเงินประกัน",
    en: "If you move out with more than 30 days remaining on your contract, an early-termination fine equal to one month's rent will be deducted from your deposit.",
  },
  "moveout.infoRefund": {
    th: "เงินประกันส่วนที่เหลือ (หลังหักค่าปรับ ถ้ามี) จะคืนให้หลังหักค่าน้ำ-ไฟงวดสุดท้ายและค่าเสียหาย (ถ้ามี) ซึ่งจะคำนวณจริงตอนตรวจสอบห้องวันย้ายออก",
    en: "The remaining deposit (after any fine) is refunded after deducting the final utility bill and any damages, calculated at the move-out inspection.",
  },
  "moveout.fine": { th: "ค่าปรับ", en: "Fine" },
  "moveout.refund": { th: "ยอดคืนเงินประกัน", en: "Deposit Refund" },
  "moveout.hasPending": {
    th: "มีคำร้องรออยู่แล้ว",
    en: "Already has pending request",
  },
  "moveout.depositTitle": { th: "เงินประกัน", en: "Security Deposit" },
  "moveout.fineAmount": {
    th: "ค่าปรับออกก่อนกำหนด",
    en: "Early Termination Fine",
  },
  "moveout.deductionExtraLabel": {
    th: "หักเพิ่มเติม (ถ้ามี)",
    en: "Additional Deduction (optional)",
  },
  "moveout.deductionExtraNoteLabel": {
    th: "เหตุผลการหักเพิ่ม",
    en: "Reason for Deduction",
  },
  "moveout.deductionExtraNotePlaceholder": {
    th: "เช่น ค่าซ่อมผนัง, ค่าทำความสะอาด",
    en: "e.g. Wall repair, cleaning fee",
  },
  "moveout.netRefund": { th: "ยอดคืนสุทธิ", en: "Net Refund" },
  "moveout.noDeposit": {
    th: "สัญญานี้ไม่มีเงินประกัน",
    en: "No deposit for this contract",
  },
  "moveout.deductionExceeds": {
    th: "ยอดหักเพิ่มเติมเกินกว่ายอดเงินประกันที่เหลืออยู่",
    en: "Deduction exceeds remaining deposit",
  },
  "moveout.depositPreviewError": {
    th: "ไม่สามารถโหลดข้อมูลเงินประกันได้",
    en: "Failed to load deposit info",
  },
  "moveout.depositPreviewUnavailable": {
    th: "ไม่มีข้อมูลเงินประกัน",
    en: "Deposit info unavailable",
  },

  // ── Tenant Dashboard ───────────────────────────────────────────────────────
  "tenant.welcome": { th: "สวัสดี", en: "Hello" },
  "tenant.myRoom": { th: "ห้องพัก", en: "Room" },
  "tenant.rentPerMonth": { th: "ค่าเช่ารายเดือน", en: "Monthly Rent" },
  "tenant.pendingBill": {
    th: "คุณมีบิลที่รอชำระ",
    en: "You have a pending bill",
  },
  "tenant.overdueBill": { th: "บิลเกินกำหนดชำระ!", en: "Overdue bill!" },
  "tenant.payNow": { th: "ชำระเงิน", en: "Pay Now" },
  "tenant.room": { th: "ห้อง", en: "Room" },
  "tenant.noOutstandingBalance": {
    th: "ไม่มียอดค้างชำระ",
    en: "No outstanding balance",
  },
  "tenant.myContract": { th: "สัญญาเช่าของฉัน", en: "My Contract" },
  "tenant.profileSubtitle": {
    th: "ข้อมูลของฉันและการแจ้งเตือน",
    en: "My info and notifications",
  },
  "common.latestStatus": { th: "สถานะล่าสุด", en: "Latest status" },
  "tenant.bills.title": { th: "บิลของฉัน", en: "My Bills" },
  "tenant.bills.subtitle": {
    th: "ดูรายละเอียดบิลค่าเช่าทั้งหมด",
    en: "View all your rental bills",
  },
  "tenant.bills.invoice": { th: "ใบแจ้งหนี้", en: "Invoice" },
  "tenant.bills.payBill": { th: "ชำระบิลนี้", en: "Pay This Bill" },
  "tenant.payment.title": { th: "ชำระเงิน", en: "Payment" },
  "tenant.payment.subtitle": {
    th: "ชำระค่าห้อง ค่าน้ำ ค่าไฟ",
    en: "Pay room, water, electric fees",
  },
  "tenant.payment.selectBill": {
    th: "เลือกบิลที่ต้องการชำระ",
    en: "Select bill to pay",
  },
  "tenant.payment.methods": { th: "วิธีการชำระเงิน", en: "Payment Methods" },
  "tenant.payment.totalDue": { th: "รวมค้างชำระ", en: "Total Due" },
  "tenant.payment.afterPay": {
    th: "หลังชำระแล้ว กรุณาอัปโหลดสลิปด้วยครับ",
    en: "After payment, please upload slip.",
  },
  "tenant.maintenance.title": { th: "ขอซ่อมแซม", en: "Maintenance Request" },
  "tenant.maintenance.subtitle": {
    th: "ส่งคำขอซ่อมแซมหรือปัญหาต่างๆ",
    en: "Submit repair or issue requests",
  },
  "maintenance.listTitle": {
    th: "รายการแจ้งซ่อม",
    en: "Maintenance Requests",
  },
  "tenant.maintenance.new": { th: "ส่งคำขอใหม่", en: "New Request" },
  "tenant.maintenance.success": {
    th: "ส่งคำขอสำเร็จ",
    en: "Request submitted",
  },
  "tenant.contract.title": { th: "สัญญาเช่า", en: "Rental Contract" },
  "tenant.contract.subtitle": {
    th: "ดูและจัดการสัญญาเช่าของคุณ",
    en: "View and manage your rental contract",
  },
  "tenant.contract.current": { th: "สัญญาปัจจุบัน", en: "Current Contract" },
  "tenant.contract.none": {
    th: "ยังไม่มีสัญญาเช่า",
    en: "No rental contract yet",
  },
  "tenant.contract.downloadError": {
    th: "ไม่สามารถดาวน์โหลดไฟล์สัญญาได้ กรุณาลองใหม่อีกครั้ง",
    en: "Failed to download the contract file. Please try again.",
  },
  "tenant.contract.noFileYet": {
    th: "ยังไม่มีไฟล์สัญญาในระบบ ",
    en: "No contract file uploaded yet",
  },
  "tenant.contract.download": { th: "ดาวน์โหลดสัญญา", en: "Download Contract" },
  "tenant.contract.downloading": {
    th: "กำลังดาวน์โหลด...",
    en: "Downloading...",
  },
  "tenant.contract.noFileYetDesc": {
    th: "ผู้ดูแลระบบยังไม่ได้อัปโหลดไฟล์สัญญา กรุณาติดต่อผู้ดูแลระบบ",
    en: "The administrator has not uploaded the contract file yet. Please contact the administrator.",
  },

  "tenant.moveout.title": { th: "ขอย้ายออก", en: "Move-out Request" },
  "tenant.moveout.subtitle": {
    th: "แจ้งความประสงค์ย้ายออกจากหอพัก",
    en: "Notify your intention to move out",
  },
  "tenant.moveout.hasPending": {
    th: "มีคำร้องรออยู่แล้ว",
    en: "Already has pending request",
  },

  // ── Tenant Profile ─────────────────────────────────────────────────────────
  "tenant.profile.title": { th: "โปรไฟล์", en: "Profile" },
  "tenant.profile.subtitle": {
    th: "จัดการข้อมูลส่วนตัวของคุณ",
    en: "Manage your personal information",
  },
  "tenant.profile.personalInfo": {
    th: "ข้อมูลส่วนตัว",
    en: "Personal Information",
  },
  "tenant.profile.changePassword": {
    th: "เปลี่ยนรหัสผ่าน",
    en: "Change Password",
  },
  "tenant.profile.telegram": {
    th: "การแจ้งเตือน Telegram",
    en: "Telegram Notifications",
  },
  "tenant.profile.telegramDesc": {
    th: "เชื่อมต่อ Telegram เพื่อรับแจ้งเตือน",
    en: "Connect Telegram to receive notifications",
  },
  "tenant.profile.connectTelegram": {
    th: "เชื่อมต่อ Telegram",
    en: "Connect Telegram",
  },
  "tenant.profile.telegramLinked": { th: "เชื่อมต่อแล้ว", en: "Connected" },
  "tenant.profile.unlinkTelegram": {
    th: "ยกเลิกการเชื่อมต่อ",
    en: "Disconnect",
  },
  "tenant.profile.saveSuccess": {
    th: "บันทึกข้อมูลสำเร็จ",
    en: "Profile saved successfully",
  },
  "tenant.profile.passwordSuccess": {
    th: "เปลี่ยนรหัสผ่านสำเร็จ",
    en: "Password changed successfully",
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  "notifications.title": { th: "แจ้งเตือน", en: "Notifications" },
  "notifications.unread": { th: "รายการที่ยังไม่ได้อ่าน", en: "unread items" },
  "notifications.markAll": {
    th: "ทำเครื่องหมายว่าอ่านทั้งหมด",
    en: "Mark all as read",
  },
  "notifications.empty": { th: "ไม่มีการแจ้งเตือน", en: "No notifications" },
  "notifications.new": { th: "ใหม่", en: "New" },

  // ── Empty states (tenant ใหม่) — ✅ เพิ่มใหม่ ──────────────────────────────
  "empty.noBills": { th: "ยังไม่มีบิล", en: "No bills yet" },
  "empty.noBillsDesc": {
    th: "บิลจะปรากฏเมื่อแอดมินสร้างให้",
    en: "Bills will appear once the admin creates them",
  },
  "empty.noPayments": {
    th: "ยังไม่มีประวัติการชำระเงิน",
    en: "No payment history yet",
  },
  "empty.noPaymentsDesc": {
    th: "รายการจะปรากฏหลังจากชำระเงินแล้ว",
    en: "Records will appear after you make a payment",
  },
  "empty.noMaintenance": {
    th: "ยังไม่มีรายการแจ้งซ่อม",
    en: "No maintenance requests yet",
  },
  "empty.noMaintenanceDesc": {
    th: "กดปุ่ม 'ส่งคำขอใหม่' เพื่อแจ้งซ่อม",
    en: "Tap 'New Request' to submit a repair request",
  },
  "empty.noMoveOut": {
    th: "ยังไม่มีคำร้องย้ายออก",
    en: "No move-out requests yet",
  },
  "empty.noMoveOutDesc": {
    th: "กดปุ่มด้านบนเพื่อส่งคำร้อง",
    en: "Tap the button above to submit a request",
  },
  "empty.noContract": { th: "ยังไม่มีสัญญาเช่า", en: "No rental contract yet" },
  "empty.noContractDesc": {
    th: "ติดต่อแอดมินเพื่อทำสัญญาเช่า",
    en: "Contact admin to set up your rental contract",
  },
  "empty.noAnnouncements": { th: "ยังไม่มีประกาศ", en: "No announcements yet" },
  "empty.noAnnouncementsDesc": {
    th: "ประกาศจากหอพักจะแสดงที่นี่",
    en: "Dormitory announcements will appear here",
  },

  // Stats card
  "common.fromLastMonth": { th: "จากเดือนที่แล้ว", en: "from last month" },

  // ── Months ─────────────────────────────────────────────────────────────────
  "month.1": { th: "มกราคม", en: "January" },
  "month.2": { th: "กุมภาพันธ์", en: "February" },
  "month.3": { th: "มีนาคม", en: "March" },
  "month.4": { th: "เมษายน", en: "April" },
  "month.5": { th: "พฤษภาคม", en: "May" },
  "month.6": { th: "มิถุนายน", en: "June" },
  "month.7": { th: "กรกฎาคม", en: "July" },
  "month.8": { th: "สิงหาคม", en: "August" },
  "month.9": { th: "กันยายน", en: "September" },
  "month.10": { th: "ตุลาคม", en: "October" },
  "month.11": { th: "พฤศจิกายน", en: "November" },
  "month.12": { th: "ธันวาคม", en: "December" },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("th");

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language | null;
    if (saved === "th" || saved === "en") setLanguage(saved);
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string): string => {
    const trans = translations[key];
    if (!trans) return key;
    return trans[language] || key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // ✅ return default แทน throw — ป้องกัน prerender crash
    return {
      language: "th" as const,
      setLanguage: (_lang: "th" | "en") => {},
      t: (key: string) => key,
    };
  }
  return context;
}
