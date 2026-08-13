//frontend/context/notification-context.tsx

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
  buildNotifications,
  unreadTypesOf,
  loadActions,
  saveActions,
  NotifType,
} from "@/lib/notifications";

interface NotificationContextType {
  hasUnread: boolean;
  unreadTypes: Set<NotifType>;
  markAllAsRead: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  hasUnread: false,
  unreadTypes: new Set(),
  markAllAsRead: () => {},
  refresh: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unreadTypes, setUnreadTypes] = useState<Set<NotifType>>(new Set());

  const labels = useCallback(
    () => ({
      pendingBill: t("tenant.pendingBill"),
      overdueBill: t("tenant.overdueBill"),
      resolved: t("status.resolved"),
      announcement: t("announcements.title"),
      totalAmount: t("bills.totalAmount"),
    }),
    [t],
  );

  const monthLabel = useCallback((m: number) => t(`month.${m}`), [t]);

  const fetchAndCheck = useCallback(() => {
    if (!user) return;
    buildNotifications(user.id, (d) => d, labels(), monthLabel).then((items) =>
      setUnreadTypes(unreadTypesOf(items)),
    );
  }, [user, labels, monthLabel]);

  useEffect(() => {
    fetchAndCheck();
  }, [fetchAndCheck]);

  // mark ทุก item ที่ยัง unread ให้เป็น "read" จริงใน localStorage
  // ไม่ใช่แค่ setState เฉยๆ — กัน dot โผล่กลับมาหลัง refresh
  const markAllAsRead = useCallback(() => {
    if (!user) return;
    buildNotifications(user.id, (d) => d, labels(), monthLabel).then(
      (items) => {
        const actions = loadActions(user.id);
        items.filter((i) => !i.isRead).forEach((i) => (actions[i.id] = "read"));
        saveActions(user.id, actions);
        setUnreadTypes(new Set());
      },
    );
  }, [user, labels, monthLabel]);

  return (
    <NotificationContext.Provider
      value={{
        hasUnread: unreadTypes.size > 0,
        unreadTypes,
        markAllAsRead,
        refresh: fetchAndCheck,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
