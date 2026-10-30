export type Role = "super_admin" | "admin" | "employee";
export type TravelType = "flight" | "site_visit" | "other";
export type RequestStatus = "draft" | "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  auth_user_id: string | null;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: Role;
  assigned_admin_id: string | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TravelRequest {
  id: string;
  request_number: string | null;
  employee_id: string;
  assigned_admin_id: string | null;
  employee_name: string;
  employee_code: string;
  employee_department: string | null;
  employee_email: string;
  assigned_admin_name: string | null;
  travel_type: TravelType;
  mobile_number: string | null;
  departure_city: string;
  destination_city: string | null;
  destination_state: string | null;
  destination_country: string | null;
  travel_purpose: string | null;
  travel_description: string | null;
  departure_date: string | null;
  return_date: string | null;
  departure_time: string | null;
  return_time: string | null;
  estimated_expenses: number | null;
  accommodation_required: boolean;
  transportation_required: boolean;
  additional_remarks: string | null;
  additional_notes: string | null;
  status: RequestStatus;
  review_comments: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightDetails {
  id: string;
  travel_request_id: string;
  airline_name: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_datetime: string | null;
  return_flight_number: string | null;
  return_datetime: string | null;
  booking_reference: string | null;
}

export interface SiteVisitDetails {
  id: string;
  travel_request_id: string;
  client_company_name: string | null;
  site_address: string | null;
  site_city: string | null;
  contact_person: string | null;
  contact_number: string | null;
  visit_purpose: string | null;
  expected_duration: string | null;
  additional_notes: string | null;
}

export interface ApprovalHistory {
  id: string;
  travel_request_id: string;
  admin_id: string;
  admin_name: string;
  previous_status: RequestStatus;
  new_status: RequestStatus;
  action: "approved" | "rejected";
  comments: string | null;
  action_timestamp: string;
}

export interface Notification {
  id: string;
  recipient_user_id: string;
  travel_request_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  travel_request_id: string;
  uploaded_by: string;
  document_kind: "flight_ticket" | "supporting";
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  total_admins: number;
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  currently_travelling: number;
  upcoming: number;
  monthly: { month: string; total: number; approved: number; rejected: number; pending: number }[];
  yearly: { year: number; total: number; approved: number }[];
  by_type: { type: TravelType; total: number }[];
  top_destinations: { destination: string; total: number }[];
  employee_frequency: { name: string; code: string; total: number; approved: number }[];
  admin_performance: {
    name: string;
    received: number;
    decided: number;
    approved: number;
    rejected: number;
    pending: number;
    avg_hours: number | null;
  }[];
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
