//admin/notifications/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { useAdminNotification } from "@/context/admin-notification-context";
import {
  buildAdminNotifications,
  loadActions,
  saveActions,
  NotificationItem,
} from "@/lib/notifications";

const typeEmoji: Record<string, string> = {
  maintenance: "🔧",
  payment: "💳",
  moveout: "🚪",
};

const typeColors: Record<string, string> = {
  maintenance: "bg-warning/20 text-warning",
  payment: "bg-info/20 text-info",
  moveout: "bg-purple-500/20 text-purple-400",
};

export default function AdminNotificationsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { refresh: refreshBell } = useAdminNotification();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    buildAdminNotifications(user.id, fmtDate, {
      newMaintenance: t("notifications.newMaintenance"),
      pendingPayment: t("notifications.pendingPayment"),
      newMoveOut: t("notifications.newMoveOut"),
      room: t("tenant.myRoom"),
    })
      .then((items) => setNotifications(items))
      .finally(() => setLoading(false));
  }, [language, user]);

  const markRead = (id: string) => {
    setNotifications((p) =>
      p.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    if (user) {
      const actions = loadActions(user.id);
      actions[id] = "read";
      saveActions(user.id, actions);
      refreshBell();
    }
  };

  const remove = (id: string) => {
    setNotifications((p) => p.filter((n) => n.id !== id));
    if (user) {
      const actions = loadActions(user.id);
      actions[id] = "deleted";
      saveActions(user.id, actions);
      refreshBell();
    }
  };

  const markAllRead = () => {
    setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
    if (user) {
      const actions = loadActions(user.id);
      notifications
        .filter((n) => !n.isRead)
        .forEach((n) => {
          actions[n.id] = "read";
        });
      saveActions(user.id, actions);
      refreshBell();
    }
  };

  // คลิกที่การ์ด — mark read แล้วเด้งไปหน้าที่เกี่ยวข้อง
  const handleCardClick = (n: NotificationItem) => {
    markRead(n.id);
    router.push(n.href);
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("notifications.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {unread} {t("notifications.unread")}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            onClick={markAllRead}
            className="w-full sm:w-auto"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {t("notifications.markAll")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">{t("notifications.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleCardClick(n)}
              className={`flex gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
                n.isRead
                  ? "bg-card/50 border-border"
                  : "bg-primary/5 border-primary/30"
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${typeColors[n.type]}`}
              >
                {typeEmoji[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">
                  {n.title}
                  {!n.isRead && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {t("notifications.new")}
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {n.message}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {n.timestamp}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead(n.id);
                    }}
                    className="text-primary min-w-[40px] min-h-[40px] p-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  className="text-destructive hover:text-destructive min-w-[40px] min-h-[40px] p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
