# Hệ Thống ERP Quản Lý Dự Án – Nhân Sự – Tài Chính – Chấm Công (Fullstack MVC)

Hệ thống quản trị doanh nghiệp tổng thể được xây dựng theo kiến trúc **Fullstack Client–Server MVC** (`Node.js + Express + TypeScript` ở Backend và `React 19 + TypeScript + Tailwind CSS` ở Frontend), kết nối trực tiếp với cơ sở dữ liệu **Supabase PostgreSQL** gồm **30 bảng chuẩn hóa** (không chứa dữ liệu ảo).

---

## 1. Kiến trúc Thư mục Dự án (Hướng 2 – Fullstack MVC)

```text
DashBoard QLDA/
├── backend/                        # Tầng Server MVC (Node.js + Express + TypeScript)
│   ├── config/
│   │   └── supabase.ts             # Quản lý kết nối Supabase PostgreSQL
│   ├── middlewares/
│   │   └── authMiddleware.ts       # Trích xuất thông tin người dùng (Actor) & kiểm soát truy cập
│   ├── models/                     # Tầng Model (Truy vấn trực tiếp 30 bảng Supabase)
│   │   ├── SystemModel.ts
│   │   ├── HrModel.ts
│   │   ├── CustomerModel.ts
│   │   ├── ProjectModel.ts
│   │   ├── FinanceModel.ts
│   │   └── AttendancePayrollModel.ts
│   ├── controllers/                # Tầng Controller (Xử lý 10 quy tắc nghiệp vụ bắt buộc)
│   │   ├── systemController.ts
│   │   ├── authController.ts
│   │   ├── customerController.ts
│   │   ├── projectController.ts
│   │   ├── financeController.ts
│   │   ├── hrController.ts
│   │   └── attendancePayrollController.ts
│   ├── routes/
│   │   └── apiRoutes.ts            # Định tuyến toàn bộ RESTful API (/api/*)
│   ├── utils/
│   │   └── helpers.ts              # Hàm tiện ích dùng chung (sinh mã tự động, tính thuế VAT)
│   ├── app.ts                      # Khởi tạo ứng dụng Express
│   └── server.ts                   # Entrypoint chạy độc lập Backend Server
├── src/                            # Tầng View (React + TypeScript + Tailwind CSS)
│   ├── components/                 # Các Modal & cổng xác thực dùng chung
│   ├── context/                    # ErpContext quản lý trạng thái & phân quyền RBAC/Data Scope
│   ├── lib/                        # Tiện ích định dạng tiền tệ, ngày tháng, xuất Excel
│   ├── pages/                      # 12 Phân hệ giao diện người dùng (Views)
│   ├── services/                   # apiClient.ts gọi HTTP REST API xuống Backend MVC
│   └── types/                      # Định nghĩa kiểu dữ liệu TypeScript cho 30 bảng DB
└── supabase/
    └── schema.sql                  # Kịch bản SQL khởi tạo toàn bộ 30 bảng PostgreSQL & RLS
```

---

## 2. Giải thích Ý nghĩa & Chức năng của 30 Bảng (Tables) trong Supabase

Toàn bộ 30 bảng trong schema `public` của Supabase (được định nghĩa tại [`supabase/schema.sql`](./supabase/schema.sql)) được chia thành **7 nhóm nghiệp vụ cốt lõi** theo đúng Mục 19 của tài liệu đặc tả:

---

