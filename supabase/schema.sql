-- =================================================================================
-- HỆ THỐNG QUẢN LÝ DỰ ÁN – NHÂN SỰ – TÀI CHÍNH – CHẤM CÔNG (ERP)
-- SUPABASE POSTGRESQL SCHEMA HOÀN CHỈNH (KHÔNG CHỨA DỮ LIỆU ẢO)
-- Hướng dẫn: Sao chép toàn bộ nội dung file này vào mục SQL Editor trên Supabase
-- và nhấn "Run" để khởi tạo toàn bộ 30 bảng, Ràng buộc, Trigger và Cấu hình gốc.
-- =================================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BẢNG VAI TRÒ (ROLES) - Mục 11.1 & 11.2
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  data_scope TEXT NOT NULL DEFAULT 'personal' CHECK (data_scope IN ('system', 'department', 'team', 'personal')),
  hidden_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BẢNG QUYỀN THEO VAI TRÒ (ROLE_PERMISSIONS) - Mục 11.3 & 11.5
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  can_upload BOOLEAN NOT NULL DEFAULT false,
  can_confirm_tx BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, module_code)
);

-- 3. BẢNG PHÒNG BAN (DEPARTMENTS) - Mục 7.2
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  manager_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. BẢNG NHÓM (TEAMS) - Mục 7.2
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  leader_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. BẢNG CA LÀM VIỆC (SHIFTS) - Mục 8.2
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:30',
  end_time TIME NOT NULL DEFAULT '17:30',
  break_minutes INTEGER NOT NULL DEFAULT 60,
  grace_late_minutes INTEGER NOT NULL DEFAULT 15,
  work_day_ratio NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. BẢNG HỒ SƠ NHÂN VIÊN (EMPLOYEES) - Mục 7.1
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT UNIQUE,
  address TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  position TEXT NOT NULL DEFAULT 'Nhân viên',
  role_code TEXT NOT NULL DEFAULT 'sale',
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_type TEXT NOT NULL DEFAULT 'Chính thức',
  work_status TEXT NOT NULL DEFAULT 'Đang làm việc' CHECK (work_status IN ('Đang làm việc', 'Thử việc', 'Nghỉ thai sản', 'Tạm nghỉ', 'Đã nghỉ việc')),
  base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  default_allowance NUMERIC(18,2) NOT NULL DEFAULT 0,
  salary_formula_type TEXT NOT NULL DEFAULT 'standard_day' CHECK (salary_formula_type IN ('standard_day', 'fixed_month')),
  monthly_kpi_target NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. BẢNG TÀI KHOẢN ĐĂNG NHẬP (USERS) - Mục 11.6
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. BẢNG QUYỀN RIÊNG TÀI KHOẢN (USER_PERMISSIONS) - Mục 11.6
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN,
  can_approve BOOLEAN,
  can_export BOOLEAN,
  can_upload BOOLEAN,
  can_confirm_tx BOOLEAN,
  UNIQUE(user_id, module_code)
);

-- 9. BẢNG LỊCH SỬ ĐIỀU CHUYỂN NHÂN SỰ (EMPLOYEE_TRANSFERS) - Mục 7.2
CREATE TABLE IF NOT EXISTS public.employee_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  from_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  from_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. BẢNG KHÁCH HÀNG (CUSTOMERS) - Phần 3
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_code TEXT,
  customer_type TEXT NOT NULL DEFAULT 'Doanh nghiệp',
  sale_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. BẢNG LỊCH SỬ CHĂM SÓC KHÁCH HÀNG (CUSTOMER_CARE_LOGS) - Mục 3.2
