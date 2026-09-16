//frontend/context/admin-notification-context.tsx

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import {
  buildAdminNotifications,
  unreadTypesOf,
  loadActions,
  saveActions,
  NotifType,
} from "@/lib/notifications";

interface AdminNotificationContextType {
  hasUnread: boolean;
  unreadTypes: Set<NotifType>;
  markAllAsRead: () => void;
  refresh: () => void;
}

const AdminNotificationContext = createContext<AdminNotificationContextType>({
  hasUnread: false,
  unreadTypes: new Set(),
  markAllAsRead: () => {},
  refresh: () => {},
});

export function AdminNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unreadTypes, setUnreadTypes] = useState<Set<NotifType>>(new Set());

  const labels = useCallback(
    () => ({
      newMaintenance: t("notifications.newMaintenance"),
      pendingPayment: t("notifications.pendingPayment"),
      newMoveOut: t("notifications.newMoveOut"),
      room: t("tenant.myRoom"),
    }),
    [t],
  );

  const fetchAndCheck = useCallback(() => {
    if (!user) return;
    buildAdminNotifications(user.id, (d) => d, labels()).then((items) =>
      setUnreadTypes(unreadTypesOf(items)),
    );
  }, [user, labels]);

  useEffect(() => {
    fetchAndCheck();
  }, [fetchAndCheck]);

  // mark ทุก item ที่ยัง unread ให้เป็น "read" จริงใน localStorage
  // ไม่ใช่แค่ setState เฉยๆ — กัน dot โผล่กลับมาหลัง refresh
  const markAllAsRead = useCallback(() => {
    if (!user) return;
    buildAdminNotifications(user.id, (d) => d, labels()).then((items) => {
      const actions = loadActions(user.id);
      items.filter((i) => !i.isRead).forEach((i) => (actions[i.id] = "read"));
      saveActions(user.id, actions);
      setUnreadTypes(new Set());
    });
  }, [user, labels]);

  return (
    <AdminNotificationContext.Provider
      value={{
        hasUnread: unreadTypes.size > 0,
        unreadTypes,
        markAllAsRead,
        refresh: fetchAndCheck,
      }}
    >
      {children}
    </AdminNotificationContext.Provider>
  );
}

export const useAdminNotification = () => useContext(AdminNotificationContext);
