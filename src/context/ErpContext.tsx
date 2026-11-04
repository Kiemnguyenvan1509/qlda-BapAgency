import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkSupabaseHealth, SupabaseHealthStatus } from '../lib/supabase';
import { apiRequest, setApiActorHeaders } from '../services/apiClient';
import {
  Role,
  RolePermission,
  Department,
  Team,
  Shift,
  Employee,
  UserAccount,
  EmployeeTransfer,
  Customer,
  CustomerCareLog,
  Project,
  ProjectAssignment,
  ContractRevision,
  Payment,
  ExpenseCategory,
  Expense,
  CostAllocation,
  WorkLog,
  ProjectFile,
  AttendanceRecord,
  LeaveRequest,
  OvertimeRequest,
  Payroll,
  PayrollDetail,
  NotificationItem,
  AuditLog,
  ExpenseStatus,
} from '../types/database';

export interface ProjectFinancialSummary {
  revenueBeforeTax: number;
  vatAmount: number;
  revenueAfterTax: number;
  confirmedPayments: number;
  pendingPayments: number;
  remainingDebt: number;
  overpaidAmount: number;
  paymentStatusLabel:
    | 'Chưa thanh toán'
    | 'Đã thanh toán một phần'
    | 'Đã thanh toán đủ'
    | 'Thanh toán thừa'
    | 'Đang đối soát';
  directExpenses: number;
  allocatedGeneralCost: number;
  allocatedHrCost: number;
  totalCost: number;
  grossProfit: number;
  netProfitAfterAllocation: number;
  profitMarginPercent: number;
}

interface ErpContextValue {
  health: SupabaseHealthStatus;
  loading: boolean;
  refreshAll: () => Promise<void>;