CREATE TABLE IF NOT EXISTS public.customer_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  care_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'Điện thoại',
  content TEXT NOT NULL,
  staff_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. BẢNG DỰ ÁN (PROJECTS) - Phần 2 & Phần 4
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  notes TEXT,
  page_count INTEGER NOT NULL DEFAULT 1,
  job_type TEXT NOT NULL DEFAULT 'HSNL',
  -- Nhóm B: Hợp đồng & Doanh thu
  tax_input_mode TEXT NOT NULL DEFAULT 'before_tax' CHECK (tax_input_mode IN ('before_tax', 'after_tax')),
  revenue_before_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  revenue_after_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  contract_sign_date DATE,
  contract_number TEXT,
  contract_status TEXT NOT NULL DEFAULT 'Nháp' CHECK (contract_status IN ('Nháp', 'Chờ ký', 'Đã ký', 'Điều chỉnh', 'Hủy')),
  -- Nhóm C: Nhân sự phụ trách (Quy tắc 4: 1 Sale chính & 1 Designer chính)
  sale_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  team_leader_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_date DATE DEFAULT CURRENT_DATE,
  -- Nhóm D: Tiến độ
  priority TEXT NOT NULL DEFAULT 'Trung bình' CHECK (priority IN ('Thấp', 'Trung bình', 'Cao', 'Khẩn cấp')),
  status TEXT NOT NULL DEFAULT 'Chờ tiếp nhận',
  received_date DATE DEFAULT CURRENT_DATE,
  start_date DATE,
  deadline DATE,
  completed_date DATE,
  handover_date DATE,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  progress_notes TEXT,
  -- Kiểm soát lưu trữ (Quy tắc 10)
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. BẢNG LỊCH SỬ PHÂN CÔNG & BÀN GIAO NHÂN SỰ DỰ ÁN (PROJECT_ASSIGNMENTS) - Mục 2.2 Nhóm C
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('Sale', 'Designer', 'Trưởng nhóm')),
  old_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  new_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  changed_by TEXT
);

