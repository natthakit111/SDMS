//frontend/context/notification-context.tsx

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { billAPI } from "@/lib/api/bill.api";
import { useAuth } from "@/context/auth-context";

interface NotificationContextType {
  hasUnread: boolean;
  markAsRead: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  hasUnread: false,
  markAsRead: () => {},
  refresh: () => {},
});

const STORAGE_KEY = "tenant_notif_last_seen";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const fetchAndCheck = useCallback(() => {
    if (!user) return;

    const lastSeen = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);

    billAPI
      .getMyBills()
      .then((r) => {
        const bills = r.data ?? [];
        // มีบิล pending/overdue ที่สร้างหลัง lastSeen ไหม
        const hasNew = bills.some((b: any) => {
          if (b.status !== "pending" && b.status !== "overdue") return false;
          const createdAt = new Date(b.created_at || b.due_date || 0);
          return createdAt > lastSeenDate;
        });
        setHasUnread(hasNew);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchAndCheck();
  }, [fetchAndCheck]);

  const markAsRead = useCallback(() => {
    if (!user) return;
    localStorage.setItem(`${STORAGE_KEY}_${user.id}`, new Date().toISOString());
    setHasUnread(false);
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{ hasUnread, markAsRead, refresh: fetchAndCheck }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
