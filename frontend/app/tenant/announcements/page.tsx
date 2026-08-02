//app/tenant/announcements/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Bell, Pin, Calendar, Loader2 } from "lucide-react";
import { announcementAPI } from "@/lib/api/announcement.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  target_audience: string;
  target_floor: number | null;
  is_pinned: number;
  published_at: string;
  expires_at: string | null;
}

export default function TenantAnnouncementsPage() {
  const { t, language } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    announcementAPI
      .getAll()
      .then((r) => setAnnouncements(r.data ?? []))
      .catch((err) => {
        // 404 = ยังไม่มีประกาศ — ไม่ต้อง toast
        if (err?.response?.status !== 404) {
          toast.error(t("common.noData"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pinned = filtered.filter((a) => a.is_pinned === 1);
  const others = filtered.filter((a) => a.is_pinned !== 1);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const isExpired = (a: Announcement) =>
    a.expires_at ? new Date(a.expires_at) < new Date() : false;

  const AnnouncementCard = ({
    ann,
    highlight,
  }: {
    ann: Announcement;
    highlight?: boolean;
  }) => (
    <Card
      className={`${highlight ? "border-primary/50 bg-primary/5" : ""} ${isExpired(ann) ? "opacity-50" : ""}`}
    >
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {ann.is_pinned === 1 && <Pin className="h-4 w-4 text-primary" />}
              <h3 className={`font-bold ${highlight ? "text-lg" : ""}`}>
                {ann.title}
              </h3>
            </div>
            {ann.target_floor && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {t("announcements.floor")} {ann.target_floor}
              </span>
            )}
          </div>
          {isExpired(ann) && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded flex-shrink-0">
              {t("status.expired")}
            </span>
          )}
        </div>
        <p
          className={`text-muted-foreground leading-relaxed ${highlight ? "" : "text-sm"}`}
        >
          {ann.content}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(ann.published_at)}
          </span>
          {ann.expires_at && (
            <span>
              {t("announcements.expires")} {formatDate(ann.expires_at)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("announcements.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("announcements.subtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <Pin className="h-4 w-4" />
                {t("announcements.important")}
              </h2>
              {pinned.map((a) => (
                <AnnouncementCard key={a.announcement_id} ann={a} highlight />
              ))}
            </div>
          )}
          {others.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t("announcements.others")}
              </h2>
              {others.map((a) => (
                <AnnouncementCard key={a.announcement_id} ann={a} />
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="pt-10 text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {t("announcements.empty")}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