### Nhóm I: Cơ cấu Tổ chức & Hồ sơ Nhân sự (5 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **1** | **`departments`** | **Danh mục Phòng ban**: Lưu trữ các phòng ban trong công ty (VD: Phòng Kinh doanh, Phòng Thiết kế, Phòng Kế toán...). Dùng để phân loại nhân sự, lọc báo cáo và giới hạn phạm vi dữ liệu (`data_scope = 'department'`) cho Trưởng phòng. | `code` (Mã phòng), `name` (Tên phòng), `manager_id` (ID Trưởng phòng). |
| **2** | **`teams`** | **Danh mục Nhóm chuyên môn**: Lưu các nhóm nhỏ trực thuộc từng phòng ban (VD: Team Thiết kế Branding, Team Sale B2B...). Dùng để phân quyền xem dữ liệu theo nhóm (`data_scope = 'team'`) cho Trưởng nhóm. | `code`, `name`, `department_id` (Thuộc phòng ban nào), `leader_id` (ID Trưởng nhóm). |
| **3** | **`shifts`** | **Danh mục Ca làm việc**: Cấu hình giờ vào ca (`start_time`), giờ tan ca (`end_time`), số phút nghỉ trưa (`break_minutes`), số phút ân hạn đi trễ (`grace_late_minutes`) và hệ số ngày công (`work_day_ratio`). Hệ thống dựa vào bảng này để tự động tính số phút đi muộn / về sớm khi nhân viên Check-in / Check-out. | `code` (VD: `HC_01`), `start_time` (`08:30`), `end_time` (`17:30`), `grace_late_minutes` (`15`). |
| **4** | **`employees`** | **Hồ sơ Nhân sự trung tâm**: Lưu toàn bộ thông tin cá nhân, chức vụ, phòng ban, nhóm, ca làm việc, trạng thái làm việc (`Đang làm việc`, `Thử việc`, `Nghỉ việc`), mức lương cơ bản (`base_salary`), phụ cấp (`default_allowance`), công thức tính lương và chỉ tiêu KPI doanh thu tháng (`monthly_kpi_target`). | Liên kết tới `departments`, `teams`, `shifts`. Là bảng gốc để gắn với tài khoản đăng nhập, dự án, chấm công và bảng lương. |
| **5** | **`employee_transfers`** | **Lịch sử Điều chuyển Nhân sự**: Ghi lại toàn bộ lịch sử khi một nhân viên được luân chuyển từ Phòng ban / Nhóm cũ sang Phòng ban / Nhóm mới kèm ngày hiệu lực và lý do điều chuyển (đảm bảo không mất lịch sử công tác cũ). | `employee_id`, `from_department_id`, `to_department_id`, `from_team_id`, `to_team_id`, `transfer_date`, `reason`. |

---

### Nhóm II: Tài khoản Đăng nhập & Phân quyền Bảo mật RBAC (4 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **6** | **`users`** | **Tài khoản Đăng nhập**: Lưu thông tin đăng nhập phần mềm (`username`, `password_hash`), trạng thái kích hoạt (`is_active`), trạng thái khóa (`is_locked`) và thời điểm đăng nhập gần nhất (`last_login_at`). Mỗi tài khoản gắn với hồ sơ nhân viên trong bảng `employees`. | `username`, `password_hash`, `employee_id` (FK $\rightarrow$ `employees.id`), `last_login_at`. |
| **7** | **`roles`** | **Danh mục Vai trò Hệ thống**: Lưu 8 vai trò chuẩn (`super_admin`, `admin`, `director`, `dept_manager`, `team_leader`, `sale`, `designer`, `accountant`), phạm vi dữ liệu được phép xem (`data_scope`: `personal`, `team`, `department`, `system`) và danh sách các trường nhạy cảm bị ẩn (`hidden_fields`, ví dụ ẩn doanh thu/lợi nhuận đối với Designer). | `code`, `name`, `data_scope`, `hidden_fields` (JSONB). |
| **8** | **`permissions`** | **Ma trận Quyền thao tác chi tiết**: Cấu hình quyền chi tiết của từng vai trò trên từng phân hệ (`module`): được phép Xem (`can_view`), Thêm (`can_create`), Sửa (`can_edit`), Xóa (`can_delete`), Duyệt (`can_approve`), Xuất Excel (`can_export`) hay Mở khóa (`can_unlock`). | `role_id` (FK $\rightarrow$ `roles.id`), `module`, các cờ boolean `can_*`. |
| **9** | **`user_roles`** | **Bảng trung gian Tài khoản – Vai trò**: Cho phép **1 người dùng có thể kiêm nhiệm nhiều vai trò** cùng lúc (ví dụ: vừa là `team_leader` vừa là `designer`). Quyền thực tế là hợp nhất quyền cao nhất của các vai trò được gán. | `user_id` (FK $\rightarrow$ `users.id`), `role_id` (FK $\rightarrow$ `roles.id`). |

