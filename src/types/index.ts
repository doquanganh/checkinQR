export type Role = 'ADMIN' | 'CHECKIN_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

export type EventStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export interface EventItem {
  id: string;
  event_code: string;
  event_name: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export type GuestStatus = 'ACTIVE' | 'DISABLED';

export interface Guest {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  organization: string;
  title: string;
  notes: string;
  status: GuestStatus;
  created_at: string;
  updated_at: string;
}

export type InvitationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
export type CheckinStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN';

export interface EventGuest {
  id: string;
  event_id: string;
  guest_id: string;
  guest_code: string;
  qr_token: string;
  invitation_status: InvitationStatus;
  invited_at: string | null;
  checkin_status: CheckinStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checkin_device_id?: string | null;
  created_at: string;
  updated_at: string;
  // Denormalized guest info for fast lookup & display
  guest?: Guest;
}

export type CheckinResult =
  | 'SUCCESS'
  | 'ALREADY_CHECKED_IN'
  | 'INVALID_QR'
  | 'WRONG_EVENT'
  | 'GUEST_INACTIVE'
  | 'ERROR';

export interface CheckinLog {
  id: string;
  event_id: string;
  event_guest_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  guest_org: string | null;
  qr_token: string;
  action: 'CHECK_IN' | 'VERIFY';
  result: CheckinResult;
  message: string;
  device_id: string;
  staff_id: string;
  staff_name: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  event_id: string;
  subject: string;
  body: string;
  sender_name: string;
  sender_email: string;
}

export interface CheckinStats {
  total_guests: number;
  checked_in_count: number;
  not_checked_in_count: number;
  checkin_percentage: number;
  invited_count: number;
  pending_invitation_count: number;
  invitation_percentage: number;
  recent_checkins_hourly: { hour: string; count: number }[];
  organization_breakdown: { name: string; total: number; checked_in: number }[];
}

export interface CheckinRequest {
  event_id: string;
  qr_token: string;
  staff_id: string;
  staff_name: string;
  device_id: string;
}

export interface CheckinResponse {
  success: boolean;
  status: CheckinResult;
  message: string;
  guest?: {
    id: string;
    code: string;
    name: string;
    organization: string;
    title: string;
    email: string;
    phone: string;
    notes?: string;
  };
  checked_in_at?: string;
  checked_in_by?: string;
  duration_ms?: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  fromName: string;
  fromEmail: string;
  isConfigured: boolean;
}
