// frontend/lib/notifications.ts
// Builds the tenant notification feed (bell icon + /tenant/notifications page)
// by combining pending/overdue bills, resolved maintenance requests, and
// announcements into one list. Read/deleted state is tracked client-side in
// localStorage per tenant (there's no notifications table on the backend —
// see notifications_log, which is only a send-history audit log, not a
// per-item read/unread flag for this feed).

import { billAPI } from "@/lib/api/bill.api";
import { maintenanceAPI } from "@/lib/api/maintenance.api";
import { announcementAPI } from "@/lib/api/announcement.api";
import { paymentAPI } from "@/lib/api/payment.api";
import { moveOutAPI } from "@/lib/api/moveOut.api";
import type {
  Bill,
  MaintenanceRequest,
  Announcement,
  Payment,
  MoveOutRequest,
} from "@/types/index";

export type NotifType = "bill" | "maintenance" | "announcement" | "payment" | "moveout";

export interface NotificationItem {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  timestamp: string;
  href: string;
  isRead: boolean;
  sortDate: string;
}

export interface NotificationLabels {
  pendingBill: string;
  overdueBill: string;
  resolved: string;
  announcement: string;
  totalAmount: string;
}

type ActionMap = Record<string, "read" | "deleted">;

const storageKey = (userId: string) => `sdms_notif_actions_${userId}`;

export function loadActions(userId: string): ActionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ActionMap) : {};
  } catch {
    return {};
  }
}

export function saveActions(userId: string, actions: ActionMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(actions));
}

export async function buildNotifications(
  userId: string,
  fmtDate: (isoDate: string) => string,
  labels: NotificationLabels,
  monthLabel: (month: number) => string,
): Promise<NotificationItem[]> {
  const [billsRes, maintenanceRes, announcementsRes] = await Promise.all([
    billAPI.getMyBills().catch(() => ({ data: [] as Bill[] })),
    maintenanceAPI.getMyRequests().catch(() => ({ data: [] as MaintenanceRequest[] })),
    announcementAPI.getAll().catch(() => ({ data: [] as Announcement[] })),
  ]);

  const items: NotificationItem[] = [];

  for (const bill of (billsRes.data || []) as Bill[]) {
    if (bill.status !== "pending" && bill.status !== "overdue") continue;
    items.push({
      id: `bill-${bill.bill_id}`,
      type: "bill",
      title:
        bill.status === "overdue" ? labels.overdueBill : labels.pendingBill,
      message: `${monthLabel(bill.bill_month)} ${bill.bill_year} — ${labels.totalAmount}: ${bill.total_amount}`,
      timestamp: fmtDate(bill.due_date),
      href: "/tenant/bills",
      isRead: false,
      sortDate: bill.due_date,
    });
  }

  for (const req of (maintenanceRes.data || []) as MaintenanceRequest[]) {
    if (req.status !== "resolved") continue;
    const date = req.resolved_at || req.updated_at;
    items.push({
      id: `maint-${req.request_id}`,
      type: "maintenance",
      title: labels.resolved,
      message: req.category,
      timestamp: fmtDate(date),
      href: "/tenant/maintenance",
      isRead: false,
      sortDate: date,
    });
  }

  for (const ann of (announcementsRes.data || []) as Announcement[]) {
    items.push({
      id: `ann-${ann.announcement_id}`,
      type: "announcement",
      title: `${labels.announcement}: ${ann.title}`,
      message: ann.content,
      timestamp: fmtDate(ann.published_at),
      href: "/tenant/announcements",
      isRead: false,
      sortDate: ann.published_at,
    });
  }

  const actions = loadActions(userId);
  const withActions = items
    .filter((item) => actions[item.id] !== "deleted")
    .map((item) => ({ ...item, isRead: actions[item.id] === "read" }));

  return withActions.sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
  );
}

export interface AdminNotificationLabels {
  newMaintenance: string;
  pendingPayment: string;
  newMoveOut: string;
  room: string;
}

// Admin-side counterpart of buildNotifications() above: feeds the admin bell
// icon + /admin/notifications page from items that need admin attention
// (new maintenance requests, slips pending verification, new move-out
// requests) instead of the tenant's own bills/maintenance/announcements.
export async function buildAdminNotifications(
  userId: string,
  fmtDate: (isoDate: string) => string,
  labels: AdminNotificationLabels,
): Promise<NotificationItem[]> {
  const [maintRes, payRes, moveRes] = await Promise.all([
    maintenanceAPI
      .getAll({ status: "pending" })
      .catch(() => ({ data: [] as MaintenanceRequest[] })),
    paymentAPI
      .getAll({ status: "pending_verify" })
      .catch(() => ({ data: [] as Payment[] })),
    moveOutAPI.getAll().catch(() => ({ data: [] as MoveOutRequest[] })),
  ]);

  const items: NotificationItem[] = [];

  for (const req of (maintRes.data || []) as MaintenanceRequest[]) {
    if (req.status !== "pending") continue;
    items.push({
      id: `admin-maint-${req.request_id}`,
      type: "maintenance",
      title: labels.newMaintenance,
      message: `${req.tenant_name || "-"} · ${labels.room} ${req.room_number || "-"} — ${req.category}`,
      timestamp: fmtDate(req.created_at),
      href: "/admin/maintenance",
      isRead: false,
      sortDate: req.created_at,
    });
  }

  for (const p of (payRes.data || []) as Payment[]) {
    if (p.status !== "pending_verify") continue;
    items.push({
      id: `admin-pay-${p.payment_id}`,
      type: "payment",
      title: labels.pendingPayment,
      message: `${p.tenant_name || "-"} · ${labels.room} ${p.room_number || "-"} — ${p.amount_paid}`,
      timestamp: fmtDate(p.paid_at),
      href: "/admin/payments",
      isRead: false,
      sortDate: p.paid_at,
    });
  }

  for (const m of (moveRes.data || []) as MoveOutRequest[]) {
    if (m.status !== "pending") continue;
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
    items.push({
      id: `admin-move-${m.request_id}`,
      type: "moveout",
      title: labels.newMoveOut,
      message: `${name || "-"} · ${labels.room} ${m.room_number || "-"}`,
      timestamp: fmtDate(m.created_at),
      href: "/admin/move-out",
      isRead: false,
      sortDate: m.created_at,
    });
  }

  const actions = loadActions(userId);
  const withActions = items
    .filter((item) => actions[item.id] !== "deleted")
    .map((item) => ({ ...item, isRead: actions[item.id] === "read" }));

  return withActions.sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
  );
}

export function unreadTypesOf(items: NotificationItem[]): Set<NotifType> {
  const types = new Set<NotifType>();
  for (const item of items) {
    if (!item.isRead) types.add(item.type);
  }
  return types;
}
