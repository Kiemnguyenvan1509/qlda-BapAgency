import { Router } from 'express';
import { SystemController } from '../controllers/systemController';
import { AuthController } from '../controllers/authController';
import { CustomerController } from '../controllers/customerController';
import { ProjectController } from '../controllers/projectController';
import { FinanceController } from '../controllers/financeController';
import { HrController } from '../controllers/hrController';
import { AttendancePayrollController } from '../controllers/attendancePayrollController';

const router = Router();

// 1. System, Health & Bootstrap Routes
router.get('/health', SystemController.checkHealth);
router.post('/config/supabase', SystemController.saveSupabaseConfig);
router.delete('/config/supabase', SystemController.clearSupabaseConfig);
router.get('/bootstrap', SystemController.getBootstrapData);
router.put('/roles/:id', SystemController.updateRoleConfig);
router.put('/settings', SystemController.saveSetting);
router.patch('/notifications/:id/read', SystemController.markNotificationRead);

// 2. Auth & User Account Routes
router.post('/auth/login', AuthController.login);
router.post('/auth/bootstrap-admin', AuthController.bootstrapFirstAdmin);
router.patch('/auth/users/:id/lock', AuthController.toggleUserLock);

// 3. Customer Routes
router.post('/customers', CustomerController.create);
router.put('/customers/:id', CustomerController.update);
router.post('/customers/:id/care-logs', CustomerController.addCareLog);

// 4. Project Routes
router.post('/projects', ProjectController.create);
router.put('/projects/:id', ProjectController.update);
router.delete('/projects/:id', ProjectController.remove);
router.post('/projects/:id/handover', ProjectController.handoverStaff);
router.post('/projects/:id/adjust-contract', ProjectController.adjustContract);
router.post('/projects/:id/work-logs', ProjectController.addWorkLog);
router.post('/projects/:id/files', ProjectController.addProjectFile);
router.post('/projects/import-excel', ProjectController.importExcel);

// 5. Finance (Payments, Expenses, Cost Allocations) Routes
router.post('/payments', FinanceController.createPayment);
router.patch('/payments/:id/confirm', FinanceController.confirmPayment);
router.patch('/payments/:id/cancel-or-refund', FinanceController.cancelOrRefundPayment);
router.post('/expenses', FinanceController.createExpense);
router.patch('/expenses/:id/status', FinanceController.updateExpenseStatus);
router.post('/cost-allocations/run', FinanceController.runCostAllocation);

// 6. HR (Departments, Teams, Employees, Transfers) Routes
router.post('/departments', HrController.createDepartment);
router.post('/teams', HrController.createTeam);
router.post('/employees', HrController.createEmployee);
router.put('/employees/:id', HrController.updateEmployee);
router.delete('/employees/:id', HrController.deleteEmployee);
router.post('/employees/:id/transfer', HrController.transferEmployee);

// 7. Attendance, Leave, Overtime & Payroll Routes
router.post('/shifts', AttendancePayrollController.createShift);
router.post('/attendance/check-in', AttendancePayrollController.checkIn);
router.post('/attendance/:id/check-out', AttendancePayrollController.checkOut);
router.post('/attendance/:id/explanation', AttendancePayrollController.submitExplanation);
router.post('/attendance/:id/approve', AttendancePayrollController.approveAdjustment);
router.post('/leave-requests', AttendancePayrollController.createLeaveRequest);
router.patch('/leave-requests/:id/status', AttendancePayrollController.updateLeaveStatus);
router.post('/overtime-requests', AttendancePayrollController.createOvertimeRequest);
router.patch('/overtime-requests/:id/status', AttendancePayrollController.updateOvertimeStatus);
router.post('/payroll/generate', AttendancePayrollController.generatePayroll);
router.put('/payroll-details/:id', AttendancePayrollController.updatePayrollDetail);
router.patch('/payroll/:id/status', AttendancePayrollController.changePayrollStatus);

export default router;
