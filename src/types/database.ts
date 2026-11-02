export type DataScope = 'system' | 'department' | 'team' | 'personal';

export interface Role {
  id: string;
  code: string;
  name: string;
  data_scope: DataScope;
  hidden_fields: string[];
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  can_upload: boolean;
  can_confirm_tx: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  manager_id: string | null;
  description?: string;
  created_at: string;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  department_id: string | null;
  leader_id: string | null;
  description?: string;
  created_at: string;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_late_minutes: number;
  work_day_ratio: number;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  avatar_url?: string;
  birth_date?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  department_id: string | null;
  team_id: string | null;
  shift_id: string | null;
  position: string;
  role_code: string;
  hire_date: string;
  contract_type: string;
  work_status: 'Đang làm việc' | 'Thử việc' | 'Nghỉ thai sản' | 'Tạm nghỉ' | 'Đã nghỉ việc';
  base_salary: number;
  default_allowance: number;
  salary_formula_type: 'standard_day' | 'fixed_month';
  monthly_kpi_target: number;
  created_at: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  employee_id: string | null;
  role_id: string | null;
  is_locked: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface EmployeeTransfer {
  id: string;
  employee_id: string;
  from_department_id: string | null;
  to_department_id: string | null;
  from_team_id: string | null;
  to_team_id: string | null;
  transfer_date: string;
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_code?: string;
  customer_type: string;
  sale_id: string | null;
  source?: string;
  notes?: string;
  created_at: string;
}

export interface CustomerCareLog {
  id: string;
  customer_id: string;
  care_date: string;
  channel: string;
  content: string;
  staff_name?: string;
  created_at: string;
}

export type ContractStatus = 'Nháp' | 'Chờ ký' | 'Đã ký' | 'Điều chỉnh' | 'Hủy';
export type PriorityLevel = 'Thấp' | 'Trung bình' | 'Cao' | 'Khẩn cấp';

export interface Project {
  id: string;
  project_code: string;
  name: string;
  customer_id: string | null;
  notes?: string;
  page_count: number;
  job_type: string;
  tax_input_mode: 'before_tax' | 'after_tax';
  revenue_before_tax: number;
  vat_rate: number;
  vat_amount: number;
  revenue_after_tax: number;
  contract_sign_date?: string | null;
  contract_number?: string;
  contract_status: ContractStatus;
  sale_id: string | null;
  designer_id: string | null;
  team_leader_id: string | null;
  department_id: string | null;
  assigned_date?: string | null;
  priority: PriorityLevel;
  status: string;
  received_date?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  completed_date?: string | null;
  handover_date?: string | null;
  progress_percent: number;
  progress_notes?: string;
  is_archived: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  role_type: 'Sale' | 'Designer' | 'Trưởng nhóm';
  old_employee_id: string | null;
  new_employee_id: string | null;
  assigned_at: string;
  note?: string;
  changed_by?: string;
}

export interface ContractRevision {
  id: string;
  project_id: string;
  old_before_tax: number;
  new_before_tax: number;
  old_vat_rate: number;
  new_vat_rate: number;
  old_after_tax: number;
  new_after_tax: number;
  old_status?: string;
  new_status?: string;
  reason: string;
  changed_by?: string;
  created_at: string;
}

export type PaymentStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Hủy' | 'Hoàn tiền/Điều chỉnh';

export interface Payment {
  id: string;
  transaction_code: string;
  project_id: string;
  installment_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receiving_account?: string;
  bank_tx_code?: string;
  attachment_url?: string;
  updated_by?: string;
  confirmed_by?: string;
  confirmed_at?: string | null;
  status: PaymentStatus;
  notes?: string;
  created_at: string;
}

export type ExpenseScope = 'project' | 'general' | 'hr' | 'marketing' | 'other';
export type ExpenseStatus = 'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | 'Chờ thanh toán' | 'Đã thanh toán' | 'Hủy';

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  expense_scope: ExpenseScope;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_code: string;
  expense_scope: ExpenseScope;
  project_id: string | null;
  title: string;
  category_name: string;
  amount_before_tax: number;
  vat_rate: number;
  vat_amount: number;
  amount_after_tax: number;
  is_vat_deductible: boolean;
  expense_date: string;
  proposer_id: string | null;
  proposer_name?: string;
  approver_id: string | null;
  approver_name?: string;
  recipient_name?: string;
  attachment_url?: string;
  status: ExpenseStatus;
  notes?: string;
  created_at: string;
}

export type AllocationMethod = 'revenue_ratio' | 'work_hours' | 'project_count' | 'fixed_ratio' | 'manual';

export interface CostAllocation {
  id: string;
  period_month: number;
  period_year: number;
  expense_id: string | null;
  project_id: string;
  cost_type: 'general' | 'hr';
  allocation_method: AllocationMethod;
  allocation_ratio: number;
  allocated_amount: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface WorkLog {
  id: string;
  project_id: string;
  step_name: string;
  progress_percent: number;
  status_after?: string;
  work_hours: number;
  note?: string;
  updated_by?: string;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_category: 'Hợp đồng' | 'Nội dung khách hàng' | 'Logo & Brand' | 'Hình ảnh' | 'File thiết kế' | 'File bàn giao' | 'Khác';
  file_name: string;
  file_url: string;
  file_size?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  shift_id: string | null;
  check_in: string | null;
  check_out: string | null;
  device_info?: string;
  method: 'Web' | 'Điện thoại' | 'QR Code' | 'GPS';
  gps_location?: string;
  ip_address?: string;
  late_minutes: number;
  early_leave_minutes: number;
  work_day_credit: number;
  explanation_reason?: string;
  explanation_status?: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | null;
  approved_by?: string;
  adjustment_log: Array<{
    adjusted_at: string;
    adjusted_by: string;
    old_check_in: string | null;
    new_check_in: string | null;
    old_check_out: string | null;
    new_check_out: string | null;
    reason: string;
  }>;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'Nghỉ phép năm' | 'Nghỉ không lương' | 'Nghỉ ốm' | 'Nghỉ việc riêng' | 'Nghỉ chế độ' | 'Nghỉ khác';
  is_paid: boolean;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url?: string;
  approver_name?: string;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  created_at: string;
}

export interface OvertimeRequest {
  id: string;
  employee_id: string;
  project_id: string | null;
  overtime_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  overtime_type: 'Ngày thường' | 'Ngày nghỉ hàng tuần' | 'Ngày lễ, Tết';
  multiplier: number;
  reason: string;
  approver_name?: string;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  created_at: string;
}

export interface Payroll {
  id: string;
  payroll_code: string;
  month: number;
  year: number;
  standard_work_days: number;
  status: 'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Đã khóa';
  created_by?: string;
  approved_by?: string;
  locked_at?: string | null;
  unlock_history: Array<{
    unlocked_at: string;
    unlocked_by: string;
    reason: string;
  }>;
  created_at: string;
}

export interface PayrollDetail {
  id: string;
  payroll_id: string;
  employee_id: string;
  base_salary: number;
  standard_days: number;
  actual_work_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  late_count: number;
  late_minutes: number;
  overtime_hours: number;
  salary_by_workdays: number;
  allowance: number;
  bonus: number;
  overtime_pay: number;
  valid_deductions: number;
  insurance_tax: number;
  advance_amount: number;
  net_salary: number;
  notes?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  recipient_employee_id: string | null;
  project_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_name: string;
  actor_role?: string;
  action_module: string;
  action_type: string;
  target_id?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_or_device?: string;
  created_at: string;
}
