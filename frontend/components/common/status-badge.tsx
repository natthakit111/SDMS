//common/status-badge.tsx

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

type StatusVariant =
  | "success"
  | "warning"
  | "destructive"
  | "default"
  | "secondary"
  | "outline";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

// Room status
export function RoomStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    available: { labelKey: "status.available", variant: "success" },
    occupied: { labelKey: "status.occupied", variant: "default" },
    maintenance: { labelKey: "status.maintenance", variant: "warning" },
    reserved: { labelKey: "status.reserved", variant: "secondary" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Bill status
export function BillStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    pending: { labelKey: "status.pending", variant: "warning" },
    paid: { labelKey: "status.paid", variant: "success" },
    overdue: { labelKey: "status.overdue", variant: "destructive" },
    partial: { labelKey: "status.partial", variant: "secondary" },
    cancelled: { labelKey: "status.cancelled", variant: "secondary" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Payment status
export function PaymentStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    pending_verify: { labelKey: "status.pending_verify", variant: "warning" },
    pending: { labelKey: "status.pending_verify", variant: "warning" },
    verified: { labelKey: "status.verified", variant: "success" },
    rejected: { labelKey: "status.rejected", variant: "destructive" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Maintenance status
export function MaintenanceStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    pending: { labelKey: "status.pending", variant: "warning" },
    in_progress: { labelKey: "status.in_progress", variant: "default" },
    resolved: { labelKey: "status.resolved", variant: "success" },
    completed: { labelKey: "status.resolved", variant: "success" },
    cancelled: { labelKey: "status.cancelled", variant: "destructive" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Priority badge
export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    low: { labelKey: "priority.low", variant: "secondary" },
    medium: { labelKey: "priority.medium", variant: "default" },
    high: { labelKey: "priority.high", variant: "warning" },
    urgent: { labelKey: "priority.urgent", variant: "destructive" },
  };
  const { labelKey, variant } = config[priority] || {
    labelKey: priority,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? priority : t(labelKey)}
      variant={variant}
    />
  );
}

// Contract status
export function ContractStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    active: { labelKey: "status.active", variant: "success" },
    expired: { labelKey: "status.expired", variant: "destructive" },
    terminated: { labelKey: "status.terminated", variant: "secondary" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Tenant status
export function TenantStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { labelKey: string; variant: StatusVariant }> = {
    active: { labelKey: "tenant.status.active", variant: "success" },
    pending: { labelKey: "tenant.status.pending", variant: "warning" },
    moved_out: { labelKey: "tenant.status.moved_out", variant: "secondary" },
  };
  const { labelKey, variant } = config[status] || {
    labelKey: status,
    variant: "default" as StatusVariant,
  };
  return (
    <StatusBadge
      status={t(labelKey) === labelKey ? status : t(labelKey)}
      variant={variant}
    />
  );
}

// Base status badge component
export function StatusBadge({
  status,
  variant = "default",
  className,
}: StatusBadgeProps) {
  const variantStyles: Record<StatusVariant, string> = {
    success: "bg-success/20 text-success hover:bg-success/30 border-success/30",
    warning:
      "bg-warning/20 text-warning-foreground hover:bg-warning/30 border-warning/30",
    destructive:
      "bg-destructive/20 text-destructive hover:bg-destructive/30 border-destructive/30",
    default: "bg-primary/20 text-primary hover:bg-primary/30 border-primary/30",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-border bg-transparent",
  };

  return (
    <Badge
      variant="outline"
      className={cn("font-medium border", variantStyles[variant], className)}
    >
      {status}
    </Badge>
  );
}

export default StatusBadge;