---

### Nhóm III: Quản lý Khách hàng – CRM (2 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **10** | **`customers`** | **Hồ sơ Khách hàng**: Lưu thông tin khách hàng cá nhân/doanh nghiệp, người liên hệ, số điện thoại, email, mã số thuế (`tax_code`), nguồn khách hàng và Sale phụ trách (`sale_id`). Hệ thống kiểm tra bảng này để chống tạo trùng Mã số thuế hoặc Số điện thoại. | `customer_code` (`KH-...`), `name`, `tax_code`, `phone`, `sale_id` (FK $\rightarrow$ `employees.id`). |
| **11** | **`customer_care_logs`** | **Nhật ký Chăm sóc Khách hàng (CSKH)**: Lưu lịch sử các lần liên hệ, tư vấn, gọi điện, gửi email, họp trực tiếp với từng khách hàng theo thứ tự thời gian để Sale và Quản lý theo dõi lịch sử làm việc. | `customer_id` (FK $\rightarrow$ `customers.id`), `channel` (Kênh liên hệ), `content`, `staff_name`. |

---

### Nhóm IV: Quản lý Dự án, Tiến độ & Hồ sơ Thiết kế (7 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **12** | **`projects`** | **Bảng Dự án Trung tâm**: Lưu toàn bộ thông tin dự án thiết kế: mã dự án, tên dự án, loại Job (`HSNL`, `Brochure`, `Website`...), khách hàng, Sale phụ trách chính (`primary_sale_id`), Designer phụ trách chính (`primary_designer_id`), PM, tiến độ (`progress_percent`), hạn giao (`deadline`), số lần sửa (`revision_count`) và giá trị hợp đồng trước/sau thuế (`revenue_before_tax`, `vat_amount`, `revenue_after_tax`). | `project_code` (`DA-...`), `customer_id`, `primary_sale_id`, `primary_designer_id`, `status`, `revenue_after_tax`, `is_archived`. |
| **13** | **`project_members`** | **Thành viên Tham gia Dự án**: Ngoài Sale chính và Designer chính, bảng này lưu danh sách tất cả nhân sự phụ/cộng tác viên cùng tham gia hỗ trợ dự án đó kèm vai trò trong dự án. | `project_id` (FK $\rightarrow$ `projects.id`), `employee_id` (FK $\rightarrow$ `employees.id`), `project_role`. |
| **14** | **`project_handovers`** | **Lịch sử Chuyển giao Nhân sự Phụ trách**: Khi đổi Sale chính hoặc Designer chính giữa chừng, hệ thống không ghi đè làm mất dấu vết mà lưu vào bảng này: người cũ (`from_employee_id`), người mới (`to_employee_id`), ngày bàn giao, lý do và quy tắc tính doanh thu (`revenue_rule`). | `project_id`, `handover_type` (`sale` / `designer`), `from_employee_id`, `to_employee_id`, `reason`. |
| **15** | **`project_status_logs`** | **Lịch sử Thay đổi Trạng thái Dự án**: Tự động ghi vết mỗi khi dự án chuyển trạng thái (VD: từ `Đang thiết kế` $\rightarrow$ `Chờ khách phản hồi` $\rightarrow$ `Hoàn thành`), lưu rõ ai là người đổi và đổi lúc nào. | `project_id`, `old_status`, `new_status`, `changed_by`, `created_at`. |
| **16** | **`project_feedbacks`** | **Nhật ký Phản hồi của Khách hàng**: Lưu từng đợt khách hàng gửi ý kiến chỉnh sửa thiết kế (lần sửa thứ mấy, nội dung khách yêu cầu sửa, trạng thái xử lý của Designer). | `project_id`, `revision_round`, `feedback_date`, `content`, `status`. |
| **17** | **`project_progress_logs`** | **Nhật ký Cập nhật Tiến độ Công việc**: Lưu lịch sử mỗi lần Designer hoặc PM cập nhật phần trăm hoàn thành (`progress_percent`) kèm mô tả đầu việc đã làm xong. | `project_id`, `progress_percent`, `work_description`, `updated_by`. |
| **18** | **`project_files`** | **Tài liệu & File Thiết kế của Dự án**: Quản lý toàn bộ đường dẫn file Hợp đồng, Nội dung khách gửi, Logo & Brand, File thiết kế gốc, File bàn giao nghiệm thu của từng dự án. | `project_id`, `file_category`, `file_name`, `file_url`, `uploaded_by`. |

