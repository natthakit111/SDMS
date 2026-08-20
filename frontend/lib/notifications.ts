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
import type { Bill, MaintenanceRequest, Announcement } from "@/types/index";

export type NotifType = "bill" | "maintenance" | "announcement";

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

export function unreadTypesOf(items: NotificationItem[]): Set<NotifType> {
  const types = new Set<NotifType>();
  for (const item of items) {
    if (!item.isRead) types.add(item.type);
  }
  return types;
}