-- 14. BẢNG HỢP ĐỒNG (CONTRACTS) - Mục 14.2
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  sign_date DATE,
  amount_before_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_after_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Đã ký',
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. BẢNG LỊCH SỬ ĐIỀU CHỈNH HỢP ĐỒNG (CONTRACT_REVISIONS) - Mục 4.4
CREATE TABLE IF NOT EXISTS public.contract_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  old_before_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  new_before_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  old_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  new_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  old_after_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  new_after_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  old_status TEXT,
  new_status TEXT,
  reason TEXT NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. BẢNG CÁC KHOẢN THỰC THU (PAYMENTS) - Mục 4.2
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  installment_name TEXT NOT NULL DEFAULT 'Đợt 1',
  amount NUMERIC(18,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Chuyển khoản',
  receiving_account TEXT,
  bank_tx_code TEXT,
  attachment_url TEXT,
  updated_by TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Chờ xác nhận' CHECK (status IN ('Chờ xác nhận', 'Đã xác nhận', 'Hủy', 'Hoàn tiền/Điều chỉnh')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. BẢNG DANH MỤC CHI PHÍ (EXPENSE_CATEGORIES) - Mục 5.2
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  expense_scope TEXT NOT NULL DEFAULT 'project' CHECK (expense_scope IN ('project', 'general', 'hr', 'marketing', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. BẢNG CHI PHÍ DỰ ÁN & CHI PHÍ CHUNG (EXPENSES) - Phần 5
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_code TEXT UNIQUE NOT NULL,
  expense_scope TEXT NOT NULL DEFAULT 'project' CHECK (expense_scope IN ('project', 'general', 'hr', 'marketing', 'other')),
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category_name TEXT NOT NULL,
  amount_before_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_after_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_vat_deductible BOOLEAN NOT NULL DEFAULT true,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  proposer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  proposer_name TEXT,
  approver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approver_name TEXT,
  recipient_name TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK (status IN ('Nháp', 'Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Chờ thanh toán', 'Đã thanh toán', 'Hủy')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. BẢNG LỊCH SỬ DUYỆT CHI PHÍ (EXPENSE_APPROVALS) - Mục 5.3
CREATE TABLE IF NOT EXISTS public.expense_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  actor_name TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. BẢNG PHÂN BỔ CHI PHÍ CHUNG & NHÂN SỰ (COST_ALLOCATIONS) - Mục 5.4 & 6.2
CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL DEFAULT 'general' CHECK (cost_type IN ('general', 'hr')),
  allocation_method TEXT NOT NULL CHECK (allocation_method IN ('revenue_ratio', 'work_hours', 'project_count', 'fixed_ratio', 'manual')),
  allocation_ratio NUMERIC(8,4) NOT NULL DEFAULT 0,
  allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. BẢNG TIẾN ĐỘ CÔNG VIỆC DỰ ÁN (WORK_LOGS) - Mục 2.3 Tab 5
CREATE TABLE IF NOT EXISTS public.work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status_after TEXT,
  work_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  note TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 22. BẢNG FILE TÀI LIỆU DỰ ÁN (PROJECT_FILES) - Mục 2.3 Tab 7
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_category TEXT NOT NULL DEFAULT 'File thiết kế' CHECK (file_category IN ('Hợp đồng', 'Nội dung khách hàng', 'Logo & Brand', 'Hình ảnh', 'File thiết kế', 'File bàn giao', 'Khác')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 23. BẢNG CHẤM CÔNG VÀO / RA (ATTENDANCE) - Mục 8.1 & 8.3
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  device_info TEXT DEFAULT 'Web Browser',
  method TEXT NOT NULL DEFAULT 'Web' CHECK (method IN ('Web', 'Điện thoại', 'QR Code', 'GPS')),
  gps_location TEXT,
  ip_address TEXT,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  work_day_credit NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  explanation_reason TEXT,
  explanation_status TEXT CHECK (explanation_status IN ('Chờ duyệt', 'Đã duyệt', 'Từ chối')),
  approved_by TEXT,
  adjustment_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

-- 24. BẢNG ĐƠN NGHỈ PHÉP (LEAVE_REQUESTS) - Mục 8.4
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Nghỉ phép năm', 'Nghỉ không lương', 'Nghỉ ốm', 'Nghỉ việc riêng', 'Nghỉ chế độ', 'Nghỉ khác')),
  is_paid BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL DEFAULT 1.0,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  approver_name TEXT,
  status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK (status IN ('Chờ duyệt', 'Đã duyệt', 'Từ chối')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 25. BẢNG ĐƠN ĐĂNG KÝ TĂNG CA (OVERTIME_REQUESTS) - Mục 8.5
CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  overtime_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  overtime_type TEXT NOT NULL DEFAULT 'Ngày thường' CHECK (overtime_type IN ('Ngày thường', 'Ngày nghỉ hàng tuần', 'Ngày lễ, Tết')),
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  reason TEXT NOT NULL,
  approver_name TEXT,
  status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK (status IN ('Chờ duyệt', 'Đã duyệt', 'Từ chối')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 26. BẢNG LƯƠNG THÁNG (PAYROLL) - Phần 9
CREATE TABLE IF NOT EXISTS public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_code TEXT UNIQUE NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  standard_work_days NUMERIC(4,1) NOT NULL DEFAULT 26.0,
  status TEXT NOT NULL DEFAULT 'Nháp' CHECK (status IN ('Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã khóa')),
  created_by TEXT,
  approved_by TEXT,
  locked_at TIMESTAMPTZ,
  unlock_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- 27. BẢNG CHI TIẾT LƯƠNG NHÂN VIÊN (PAYROLL_DETAILS) - Mục 9.1 & 9.2
CREATE TABLE IF NOT EXISTS public.payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  standard_days NUMERIC(4,1) NOT NULL DEFAULT 26.0,
  actual_work_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  paid_leave_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  unpaid_leave_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  salary_by_workdays NUMERIC(18,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(18,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(18,2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
  valid_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
  insurance_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_id, employee_id)
);

-- 28. BẢNG CẤU HÌNH HỆ THỐNG ĐỘNG (SYSTEM_SETTINGS) - Phần 19
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 29. BẢNG THÔNG BÁO TỰ ĐỘNG (NOTIFICATIONS) - Mục 12.1
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  recipient_employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 30. BẢNG NHẬT KÝ HỆ THỐNG (AUDIT_LOGS) - Mục 12.2
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action_module TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_or_device TEXT DEFAULT 'Web Client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================================
-- CẤU HÌNH ROW LEVEL SECURITY (RLS) CHO PHÉP CLIENT TRUY CẬP QUA SUPABASE API
-- =================================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_authenticated_and_anon_%I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "allow_all_authenticated_and_anon_%I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END;
$$;

-- =================================================================================
-- KHỞI TẠO CẤU HÌNH DANH MỤC HỆ THỐNG GỐC (KHÔNG TẠO DỮ LIỆU GIAO DỊCH ẢO)
-- =================================================================================

-- Khởi tạo 8 Vai trò mặc định theo đúng Mục 11.1 & 11.5 tài liệu đặc tả
INSERT INTO public.roles (code, name, data_scope, hidden_fields, description, is_system) VALUES
  ('super_admin', 'Super Admin', 'system', '[]'::jsonb, 'Toàn quyền quản trị hệ thống và phân quyền', true),
  ('admin', 'Admin', 'system', '[]'::jsonb, 'Quản trị toàn bộ hệ thống', true),
  ('director', 'Giám đốc', 'system', '[]'::jsonb, 'Ban giám đốc xem toàn bộ công ty, duyệt chi phí và lương', true),
  ('dept_manager', 'Trưởng phòng', 'department', '[]'::jsonb, 'Quản lý dữ liệu trong phạm vi phòng ban', true),
  ('team_leader', 'Trưởng nhóm', 'team', '["base_salary"]'::jsonb, 'Quản lý dự án và nhân sự trong phạm vi nhóm', true),
  ('sale', 'Sale', 'personal', '["other_salary"]'::jsonb, 'Quản lý khách hàng, hợp đồng và dự án mình phụ trách', true),
  ('designer', 'Designer', 'personal', '["revenue_before_tax", "revenue_after_tax", "vat_amount", "payments", "debt", "profit", "other_salary"]'::jsonb, 'Thực hiện thiết kế, cập nhật tiến độ dự án được giao', true),
  ('accountant', 'Kế toán', 'system', '[]'::jsonb, 'Quản lý hợp đồng, xác nhận thực thu, công nợ, chi phí và bảng lương', true)
ON CONFLICT (code) DO NOTHING;

-- Khởi tạo Ca hành chính mặc định theo Mục 8.2 (08:30 - 17:30, nghỉ trưa 60 phút)
INSERT INTO public.shifts (code, name, start_time, end_time, break_minutes, grace_late_minutes, work_day_ratio) VALUES
  ('HC_01', 'Ca hành chính (08:30 - 17:30)', '08:30', '17:30', 60, 15, 1.0)
ON CONFLICT (code) DO NOTHING;

-- Khởi tạo Danh mục chi phí chuẩn theo Mục 5.2 & 5.4
INSERT INTO public.expense_categories (code, name, expense_scope) VALUES
  ('CP_DA_01', 'Thuê Designer ngoài', 'project'),
  ('CP_DA_02', 'Thuê cộng tác viên', 'project'),
  ('CP_DA_03', 'Mua tài nguyên thiết kế', 'project'),
  ('CP_DA_04', 'Chi phí hình ảnh', 'project'),
  ('CP_DA_05', 'Chi phí in ấn', 'project'),
  ('CP_DA_06', 'Chi phí vận chuyển', 'project'),
  ('CP_DA_07', 'Chi phí phát sinh theo yêu cầu khách hàng', 'project'),
  ('CP_DA_08', 'Chi phí dự án khác', 'project'),
  ('CP_VH_01', 'Tiền thuê văn phòng', 'general'),
  ('CP_VH_02', 'Điện, nước, Internet', 'general'),
  ('CP_VH_03', 'Phần mềm & Bản quyền', 'general'),
  ('CP_VH_04', 'Chi phí Marketing', 'marketing'),
  ('CP_VH_05', 'Chi phí quản lý & vận hành khác', 'general')
ON CONFLICT (code) DO NOTHING;

-- Khởi tạo Cấu hình hệ thống động theo Mục 2.2 & Phần 19
INSERT INTO public.system_settings (key, value, description) VALUES
  ('project_statuses', '["Chờ tiếp nhận", "Đang lên ý tưởng", "Đang thiết kế", "Chờ khách phản hồi", "Đang chỉnh sửa", "Chờ duyệt", "Hoàn thành", "Đã bàn giao", "Tạm dừng", "Hủy dự án"]'::jsonb, 'Danh sách trạng thái dự án (Mục 2.2)'),
  ('job_types', '["HSNL", "Brochure", "Banner", "Website", "Catalogue", "Logo & Branding", "Bao bì", "Profile", "Khác"]'::jsonb, 'Danh sách loại JOB thiết kế (Mục 2.2)'),
  ('default_vat_rate', '8'::jsonb, 'Thuế suất VAT mặc định (%)'),
  ('standard_work_days', '26'::jsonb, 'Số ngày công chuẩn trong tháng'),
  ('handover_revenue_rule', '"keep_current_PIC"'::jsonb, 'Quy tắc ghi nhận doanh thu khi chuyển giao Sale/Designer')
ON CONFLICT (key) DO NOTHING;