---

### Nhóm V: Tài chính – Doanh thu Hợp đồng, Thực thu, Công nợ & Chi phí (5 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **19** | **`contract_revisions`** | **Lịch sử Điều chỉnh Giá trị Hợp đồng (Phụ lục HĐ)**: Khi dự án đã ký hợp đồng nhưng phát sinh tăng/giảm giá trị, hệ thống bắt buộc nhập lýễn giải và lưu giá trị cũ (`old_*`) – giá trị mới (`new_*`) vào bảng này để kiểm toán. | `project_id`, `old_revenue_before_tax`, `new_revenue_before_tax`, `old_revenue_after_tax`, `new_revenue_after_tax`, `reason`. |
| **20** | **`payments`** | **Phiếu Thu & Các đợt Thanh toán của Khách hàng**: Lưu từng đợt khách hàng thanh toán (Tạm ứng, Đợt 1, Đợt 2, Quyết toán...). **Chỉ những phiếu có trạng thái `Đã xác nhận` mới được cộng vào Thực thu và trừ vào Công nợ phải thu**. | `payment_code` (`PT-...`), `project_id`, `customer_id`, `installment_name`, `amount`, `status` (`Chờ xác nhận`, `Đã xác nhận`, `Đã hủy`, `Hoàn tiền`). |
| **21** | **`expense_categories`** | **Danh mục Loại Chi phí**: Phân loại sẵn các khoản chi phí trực tiếp dự án (`project`: Thuê Designer ngoài, In ấn, Mua tài nguyên...) và chi phí vận hành/marketing chung toàn công ty (`general`, `marketing`: Thuê văn phòng, Điện nước, Phần mềm...). | `code` (`CP_DA_01`...), `name`, `expense_scope` (`project`, `general`, `marketing`, `salary`). |
| **22** | **`expenses`** | **Phiếu Chi phí Thực tế**: Lưu mọi khoản chi phí phát sinh. Chi phí gắn `project_id` được tính thẳng vào Chi phí trực tiếp của dự án đó (khi `status = 'Đã duyệt'`); chi phí không gắn dự án là Chi phí gián tiếp toàn công ty. | `expense_code` (`PC-...`), `project_id` (nullable), `category_id`, `expense_scope`, `amount`, `status` (`Chờ duyệt`, `Đã duyệt`, `Từ chối`). |
| **23** | **`cost_allocations`** | **Bảng Phân bổ Chi phí Gián tiếp vào Dự án**: Khi Kế toán chạy công cụ phân bổ chi phí chung (tiền văn phòng, marketing...) vào các dự án theo tỷ lệ Doanh thu hoặc chia đều, kết quả phân bổ cho từng dự án được lưu tại đây để tính **Lợi nhuận ròng sau phân bổ**. | `expense_id` (FK $\rightarrow$ `expenses.id`), `project_id` (FK $\rightarrow$ `projects.id`), `allocation_method`, `allocated_amount`. |

---

