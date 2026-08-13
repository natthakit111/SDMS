import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: StatsCardProps) {
  const { t } = useLanguage();

  const variantStyles = {
    default: "bg-card",
    primary: "bg-primary/10 border-primary/20",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    destructive: "bg-destructive/10 border-destructive/20",
  };

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/20 text-destructive",
  };

  return (
    <Card className={cn("transition-colors", variantStyles[variant])}>
      {/* ✅ p-4 บนมือถือ → p-6 บน sm ขึ้นไป ลดความอึดอัดบนจอแคบ */}
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          {/* ✅ min-w-0 กัน text ดันจนล้น / space-y ลดลงบนมือถือ */}
          <div className="min-w-0 space-y-1 sm:space-y-2">
            {/* ✅ title ตัดบรรทัดเดียว + ขนาดเล็กลงบนมือถือ */}
            <p className="truncate text-xs sm:text-sm text-muted-foreground">
              {title}
            </p>
            {/* ✅ ตัวเลขหลัก: text-2xl บนมือถือ → text-3xl บน sm ขึ้นไป */}
            <p className="text-2xl sm:text-3xl font-bold leading-tight">
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend.isPositive ? "text-success" : "text-destructive",
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}% {t("common.fromLastMonth")}
              </p>
            )}
          </div>
          {/* ✅ icon box: p-2 + ไอคอน h-5 บนมือถือ → p-3 + h-6 บน sm, shrink-0 กันบีบ */}
          <div
            className={cn(
              "shrink-0 rounded-lg p-2 sm:p-3",
              iconStyles[variant],
            )}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
