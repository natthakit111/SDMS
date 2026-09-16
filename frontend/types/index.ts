// frontend/types/index.ts
// Shared API/domain types — field names mirror the columns + joined aliases
// returned by the backend models (backend/src/models/*.model.js) exactly.

export interface Room {
  room_id: number;
  room_number: string;
  floor: number;
  room_type: string;
  area_sqm: number | null;
  base_rent: number;
  status: "available" | "occupied" | "maintenance";
  description: string | null;
  created_at: string;
  updated_at: string;
  tenant_name?: string;
}

export interface Contract {
  contract_id: number;
  tenant_id: number;
  room_id: number;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: "active" | "expired" | "terminated";
  contract_file: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined fields (contract.model.js findAll/findById)
  tenant_name?: string;
  tenant_phone?: string;
  id_card_number?: string;
  room_number?: string;
  floor?: number;
  base_rent?: number;
  deposit_status?: "holding" | "refunded";
  deposit_refund_amount?: number | null;
  deposit_deduction?: number | null;
  deposit_deduction_note?: string | null;
  deposit_refund_date?: string | null;
  tenant_id_card?: string;
}

export interface MoveOutRequest {
  request_id: number;
  tenant_id: number;
  contract_id: number;
  room_id: number;
  move_out_date: string;
  actual_move_out_date: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  // joined fields (moveOut.model.js BASE_SELECT)
  first_name?: string;
  last_name?: string;
  room_number?: string;
}

export interface Reading {
  reading_id: number;
  room_id: number;
  meter_type: "electric" | "water";
  reading_month: number;
  reading_year: number;
  previous_unit: number;
  current_unit: number;
  units_used: number;
  rate_per_unit: number;
  image_path: string | null;
  recorded_by: number | null;
  recorded_at: string;
  // joined field (meter.model.js findAll/findById)
  room_number?: string;
}

export interface Bill {
  bill_id: number;
  contract_id: number;
  room_id: number;
  bill_month: number;
  bill_year: number;
  rent_amount: number;
  electric_amount: number;
  water_amount: number;
  other_amount: number;
  total_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  qr_payload: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined fields (bill.model.js findAll/findById/findByTenantId)
  room_number?: string;
  floor?: number;
  tenant_name?: string;
  tenant_phone?: string;
  tenant_id?: number;
}

export interface Payment {
  payment_id: number;
  bill_id: number;
  tenant_id: number;
  amount_paid: number;
  payment_method: "qr_promptpay" | "cash" | "bank_transfer";
  slip_image: string | null;
  paid_at: string;
  verified_by: number | null;
  verified_at: string | null;
  status: "pending_verify" | "verified" | "rejected";
  remark: string | null;
  // joined fields (payment.model.js findAll/findById)
  bill_month?: number;
  bill_year?: number;
  bill_total?: number;
  bill_status?: string;
  room_number?: string;
  tenant_name?: string;
  verified_by_name?: string;
}

export interface MaintenanceRequest {
  request_id: number;
  tenant_id: number;
  room_id: number;
  category: string;
  description: string;
  image_path: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "resolved" | "cancelled";
  assigned_to_user_id: number | null;
  assigned_technician_name: string | null;
  resolved_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // joined fields (maintenance.model.js findAll/findById/findByTenantId)
  room_number?: string;
  tenant_name?: string;
  tenant_phone?: string;
  assigned_username?: string;
}

export interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  target_audience: "all" | "admin" | "tenant";
  target_floor: number | null;
  is_pinned: number;
  is_urgent: number;
  published_by: number;
  published_at: string;
  expires_at: string | null;
  // joined field (announcement.model.js findAll/findById)
  published_by_name?: string;
}