  roles: Role[];
  rolePermissions: RolePermission[];
  departments: Department[];
  teams: Team[];
  shifts: Shift[];
  employees: Employee[];
  users: UserAccount[];
  employeeTransfers: EmployeeTransfer[];
  customers: Customer[];
  customerCareLogs: CustomerCareLog[];
  projects: Project[];
  projectAssignments: ProjectAssignment[];
  contractRevisions: ContractRevision[];
  payments: Payment[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  costAllocations: CostAllocation[];
  workLogs: WorkLog[];
  projectFiles: ProjectFile[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  payrolls: Payroll[];
  payrollDetails: PayrollDetail[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];

  projectStatuses: string[];
  jobTypes: string[];
  defaultVatRate: number;
  standardWorkDays: number;
  officeAllowedIps: string[];
  autoSyncOfficeIp: boolean;
  currentClientIp: string;

  currentUser: UserAccount | null;
  currentEmployee: Employee | null;
  currentRole: Role | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  bootstrapFirstAdmin: (payload: {
    fullName: string;
    email: string;
    phone: string;
    username: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  isFieldHidden: (fieldName: string) => boolean;
  canAction: (
    moduleCode: string,
    action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'confirm_tx'
  ) => boolean;
  scopedProjects: Project[];
  scopedEmployees: Employee[];

  getProjectFinancials: (project: Project) => ProjectFinancialSummary;

  createCustomer: (payload: Partial<Customer>) => Promise<{ ok: boolean; error?: string; data?: Customer }>;
  updateCustomer: (id: string, payload: Partial<Customer>) => Promise<{ ok: boolean; error?: string }>;
  deleteCustomer: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addCustomerCareLog: (customerId: string, channel: string, content: string) => Promise<void>;

  createProject: (payload: Partial<Project>) => Promise<{ ok: boolean; error?: string; data?: Project }>;
  updateProject: (id: string, payload: Partial<Project>, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  duplicateProject: (project: Project) => Promise<{ ok: boolean; error?: string }>;
  archiveProject: (id: string, archive: boolean) => Promise<{ ok: boolean; error?: string }>;
  deleteProject: (id: string) => Promise<{ ok: boolean; error?: string }>;
  handoverProjectStaff: (
    projectId: string,
    roleType: 'Sale' | 'Designer' | 'Trưởng nhóm',
    newEmployeeId: string | null,
    note: string
  ) => Promise<{ ok: boolean; error?: string }>;
  adjustProjectContract: (
    projectId: string,
    inputAmount: number,
    vatRate: number,
    mode: 'before_tax' | 'after_tax',
    contractStatus: Project['contract_status'],
    contractNumber: string,
    contractSignDate: string,
    reason: string
  ) => Promise<{ ok: boolean; error?: string }>;
  addWorkLog: (
    projectId: string,
    stepName: string,
    progressPercent: number,
    statusAfter: string,
    workHours: number,
    note: string
  ) => Promise<void>;
  addProjectFile: (
    projectId: string,
    category: ProjectFile['file_category'],
    fileName: string,
    fileUrl: string,
    fileSize?: string
  ) => Promise<void>;

  createPayment: (payload: Partial<Payment>) => Promise<{ ok: boolean; error?: string }>;
  confirmPayment: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelOrRefundPayment: (paymentId: string, reason: string) => Promise<{ ok: boolean; error?: string }>;

  createExpense: (payload: Partial<Expense>) => Promise<{ ok: boolean; error?: string }>;
  updateExpenseStatus: (expenseId: string, newStatus: ExpenseStatus, comment?: string) => Promise<{ ok: boolean; error?: string }>;
  runCostAllocation: (payload: {
    month: number;
    year: number;
    costType: 'general' | 'hr';
    method: CostAllocation['allocation_method'];
    totalAmountToAllocate: number;
    manualMap?: Record<string, number>;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  createDepartment: (
    code: string,
    name: string,
    managerId: string | null,
    description?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  createTeam: (
    code: string,
    name: string,
    departmentId: string | null,
    leaderId: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  createShift: (payload: Partial<Shift>) => Promise<{ ok: boolean; error?: string }>;
  createEmployee: (
    payload: Partial<Employee>,
    accountPayload?: { username: string; password: string; roleId: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  updateEmployee: (id: string, payload: Partial<Employee>) => Promise<{ ok: boolean; error?: string }>;
  deleteEmployee: (id: string) => Promise<{ ok: boolean; error?: string }>;
  transferEmployee: (
    employeeId: string,
    toDeptId: string | null,
    toTeamId: string | null,
    reason: string
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleUserLock: (userId: string, isLocked: boolean) => Promise<void>;

  checkInAttendance: (
    employeeId: string,
    method?: AttendanceRecord['method']
  ) => Promise<{ ok: boolean; error?: string }>;
  checkOutAttendance: (attendanceId: string) => Promise<{ ok: boolean; error?: string }>;
  submitAttendanceExplanation: (attendanceId: string, reason: string) => Promise<{ ok: boolean; error?: string }>;
  approveAttendanceAdjustment: (
    attendanceId: string,
    newCheckIn: string | null,
    newCheckOut: string | null,
    lateMinutes: number,
    earlyLeaveMinutes: number,
    workDayCredit: number,
    approveStatus: 'Đã duyệt' | 'Từ chối',
    reason: string
  ) => Promise<{ ok: boolean; error?: string }>;

  createLeaveRequest: (payload: Partial<LeaveRequest>) => Promise<{ ok: boolean; error?: string }>;
  updateLeaveStatus: (id: string, status: 'Đã duyệt' | 'Từ chối') => Promise<void>;
  createOvertimeRequest: (payload: Partial<OvertimeRequest>) => Promise<{ ok: boolean; error?: string }>;
  updateOvertimeStatus: (id: string, status: 'Đã duyệt' | 'Từ chối') => Promise<void>;

  generateMonthlyPayroll: (month: number, year: number, standardDays: number) => Promise<{ ok: boolean; error?: string }>;
  updatePayrollDetailItem: (detailId: string, payload: Partial<PayrollDetail>) => Promise<{ ok: boolean; error?: string }>;
  changePayrollStatus: (
    payrollId: string,
    newStatus: Payroll['status'],
    unlockReason?: string
  ) => Promise<{ ok: boolean; error?: string }>;

  updateRoleConfig: (roleId: string, dataScope: Role['data_scope'], hiddenFields: string[]) => Promise<void>;
  saveSystemSetting: (key: string, value: unknown) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  importExcelRows: (mappedRows: Array<Record<string, unknown>>) => Promise<{
    successCount: number;
    skippedCount: number;
    errors: string[];
  }>;
}

const ErpContext = createContext<ErpContextValue | null>(null);
const LS_SESSION_USER_ID = 'qlda_active_user_id';

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<SupabaseHealthStatus>({
    configured: false,
    connected: false,
    schemaReady: false,
  });
  const [loading, setLoading] = useState<boolean>(true);

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [employeeTransfers, setEmployeeTransfers] = useState<EmployeeTransfer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerCareLogs, setCustomerCareLogs] = useState<CustomerCareLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
  const [contractRevisions, setContractRevisions] = useState<ContractRevision[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [costAllocations, setCostAllocations] = useState<CostAllocation[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [payrollDetails, setPayrollDetails] = useState<PayrollDetail[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [projectStatuses, setProjectStatuses] = useState<string[]>([
    'Chờ tiếp nhận',
    'Đang lên ý tưởng',
    'Đang thiết kế',
    'Chờ khách phản hồi',
    'Đang chỉnh sửa',
    'Chờ duyệt',
    'Hoàn thành',
    'Đã bàn giao',
    'Tạm dừng',
    'Hủy dự án',
  ]);
  const [jobTypes, setJobTypes] = useState<string[]>([
    'HSNL',
    'Brochure',
    'Banner',
    'Website',
    'Catalogue',
    'Logo & Branding',
    'Bao bì',
    'Profile',
    'Khác',
  ]);
  const [defaultVatRate, setDefaultVatRate] = useState<number>(8);
  const [standardWorkDays, setStandardWorkDays] = useState<number>(26);
  const [officeAllowedIps, setOfficeAllowedIps] = useState<string[]>([]);
  const [autoSyncOfficeIp, setAutoSyncOfficeIp] = useState<boolean>(true);
  const [currentClientIp, setCurrentClientIp] = useState<string>('');

  // Phát hiện địa chỉ IP mạng hiện tại của người dùng (Public WAN IP hoặc Server-detected IP)
  const detectCurrentIp = useCallback(async (): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const r = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeout);
      if (r.ok) {
        const json = await r.json();
        if (json?.ip) {
          const clean = String(json.ip).trim();
          setCurrentClientIp(clean);
          return clean;
        }
      }
    } catch {
      // Fallback sang Backend IP endpoint
    }
    try {
      const fallback = await apiRequest<{ ok: boolean; ip?: string }>('/system/client-ip');
      if (fallback.ok && fallback.ip) {
        setCurrentClientIp(fallback.ip);
        return fallback.ip;
      }
    } catch {
      // ignore
    }
    return '';
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(LS_SESSION_USER_ID) : null
  );

  // Đồng bộ toàn bộ dữ liệu thông qua Backend MVC Controller: GET /api/bootstrap
  const refreshAll = useCallback(async () => {
    setLoading(true);
    const status = await checkSupabaseHealth();
    setHealth(status);

    if (!status.connected || !status.schemaReady) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{ ok: boolean; data?: any }>('/bootstrap');
      if (res.ok && res.data) {
        const d = res.data;
        setRoles(d.roles || []);
        setRolePermissions(d.rolePermissions || []);
        setDepartments(d.departments || []);
        setTeams(d.teams || []);
        setShifts(d.shifts || []);
        setEmployees(d.employees || []);
        const loadedUsers: UserAccount[] = d.users || [];
        setUsers(loadedUsers);
        setEmployeeTransfers(d.employeeTransfers || []);
        setCustomers(d.customers || []);
        setCustomerCareLogs(d.customerCareLogs || []);
        setProjects(d.projects || []);
        setProjectAssignments(d.projectAssignments || []);
        setContractRevisions(d.contractRevisions || []);
        setPayments(d.payments || []);
        setExpenseCategories(d.expenseCategories || []);
        setExpenses(d.expenses || []);
        setCostAllocations(d.costAllocations || []);
        setWorkLogs(d.workLogs || []);
        setProjectFiles(d.projectFiles || []);
        setAttendance(d.attendance || []);
        setLeaveRequests(d.leaveRequests || []);
        setOvertimeRequests(d.overtimeRequests || []);
        setPayrolls(d.payrolls || []);
        setPayrollDetails(d.payrollDetails || []);
        setNotifications(d.notifications || []);
        setAuditLogs(d.auditLogs || []);

        if (Array.isArray(d.settings)) {
          for (const row of d.settings) {
            if (row.key === 'project_statuses' && Array.isArray(row.value)) {
              setProjectStatuses(row.value);
            } else if (row.key === 'job_types' && Array.isArray(row.value)) {
              setJobTypes(row.value);
            } else if (row.key === 'default_vat_rate') {
              setDefaultVatRate(Number(row.value) || 8);
            } else if (row.key === 'standard_work_days') {
              setStandardWorkDays(Number(row.value) || 26);
            } else if (row.key === 'office_allowed_ips' && Array.isArray(row.value)) {
              setOfficeAllowedIps(row.value.map((ip: unknown) => String(ip).trim()).filter(Boolean));
            } else if (row.key === 'auto_sync_office_ip') {
              setAutoSyncOfficeIp(Boolean(row.value));
            }
          }
        }

        const savedId = localStorage.getItem(LS_SESSION_USER_ID);
        const found = savedId ? loadedUsers.find((u) => u.id === savedId && !u.is_locked) : null;
        if (found) {
          setCurrentUserId(found.id);
        } else {
          setCurrentUserId(null);
          localStorage.removeItem(LS_SESSION_USER_ID);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectCurrentIp();
    refreshAll();
  }, [detectCurrentIp, refreshAll]);

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const currentEmployee = employees.find((e) => e.id === currentUser?.employee_id) || null;
  const currentRole: Role | null = currentUser
    ? roles.find((r) => r.id === currentUser.role_id) ||
      roles.find((r) => r.code === currentEmployee?.role_code) || {
        id: 'system-super-admin',
        code: currentEmployee?.role_code || 'super_admin',
        name:
          currentEmployee?.role_code === 'sale'
            ? 'Sale'
            : currentEmployee?.role_code === 'designer'
            ? 'Designer'
            : currentEmployee?.role_code === 'accountant'
            ? 'Kế toán'
            : currentEmployee?.role_code === 'team_leader'
            ? 'Trưởng nhóm'
            : currentEmployee?.role_code === 'dept_manager'
            ? 'Trưởng phòng'
            : currentEmployee?.role_code === 'director'
            ? 'Giám đốc'
            : currentEmployee?.role_code === 'admin'
            ? 'Admin'
            : 'Super Admin',
        data_scope:
          currentEmployee?.role_code === 'sale' || currentEmployee?.role_code === 'designer'
            ? 'personal'
            : currentEmployee?.role_code === 'team_leader'
            ? 'team'
            : currentEmployee?.role_code === 'dept_manager'
            ? 'department'
            : 'system',
        hidden_fields:
          currentEmployee?.role_code === 'designer'
            ? ['revenue_before_tax', 'payments', 'debt', 'profit', 'other_salary']
            : currentEmployee?.role_code === 'sale'
            ? ['other_salary']
            : [],
        description: 'Vai trò hệ thống',
        is_system: true,
        created_at: new Date().toISOString(),
      }
    : null;

  useEffect(() => {
    setApiActorHeaders({
      userId: currentUser?.id || null,
      actorName: currentEmployee?.full_name || currentUser?.username || 'Quản trị viên',
      actorRole: currentRole?.name || 'Super Admin',
    });
  }, [currentUser, currentEmployee, currentRole]);

  // Tự động đồng bộ IP Wi-Fi Công ty khi Quản trị viên (Super Admin / Admin) mở web tại văn phòng
  useEffect(() => {
    if (!autoSyncOfficeIp || !currentClientIp || !health.connected || !health.schemaReady) return;
    const isAdminActor = currentRole?.code === 'super_admin' || currentRole?.code === 'admin';
    if (isAdminActor && !officeAllowedIps.includes(currentClientIp)) {
      setOfficeAllowedIps([currentClientIp]);
      apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'office_allowed_ips', value: [currentClientIp] }),
      });
    }
  }, [autoSyncOfficeIp, currentClientIp, currentRole, officeAllowedIps, health.connected, health.schemaReady]);

  // ======================== AUTH CONTROLLER CALLS ========================
  const login = async (username: string, password: string) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.ok && res.user) {
      localStorage.setItem(LS_SESSION_USER_ID, res.user.id);
      setCurrentUserId(res.user.id);
      await refreshAll();
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem(LS_SESSION_USER_ID);
    setCurrentUserId(null);
  };

  const bootstrapFirstAdmin = async (payload: {
    fullName: string;
    email: string;
    phone: string;
    username: string;
    password: string;
  }) => {
    const res = await apiRequest('/auth/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok && res.user) {
      localStorage.setItem(LS_SESSION_USER_ID, res.user.id);
      setCurrentUserId(res.user.id);
      await refreshAll();
    }
    return res;
  };

  // ======================== RBAC & FIELD SECURITY ========================
  const isFieldHidden = useCallback(
    (fieldName: string): boolean => {
      if (!currentRole) return false;
      if (['super_admin', 'admin', 'director'].includes(currentRole.code)) return false;
      return Array.isArray(currentRole.hidden_fields) && currentRole.hidden_fields.includes(fieldName);
    },
    [currentRole]
  );

  const canAction = useCallback(
    (
      moduleCode: string,
      action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'confirm_tx'
    ): boolean => {
      const code = currentRole?.code || currentEmployee?.role_code || 'super_admin';
      // Phân hệ Cài đặt & Phân quyền chỉ duy nhất Admin / Super Admin được xem và thao tác
      if (moduleCode === 'settings') {
        return code === 'super_admin' || code === 'admin';
      }
      if (code === 'super_admin' || code === 'admin') return true;
      if (code === 'director') {
        if (action === 'delete' && moduleCode === 'projects') return false;
        return true;
      }
      if (code === 'accountant') {
        if (['revenue', 'payments', 'expenses', 'profit', 'payroll', 'reports'].includes(moduleCode)) return true;
        if (moduleCode === 'projects') return action === 'view' || action === 'export';
        return action === 'view';
      }
      if (code === 'dept_manager') {
        if (moduleCode === 'payroll') return action === 'view';
        return true;
      }
      if (code === 'team_leader') {
        if (moduleCode === 'payroll') return false;
        if (action === 'delete') return false;
        return true;
      }
      if (code === 'sale') {
        if (['projects', 'customers'].includes(moduleCode)) return action !== 'delete';
        if (moduleCode === 'expenses') return action === 'view' || action === 'create';
        if (moduleCode === 'attendance') return action === 'view' || action === 'create';
        return action === 'view';
      }
      if (code === 'designer') {
        if (moduleCode === 'projects') return action === 'view' || action === 'edit';
        if (moduleCode === 'expenses') return action === 'view' || action === 'create';
        if (moduleCode === 'attendance') return action === 'view' || action === 'create';
        return action === 'view';
      }
      return true;
    },
    [currentRole, currentEmployee]
  );

  const scopedProjects = React.useMemo(() => {
    if (!currentRole || currentRole.data_scope === 'system' || !currentEmployee) {
      return projects;
    }
    if (currentRole.data_scope === 'department') {
      return projects.filter(
        (p) =>
          p.department_id === currentEmployee.department_id ||
          p.sale_id === currentEmployee.id ||
          p.designer_id === currentEmployee.id
      );
    }
    if (currentRole.data_scope === 'team') {
      const teamMemberIds = new Set(
        employees.filter((e) => e.team_id && e.team_id === currentEmployee.team_id).map((e) => e.id)
      );
      teamMemberIds.add(currentEmployee.id);
      return projects.filter(
        (p) =>
          p.team_leader_id === currentEmployee.id ||
          (p.sale_id && teamMemberIds.has(p.sale_id)) ||
          (p.designer_id && teamMemberIds.has(p.designer_id))
      );
    }
    return projects.filter(
      (p) =>
        p.sale_id === currentEmployee.id ||
        p.designer_id === currentEmployee.id ||
        p.team_leader_id === currentEmployee.id
    );
  }, [projects, currentRole, currentEmployee, employees]);

  const scopedEmployees = React.useMemo(() => {
    if (!currentRole || currentRole.data_scope === 'system' || !currentEmployee) {
      return employees;
    }
    if (currentRole.data_scope === 'department') {
      return employees.filter((e) => e.department_id === currentEmployee.department_id);
    }
    if (currentRole.data_scope === 'team') {
      return employees.filter((e) => e.team_id === currentEmployee.team_id || e.id === currentEmployee.id);
    }
    return employees.filter((e) => e.id === currentEmployee.id);
  }, [employees, currentRole, currentEmployee]);

  const getProjectFinancials = useCallback(
    (project: Project): ProjectFinancialSummary => {
      const revenueBeforeTax = Number(project.revenue_before_tax) || 0;
      const vatAmount = Number(project.vat_amount) || 0;
      const revenueAfterTax = Number(project.revenue_after_tax) || 0;

      const projPayments = payments.filter((p) => p.project_id === project.id);
      const confirmedPayments = projPayments
        .filter((p) => p.status === 'Đã xác nhận')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const pendingPayments = projPayments
        .filter((p) => p.status === 'Chờ xác nhận')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const remainingDebt = Math.max(0, revenueAfterTax - confirmedPayments);
      const overpaidAmount = Math.max(0, confirmedPayments - revenueAfterTax);

      let paymentStatusLabel: ProjectFinancialSummary['paymentStatusLabel'] = 'Chưa thanh toán';
      if (pendingPayments > 0 && confirmedPayments === 0) {
        paymentStatusLabel = 'Đang đối soát';
      } else if (confirmedPayments === 0) {
        paymentStatusLabel = 'Chưa thanh toán';
      } else if (confirmedPayments > revenueAfterTax && revenueAfterTax > 0) {
        paymentStatusLabel = 'Thanh toán thừa';
      } else if (confirmedPayments >= revenueAfterTax && revenueAfterTax > 0) {
        paymentStatusLabel = 'Đã thanh toán đủ';
      } else {
        paymentStatusLabel = 'Đã thanh toán một phần';
      }

      const validStatuses: ExpenseStatus[] = ['Đã duyệt', 'Chờ thanh toán', 'Đã thanh toán'];
      const directExpenses = expenses
        .filter((e) => e.project_id === project.id && e.expense_scope === 'project' && validStatuses.includes(e.status))
        .reduce((sum, e) => {
          const costVal = e.is_vat_deductible ? Number(e.amount_before_tax) : Number(e.amount_after_tax);
          return sum + (costVal || 0);
        }, 0);

      const projAllocations = costAllocations.filter((ca) => ca.project_id === project.id);
      const allocatedGeneralCost = projAllocations
        .filter((ca) => ca.cost_type === 'general')
        .reduce((sum, ca) => sum + (Number(ca.allocated_amount) || 0), 0);
      const allocatedHrCost = projAllocations
        .filter((ca) => ca.cost_type === 'hr')
        .reduce((sum, ca) => sum + (Number(ca.allocated_amount) || 0), 0);

      const totalCost = directExpenses + allocatedGeneralCost + allocatedHrCost;
      const grossProfit = revenueBeforeTax - directExpenses;
      const netProfitAfterAllocation = grossProfit - allocatedGeneralCost - allocatedHrCost;
      const profitMarginPercent =
        revenueBeforeTax > 0 ? Number(((netProfitAfterAllocation / revenueBeforeTax) * 100).toFixed(2)) : 0;

      return {
        revenueBeforeTax,
        vatAmount,
        revenueAfterTax,
        confirmedPayments,
        pendingPayments,
        remainingDebt,
        overpaidAmount,
        paymentStatusLabel,
        directExpenses,
        allocatedGeneralCost,
        allocatedHrCost,
        totalCost,
        grossProfit,
        netProfitAfterAllocation,
        profitMarginPercent,
      };
    },
    [payments, expenses, costAllocations]
  );

  // ======================== CUSTOMER CONTROLLER CALLS ========================
  const createCustomer = async (payload: Partial<Customer>) => {
    const res = await apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify({ ...payload, sale_id: payload.sale_id || currentEmployee?.id || null }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateCustomer = async (id: string, payload: Partial<Customer>) => {
    const res = await apiRequest(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const deleteCustomer = async (id: string) => {
    const res = await apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const addCustomerCareLog = async (customerId: string, channel: string, content: string) => {
    await apiRequest(`/customers/${customerId}/care-logs`, {
      method: 'POST',
      body: JSON.stringify({ channel, content }),
    });
    await refreshAll();
  };

  // ======================== PROJECT CONTROLLER CALLS ========================
  const createProject = async (payload: Partial<Project>) => {
    const res = await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateProject = async (id: string, payload: Partial<Project>, reason?: string) => {
    const res = await apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, reason }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const duplicateProject = async (project: Project) => {
    return createProject({
      ...project,
      project_code: undefined,
      name: `${project.name} (Nhân bản)`,
      status: 'Chờ tiếp nhận',
      progress_percent: 0,
      contract_status: 'Nháp',
      completed_date: null,
      handover_date: null,
    });
  };

  const archiveProject = async (id: string, archive: boolean) => {
    return updateProject(id, { is_archived: archive }, archive ? 'Lưu trữ dự án' : 'Khôi phục dự án lưu trữ');
  };

  const deleteProject = async (id: string) => {
    const res = await apiRequest(`/projects/${id}`, { method: 'DELETE' });
    if (res.ok) await refreshAll();
    return res;
  };

  const handoverProjectStaff = async (
    projectId: string,
    roleType: 'Sale' | 'Designer' | 'Trưởng nhóm',
    newEmployeeId: string | null,
    note: string
  ) => {
    const res = await apiRequest(`/projects/${projectId}/handover`, {
      method: 'POST',
      body: JSON.stringify({ roleType, newEmployeeId, note }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const adjustProjectContract = async (
    projectId: string,
    inputAmount: number,
    vatRate: number,
    mode: 'before_tax' | 'after_tax',
    contractStatus: Project['contract_status'],
    contractNumber: string,
    contractSignDate: string,
    reason: string
  ) => {
    const res = await apiRequest(`/projects/${projectId}/adjust-contract`, {
      method: 'POST',
      body: JSON.stringify({
        inputAmount,
        vatRate,
        mode,
        contractStatus,
        contractNumber,
        contractSignDate,
        reason,
      }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const addWorkLog = async (
    projectId: string,
    stepName: string,
    progressPercent: number,
    statusAfter: string,
    workHours: number,
    note: string
  ) => {
    await apiRequest(`/projects/${projectId}/work-logs`, {
      method: 'POST',
      body: JSON.stringify({ stepName, progressPercent, statusAfter, workHours, note }),
    });
    await refreshAll();
  };

  const addProjectFile = async (
    projectId: string,
    category: ProjectFile['file_category'],
    fileName: string,
    fileUrl: string,
    fileSize?: string
  ) => {
    await apiRequest(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify({ category, fileName, fileUrl, fileSize }),
    });
    await refreshAll();
  };

  // ======================== FINANCE CONTROLLER CALLS ========================
  const createPayment = async (payload: Partial<Payment>) => {
    const res = await apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const confirmPayment = async (paymentId: string) => {
    const res = await apiRequest(`/payments/${paymentId}/confirm`, { method: 'PATCH' });
    if (res.ok) await refreshAll();
    return res;
  };

  const cancelOrRefundPayment = async (paymentId: string, reason: string) => {
    const res = await apiRequest(`/payments/${paymentId}/cancel-or-refund`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const createExpense = async (payload: Partial<Expense>) => {
    const res = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        proposer_id: payload.proposer_id || currentEmployee?.id || null,
      }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateExpenseStatus = async (expenseId: string, newStatus: ExpenseStatus, comment?: string) => {
    const res = await apiRequest(`/expenses/${expenseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, comment, approverId: currentEmployee?.id || null }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const runCostAllocation = async (payload: {
    month: number;
    year: number;
    costType: 'general' | 'hr';
    method: CostAllocation['allocation_method'];
    totalAmountToAllocate: number;
    manualMap?: Record<string, number>;
    notes?: string;
  }) => {
    const res = await apiRequest('/cost-allocations/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  // ======================== HR CONTROLLER CALLS ========================
  const createDepartment = async (code: string, name: string, managerId: string | null, description?: string) => {
    const res = await apiRequest('/departments', {
      method: 'POST',
      body: JSON.stringify({ code, name, managerId, description }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const createTeam = async (code: string, name: string, departmentId: string | null, leaderId: string | null) => {
    const res = await apiRequest('/teams', {
      method: 'POST',
      body: JSON.stringify({ code, name, departmentId, leaderId }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const createShift = async (payload: Partial<Shift>) => {
    const res = await apiRequest('/shifts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const createEmployee = async (
    payload: Partial<Employee>,
    accountPayload?: { username: string; password: string; roleId: string }
  ) => {
    const res = await apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify({ employee: payload, account: accountPayload }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateEmployee = async (id: string, payload: Partial<Employee>) => {
    const res = await apiRequest(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const deleteEmployee = async (id: string) => {
    const res = await apiRequest(`/employees/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const transferEmployee = async (
    employeeId: string,
    toDeptId: string | null,
    toTeamId: string | null,
    reason: string
  ) => {
    const res = await apiRequest(`/employees/${employeeId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ toDeptId, toTeamId, reason }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const toggleUserLock = async (userId: string, isLocked: boolean) => {
    await apiRequest(`/auth/users/${userId}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked }),
    });
    await refreshAll();
  };

  // ======================== ATTENDANCE & PAYROLL CONTROLLER CALLS ========================
  const checkInAttendance = async (
    employeeId: string,
    method: AttendanceRecord['method'] = 'Web'
  ) => {
    const activeIp = currentClientIp || (await detectCurrentIp());
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ employeeId, method, clientIp: activeIp }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const checkOutAttendance = async (attendanceId: string) => {
    const activeIp = currentClientIp || (await detectCurrentIp());
    const res = await apiRequest(`/attendance/${attendanceId}/check-out`, {
      method: 'POST',
      body: JSON.stringify({ clientIp: activeIp }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const submitAttendanceExplanation = async (attendanceId: string, reason: string) => {
    const res = await apiRequest(`/attendance/${attendanceId}/explanation`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const approveAttendanceAdjustment = async (
    attendanceId: string,
    newCheckIn: string | null,
    newCheckOut: string | null,
    lateMinutes: number,
    earlyLeaveMinutes: number,
    workDayCredit: number,
    approveStatus: 'Đã duyệt' | 'Từ chối',
    reason: string
  ) => {
    const res = await apiRequest(`/attendance/${attendanceId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        newCheckIn,
        newCheckOut,
        lateMinutes,
        earlyLeaveMinutes,
        workDayCredit,
        approveStatus,
        reason,
      }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const createLeaveRequest = async (payload: Partial<LeaveRequest>) => {
    const res = await apiRequest('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ ...payload, employee_id: payload.employee_id || currentEmployee?.id }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateLeaveStatus = async (id: string, status: 'Đã duyệt' | 'Từ chối') => {
    await apiRequest(`/leave-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refreshAll();
  };

  const createOvertimeRequest = async (payload: Partial<OvertimeRequest>) => {
    const res = await apiRequest('/overtime-requests', {
      method: 'POST',
      body: JSON.stringify({ ...payload, employee_id: payload.employee_id || currentEmployee?.id }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updateOvertimeStatus = async (id: string, status: 'Đã duyệt' | 'Từ chối') => {
    await apiRequest(`/overtime-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refreshAll();
  };

  const generateMonthlyPayroll = async (month: number, year: number, standardDays: number) => {
    const res = await apiRequest('/payroll/generate', {
      method: 'POST',
      body: JSON.stringify({ month, year, standardDays }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const updatePayrollDetailItem = async (detailId: string, payload: Partial<PayrollDetail>) => {
    const res = await apiRequest(`/payroll-details/${detailId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  const changePayrollStatus = async (
    payrollId: string,
    newStatus: Payroll['status'],
    unlockReason?: string
  ) => {
    const res = await apiRequest(`/payroll/${payrollId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, unlockReason }),
    });
    if (res.ok) await refreshAll();
    return res;
  };

  // ======================== SYSTEM CONTROLLER CALLS ========================
  const updateRoleConfig = async (roleId: string, dataScope: Role['data_scope'], hiddenFields: string[]) => {
    await apiRequest(`/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify({ dataScope, hiddenFields }),
    });
    await refreshAll();
  };

  const saveSystemSetting = async (key: string, value: unknown) => {
    await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
    await refreshAll();
  };

  const markNotificationRead = async (id: string) => {
    await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const importExcelRows = async (mappedRows: Array<Record<string, unknown>>) => {
    const res = await apiRequest('/projects/import-excel', {
      method: 'POST',
      body: JSON.stringify({ mappedRows }),
    });
    if (res.ok) await refreshAll();
    return {
      successCount: res.successCount || 0,
      skippedCount: res.skippedCount || 0,
      errors: res.errors || (res.error ? [res.error] : []),
    };
  };

  return (
    <ErpContext.Provider
      value={{
        health,
        loading,
        refreshAll,
        roles,
        rolePermissions,
        departments,
        teams,
        shifts,
        employees,
        users,
        employeeTransfers,
        customers,
        customerCareLogs,
        projects,
        projectAssignments,
        contractRevisions,
        payments,
        expenseCategories,
        expenses,
        costAllocations,
        workLogs,
        projectFiles,
        attendance,
        leaveRequests,
        overtimeRequests,
        payrolls,
        payrollDetails,
        notifications,
        auditLogs,
        projectStatuses,
        jobTypes,
        defaultVatRate,
        standardWorkDays,
        officeAllowedIps,
        autoSyncOfficeIp,
        currentClientIp,
        currentUser,
        currentEmployee,
        currentRole,
        login,
        logout,
        bootstrapFirstAdmin,
        isFieldHidden,
        canAction,
        scopedProjects,
        scopedEmployees,
        getProjectFinancials,
        createCustomer,
        updateCustomer,
        deleteCustomer,
        addCustomerCareLog,
        createProject,
        updateProject,
        duplicateProject,
        archiveProject,
        deleteProject,
        handoverProjectStaff,
        adjustProjectContract,
        addWorkLog,
        addProjectFile,
        createPayment,
        confirmPayment,
        cancelOrRefundPayment,
        createExpense,
        updateExpenseStatus,
        runCostAllocation,
        createDepartment,
        createTeam,
        createShift,
        createEmployee,
        updateEmployee,
        deleteEmployee,
        transferEmployee,
        toggleUserLock,
        checkInAttendance,
        checkOutAttendance,
        submitAttendanceExplanation,
        approveAttendanceAdjustment,
        createLeaveRequest,
        updateLeaveStatus,
        createOvertimeRequest,
        updateOvertimeStatus,
        generateMonthlyPayroll,
        updatePayrollDetailItem,
        changePayrollStatus,
        updateRoleConfig,
        saveSystemSetting,
        markNotificationRead,
        importExcelRows,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
};

export function useErp(): ErpContextValue {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used within ErpProvider');
  return ctx;
}