### Nhóm VI: Chấm công, Nghỉ phép, Tăng ca (OT) & Bảng lương (5 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **24** | **`attendance`** | **Nhật ký Chấm công Hàng ngày**: Lưu giờ `check_in`, `check_out`, phương thức chấm công (`Web`, `Điện thoại`, `QR Code`, `GPS`), số phút đi muộn (`late_minutes`), về sớm (`early_leave_minutes`), số công tính lương (`work_day_credit`), nội dung giải trình của nhân viên và lịch sử Quản lý duyệt sửa công (`adjustment_log`). | `employee_id`, `work_date` (Unique theo từng nhân viên/ngày), `check_in`, `check_out`, `late_minutes`, `explanation_status`, `adjustment_log` (JSONB). |
| **25** | **`leave_requests`** | **Đơn Xin Nghỉ phép**: Lưu các đơn xin nghỉ phép năm, nghỉ ốm, nghỉ việc riêng, nghỉ không lương... Hệ thống tự động đánh dấu đơn có hưởng lương (`is_paid`) hay không để cuối tháng cộng vào bảng lương khi đơn ở trạng thái `Đã duyệt`. | `employee_id`, `leave_type`, `is_paid`, `start_date`, `end_date`, `total_days`, `status`. |
| **26** | **`overtime_requests`** | **Đơn Đăng ký Tăng ca (OT)**: Lưu phiếu đăng ký làm thêm giờ (gắn với dự án cụ thể nếu tăng ca chạy deadline dự án), số giờ làm thêm (`total_hours`), loại ngày tăng ca và hệ số nhân lương (`multiplier`: `1.5`, `2.0`, `3.0`). | `employee_id`, `project_id`, `overtime_date`, `total_hours`, `overtime_type`, `multiplier`, `status`. |
| **27** | **`payroll`** | **Kỳ Bảng lương Tháng**: Quản lý thông tin tổng quát của bảng lương từng tháng/năm (`month`, `year`), số ngày công chuẩn áp dụng, trạng thái bảng lương (`Nháp`, `Chờ duyệt`, `Đã duyệt`, `Đã khóa`) và lịch sử mở khóa bảng lương (`unlock_history`). Khi `status = 'Đã khóa'`, không ai được sửa số liệu lương trừ khi Super Admin mở khóa có nhập lý do. | `payroll_code` (`BL-202611`), `month`, `year`, `standard_work_days`, `status`, `unlock_history` (JSONB). |
| **28** | **`payroll_details`** | **Chi tiết Phiếu lương Từng Nhân viên**: Lưu kết quả tính lương chi tiết của từng nhân sự trong kỳ lương đó: lương cơ bản, ngày công thực tế, ngày nghỉ hưởng lương, giờ OT, lương theo ngày công, phụ cấp, thưởng, tiền tăng ca, khấu trừ hợp lệ, bảo hiểm/thuế, tạm ứng và **Lương thực lĩnh (`net_salary`)**. | `payroll_id` (FK $\rightarrow$ `payroll.id`), `employee_id` (FK $\rightarrow$ `employees.id`), `actual_work_days`, `overtime_pay`, `net_salary`. |

---

### Nhóm VII: Cấu hình Tham số Động, Thông báo & Nhật ký Kiểm toán (2 bảng)

| STT | Tên bảng trong Supabase | Ý nghĩa & Mục đích sử dụng trong hệ thống | Các cột & Liên kết quan trọng |
| :-: | :--- | :--- | :--- |
| **29** | **`system_settings`** | **Tham số Cấu hình Động**: Lưu các cài đặt vận hành có thể chỉnh sửa ngay trên giao diện mà không cần sửa code: số ngày công chuẩn tháng (`standard_work_days`), thuế VAT mặc định (`default_vat_rate`), danh sách trạng thái dự án, danh sách loại Job thiết kế, hệ số OT... | `key` (Primary Key), `value` (JSONB), `description`. |
| **30** | **`notifications`** & **`audit_logs`** | - **`notifications`**: Lưu các thông báo nhắc việc và cảnh báo tự động trên thanh chuông thông báo.<br>- **`audit_logs`**: **Nhật ký Kiểm toán Hệ thống (Audit Trail)** — tự động ghi lại mọi thao tác quan trọng (Ai làm `actor_name`, Vai trò gì `actor_role`, Ở phân hệ nào `action_module`, Hành động gì `action_type`, Dữ liệu trước khi sửa `old_data` và sau khi sửa `new_data`). | `actor_name`, `action_module`, `action_type`, `target_id`, `old_data` (JSONB), `new_data` (JSONB), `created_at`. |

---

## 3. Hướng dẫn Chạy Dự án

1. **Cài đặt thư viện**:
   ```powershell
   npm install
   ```
2. **Khởi chạy đồng thời Backend MVC & Frontend (tự động mở trình duyệt tại `http://localhost:5173`)**:
   ```powershell
   npm run dev
   ```
3. **Kiểm tra TypeScript & Đóng gói Production**:
   ```powershell
   npm run build
   ```
