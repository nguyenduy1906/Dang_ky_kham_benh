-- Dữ liệu giả lập cho schema 20 bảng. File này xóa toàn bộ dữ liệu cũ.
BEGIN;

-- Xóa dữ liệu cũ để có thể chạy lại file seed nhiều lần.
TRUNCATE TABLE
    nurse_assignment,
    role_request,
    article,
    notification,
    review,
    prescription_item,
    medical_record,
    payment,
    visit_transfer_log,
    visit_status_log,
    visit,
    work_schedule,
    room,
    doctor_profile,
    department,
    patient,
    auth_token,
    users,
    role,
    system_configuration
RESTART IDENTITY CASCADE;

-- 1. ROLE
-- Schema chỉ cho phép đúng 5 role_name nên bảng này có 5 bản ghi.
INSERT INTO role (role_id, role_name, description, requires_approval) VALUES
(1, 'USER', 'Tài khoản người dùng/bệnh nhân', 0),
(2, 'DOCTOR', 'Bác sĩ thực hiện khám và cập nhật hồ sơ bệnh án', 1),
(3, 'RECEPTIONIST', 'Lễ tân tiếp nhận, tạo lượt khám và hỗ trợ check-in', 1),
(4, 'NURSE', 'Điều dưỡng hỗ trợ hàng chờ và quy trình khám', 1),
(5, 'ADMIN', 'Quản trị toàn bộ hệ thống', 1);

-- Mật khẩu chung cho tài khoản mẫu: Demo-password-123! (chỉ dùng cho đồ án).
-- 2. USERS
-- 15 tài khoản: 10 bác sĩ + admin + lễ tân + điều dưỡng + 2 bệnh nhân có tài khoản.
INSERT INTO users
(user_id, role_id, full_name, phone, email, password_hash, approval_status, account_status, email_verified, created_at, updated_at)
VALUES
(1, 5, 'Nguyễn Minh Quản', '0901000001', 'admin@medicare.vn', 'scrypt:32768:8:1$TzRov4OpXM52fqr0$a70f4d0f1d0d73b064c6972d5850cd739ad026c748471e2c1f727d63b27ec1928dec31a0e076f1dc01969da38e0fbec1dc177c255d6ba46bfd45cc0d648ae4d8', 'APPROVED', 'ACTIVE', 1, '2026-09-01 08:00:00+07', '2026-09-01 08:00:00+07'),
(2, 3, 'Trần Thu Hà', '0901000002', 'reception@medicare.vn', 'scrypt:32768:8:1$rCIoTb7k0koEXBB6$e3f96c6914f72363c7cc8dcf3a700ecf03c10df7fbc8f93c2c970085bca32fa072684e4f70cf5d103b95553d776578379e63390910a943ba1ab6ac842b15f4d7', 'APPROVED', 'ACTIVE', 1, '2026-09-01 08:05:00+07', '2026-09-01 08:05:00+07'),
(3, 4, 'Lê Ngọc Anh', '0901000003', 'nurse@medicare.vn', 'scrypt:32768:8:1$PKouPS3tXLxRHk4F$1d36ff3047c161c50fc2c8f823ae2736af641a7b1c653e9b9e1ab2e9b317a4e599776927ad496c71a54bff6ae681f4e154295f7a3099f825009b3ed5d02f56fa', 'APPROVED', 'ACTIVE', 1, '2026-09-01 08:10:00+07', '2026-09-01 08:10:00+07'),
(4, 1, 'Phạm Văn Nam', '0901000004', 'nam.pham@example.com', 'scrypt:32768:8:1$dA7ACycDcrJ2gQT9$961504856822478f1c6c2a29c5a202019ab4acc62cb37b71854c37462f8c7ab834df9f6e1dfe17ec05ebc795f3910509591199496eb76413fc37d3debfb82ca1', 'APPROVED', 'ACTIVE', 1, '2026-09-02 09:00:00+07', '2026-09-02 09:00:00+07'),
(5, 1, 'Nguyễn Thị Lan', '0901000005', 'lan.nguyen@example.com', 'scrypt:32768:8:1$evvg3IgeAKdPiXFR$3c58c93448385e3a0cce1a8f5f0114deac12e3f4db28858fac8e4ca0d61abac6e70ed146f320d17c8ce2b20a9a3a441338f4730c6388c470b723f0d46da95320', 'APPROVED', 'ACTIVE', 1, '2026-09-02 09:10:00+07', '2026-09-02 09:10:00+07'),
(6, 2, 'BS. Nguyễn Hoàng Minh', '0902000001', 'minh.nguyen@medicare.vn', 'scrypt:32768:8:1$ibleQCTB6h7UCjph$244e57008cd614a2e7245a16867978cbd0c40fffcdfaad7bdcd63f7aa6c5315a89f7a2de251adc0d18fae48db7393af9cf17684105ec348189a89980033c76b3', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:00:00+07', '2026-09-03 08:00:00+07'),
(7, 2, 'BS. Trần Quốc Bảo', '0902000002', 'bao.tran@medicare.vn', 'scrypt:32768:8:1$PtqCEuifB515upSH$693151d573a3ac2fc75b5d776964ba1aba030663e247775930d0a677207f8f1988ad16ba6292cc6ea61da7734d4761c026ea671aeb684c08f2697efcb7ebb606', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:10:00+07', '2026-09-03 08:10:00+07'),
(8, 2, 'BS. Lê Thu Trang', '0902000003', 'trang.le@medicare.vn', 'scrypt:32768:8:1$IeZHr9LZzEdGHTx0$25f6c1dd29cbc87252f09b65a719ffb4ad112c78a2402654bb17dfea84372f92ba32c7560292fe97adf8081f4b61479ed584438eb76b4f18fc6367f531a75f39', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:20:00+07', '2026-09-03 08:20:00+07'),
(9, 2, 'BS. Phạm Đức Long', '0902000004', 'long.pham@medicare.vn', 'scrypt:32768:8:1$vkXSgjOpRBfi5gHu$4b7e7fa46bfda750384c65243d2502cffd91e4e4c08299d0a3c32d67b6d365f961aef0f04128319b279581368caf822737e622e6e1edadc852a4a3761e7f6509', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:30:00+07', '2026-09-03 08:30:00+07'),
(10, 2, 'BS. Vũ Minh Anh', '0902000005', 'anh.vu@medicare.vn', 'scrypt:32768:8:1$rjGq1poyGzaRdOEo$bd9595c712ec6806eaf958c259e373cab4d6c1e3373157c78a3cf8f93ac08132806ae4e3c52ae195bbaf08cf3cc797e93bc066aba435300a7e245d1b3bf5f5f3', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:40:00+07', '2026-09-03 08:40:00+07'),
(11, 2, 'BS. Đỗ Hải Yến', '0902000006', 'yen.do@medicare.vn', 'scrypt:32768:8:1$K3VaBPDtqxfLUDEJ$11fa8db189497c5c8cc8384d6e4f2d9a7c779702077f4e6527f09d0abb1275f83788a4ed52048f47f285fe47a360668cfd6e5cdf648fb7b4fa9887a3d849b271', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:50:00+07', '2026-09-03 08:50:00+07'),
(12, 2, 'BS. Bùi Thanh Tùng', '0902000007', 'tung.bui@medicare.vn', 'scrypt:32768:8:1$pfPLHhaanfw5hEiB$bdb69d563ccacc2288c21ee9fa50fcd512b6cc2978bdf51912d6c266819599873e6d518a91b03a0977aa8087b169c8bb5a079efd7c998ed9b7093822893a7b6e', 'APPROVED', 'ACTIVE', 1, '2026-09-03 09:00:00+07', '2026-09-03 09:00:00+07'),
(13, 2, 'BS. Hoàng Mai Linh', '0902000008', 'linh.hoang@medicare.vn', 'scrypt:32768:8:1$Zp8Shp3hVOcOwWQi$08fff47ed2bcad535d9c8ced364b009858fe7d3fb49c4241eb281add318163d0da3a3f74cf84d230cfe2abf06607b085e3f8187c272f658d3fac15b0920773c2', 'APPROVED', 'ACTIVE', 1, '2026-09-03 09:10:00+07', '2026-09-03 09:10:00+07'),
(14, 2, 'BS. Đặng Quang Huy', '0902000009', 'huy.dang@medicare.vn', 'scrypt:32768:8:1$9R5HR8gfrOdfjx0o$3ca055c33d74c9f24af8fe322bee9d1517880505c21b88008dd38a0f4f3be8f6764c4414ca749c2fdbfb0ee027094280a9cbf6afb9cc8d2d88ec746f60626772', 'APPROVED', 'ACTIVE', 1, '2026-09-03 09:20:00+07', '2026-09-03 09:20:00+07'),
(15, 2, 'BS. Nguyễn Khánh Vy', '0902000010', 'vy.nguyen@medicare.vn', 'scrypt:32768:8:1$V0xG66wTlekKb7Bm$c816147853ffde1d07d4d92e38186c20d5451a70d28968714b02d613db7e6d7ea2e58e396a7761c76769b0ce73b242cf8dd9d30c9dd56fb679048978a34f6154', 'APPROVED', 'ACTIVE', 1, '2026-09-03 09:30:00+07', '2026-09-03 09:30:00+07');

-- 3. AUTH_TOKEN
INSERT INTO auth_token
(token_id, user_id, token_type, token_hash, expires_at, used_at, created_at)
VALUES
(1, 4, 'VERIFY_EMAIL', 'token_hash_001', '2026-09-02 10:00:00+07', '2026-09-02 09:20:00+07', '2026-09-02 09:00:00+07'),
(2, 5, 'RESET_PASSWORD', 'token_hash_002', '2026-09-10 11:00:00+07', NULL, '2026-09-10 10:30:00+07'),
(3, 6, 'OTP', 'token_hash_003', '2026-09-12 08:15:00+07', '2026-09-12 08:05:00+07', '2026-09-12 08:00:00+07'),
(4, 7, 'RESET_PASSWORD', 'token_hash_004', '2026-09-13 09:30:00+07', NULL, '2026-09-13 09:00:00+07'),
(5, 8, 'VERIFY_EMAIL', 'token_hash_005', '2026-09-14 10:00:00+07', '2026-09-14 09:15:00+07', '2026-09-14 09:00:00+07'),
(6, 9, 'OTP', 'token_hash_006', '2026-09-15 14:10:00+07', NULL, '2026-09-15 14:00:00+07'),
(7, 10, 'RESET_PASSWORD', 'token_hash_007', '2026-09-16 15:30:00+07', '2026-09-16 15:10:00+07', '2026-09-16 15:00:00+07'),
(8, 11, 'VERIFY_EMAIL', 'token_hash_008', '2026-09-17 16:00:00+07', NULL, '2026-09-17 15:00:00+07'),
(9, 12, 'OTP', 'token_hash_009', '2026-09-18 08:10:00+07', '2026-09-18 08:06:00+07', '2026-09-18 08:00:00+07'),
(10, 13, 'RESET_PASSWORD', 'token_hash_010', '2026-09-19 09:45:00+07', NULL, '2026-09-19 09:15:00+07');

-- 4. PATIENT
INSERT INTO patient
(patient_id, user_id, full_name, dob, gender, id_card, address, phone, health_insurance, relationship, created_at, updated_at, archived_at)
VALUES
(1, 4, 'Phạm Văn Nam', '1998-05-12', 'Nam', '001098000001', 'Cầu Giấy, Hà Nội', '0911000001', 'HN401000001', 'SELF', '2026-09-10 08:00:00+07', '2026-09-10 08:00:00+07', NULL),
(2, 5, 'Nguyễn Thị Lan', '2001-11-20', 'Nữ', '001201000002', 'Đống Đa, Hà Nội', '0911000002', 'HN401000002', 'SELF', '2026-09-10 08:10:00+07', '2026-09-10 08:10:00+07', NULL),
(3, NULL, 'Trần Văn Hùng', '1985-03-08', 'Nam', '001085000003', 'Thanh Xuân, Hà Nội', '0911000003', 'HN401000003', 'OTHER', '2026-09-10 08:20:00+07', '2026-09-10 08:20:00+07', NULL),
(4, NULL, 'Lê Thị Hương', '1992-07-17', 'Nữ', '001192000004', 'Hoàng Mai, Hà Nội', '0911000004', 'HN401000004', 'OTHER', '2026-09-10 08:30:00+07', '2026-09-10 08:30:00+07', NULL),
(5, NULL, 'Vũ Đức Anh', '1976-01-25', 'Nam', '001076000005', 'Long Biên, Hà Nội', '0911000005', 'HN401000005', 'OTHER', '2026-09-10 08:40:00+07', '2026-09-10 08:40:00+07', NULL),
(6, NULL, 'Đỗ Minh Châu', '2015-09-03', 'Nữ', NULL, 'Nam Từ Liêm, Hà Nội', '0911000006', 'TE401000006', 'CHILD', '2026-09-10 08:50:00+07', '2026-09-10 08:50:00+07', NULL),
(7, NULL, 'Bùi Thị Mai', '1968-12-02', 'Nữ', '001168000007', 'Ba Đình, Hà Nội', '0911000007', 'HN401000007', 'PARENT', '2026-09-10 09:00:00+07', '2026-09-10 09:00:00+07', NULL),
(8, NULL, 'Hoàng Quốc Việt', '1989-06-14', 'Nam', '001089000008', 'Hai Bà Trưng, Hà Nội', '0911000008', 'HN401000008', 'SPOUSE', '2026-09-10 09:10:00+07', '2026-09-10 09:10:00+07', NULL),
(9, NULL, 'Đặng Thu Phương', '1996-10-29', 'Nữ', '001196000009', 'Hà Đông, Hà Nội', '0911000009', 'HN401000009', 'OTHER', '2026-09-10 09:20:00+07', '2026-09-10 09:20:00+07', NULL),
(10, NULL, 'Nguyễn Gia Bảo', '2008-04-11', 'Nam', '001208000010', 'Tây Hồ, Hà Nội', '0911000010', 'HS401000010', 'CHILD', '2026-09-10 09:30:00+07', '2026-09-10 09:30:00+07', '2026-10-01 09:00:00+07');

-- 5. DEPARTMENT
INSERT INTO department
(department_id, name, description, is_active, created_at, updated_at)
VALUES
(1, 'Nội tổng quát', 'Khám và điều trị các bệnh nội khoa thông thường', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(2, 'Tim mạch', 'Khám các bệnh lý tim và mạch máu', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(3, 'Da liễu', 'Khám và điều trị bệnh da, tóc và móng', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(4, 'Nhi', 'Khám bệnh cho trẻ em và thanh thiếu niên', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(5, 'Sản phụ khoa', 'Chăm sóc sức khỏe sản phụ khoa', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(6, 'Tai Mũi Họng', 'Khám tai, mũi, họng và các bệnh liên quan', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(7, 'Mắt', 'Khám và điều trị các bệnh lý về mắt', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(8, 'Răng Hàm Mặt', 'Khám và điều trị răng, hàm, mặt', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(9, 'Cơ Xương Khớp', 'Khám cơ, xương, khớp và vận động', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07'),
(10, 'Thần kinh', 'Khám các bệnh lý hệ thần kinh', 1, '2026-09-01 07:00:00+07', '2026-09-01 07:00:00+07');

-- 6. DOCTOR_PROFILE
INSERT INTO doctor_profile
(doctor_profile_id, user_id, department_id, academic_degree, specialization, experience_years, introduction, consultation_fee, avatar_url, is_active, created_at, updated_at)
VALUES
(1, 6, 1, 'Thạc sĩ', 'Nội khoa', 12, 'Bác sĩ chuyên khám nội tổng quát.', 250000, '/uploads/doctors/doctor_01.jpg', 1, '2026-09-04 08:00:00+07', '2026-09-04 08:00:00+07'),
(2, 7, 2, 'Tiến sĩ', 'Tim mạch', 15, 'Bác sĩ chuyên khoa tim mạch.', 350000, '/uploads/doctors/doctor_02.jpg', 1, '2026-09-04 08:10:00+07', '2026-09-04 08:10:00+07'),
(3, 8, 3, 'Chuyên khoa I', 'Da liễu', 9, 'Bác sĩ chuyên điều trị bệnh da.', 280000, '/uploads/doctors/doctor_03.jpg', 1, '2026-09-04 08:20:00+07', '2026-09-04 08:20:00+07'),
(4, 9, 4, 'Thạc sĩ', 'Nhi khoa', 11, 'Bác sĩ chuyên khám và điều trị trẻ em.', 300000, '/uploads/doctors/doctor_04.jpg', 1, '2026-09-04 08:30:00+07', '2026-09-04 08:30:00+07'),
(5, 10, 5, 'Chuyên khoa II', 'Sản phụ khoa', 14, 'Bác sĩ chuyên sản phụ khoa.', 380000, '/uploads/doctors/doctor_05.jpg', 1, '2026-09-04 08:40:00+07', '2026-09-04 08:40:00+07'),
(6, 11, 6, 'Thạc sĩ', 'Tai Mũi Họng', 10, 'Bác sĩ chuyên tai mũi họng.', 270000, '/uploads/doctors/doctor_06.jpg', 1, '2026-09-04 08:50:00+07', '2026-09-04 08:50:00+07'),
(7, 12, 7, 'Chuyên khoa I', 'Nhãn khoa', 8, 'Bác sĩ chuyên khám và điều trị mắt.', 260000, '/uploads/doctors/doctor_07.jpg', 1, '2026-09-04 09:00:00+07', '2026-09-04 09:00:00+07'),
(8, 13, 8, 'Thạc sĩ', 'Răng Hàm Mặt', 13, 'Bác sĩ chuyên răng hàm mặt.', 320000, '/uploads/doctors/doctor_08.jpg', 1, '2026-09-04 09:10:00+07', '2026-09-04 09:10:00+07'),
(9, 14, 9, 'Tiến sĩ', 'Cơ Xương Khớp', 16, 'Bác sĩ chuyên cơ xương khớp.', 360000, '/uploads/doctors/doctor_09.jpg', 1, '2026-09-04 09:20:00+07', '2026-09-04 09:20:00+07'),
(10, 15, 10, 'Chuyên khoa II', 'Thần kinh', 17, 'Bác sĩ chuyên thần kinh.', 400000, '/uploads/doctors/doctor_10.jpg', 1, '2026-09-04 09:30:00+07', '2026-09-04 09:30:00+07');

-- 7. ROOM
INSERT INTO room
(room_id, department_id, room_name, description, is_active, created_at, updated_at)
VALUES
(1, 1, 'Phòng Nội 101', 'Tầng 1 - Khu A', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(2, 2, 'Phòng Tim mạch 201', 'Tầng 2 - Khu A', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(3, 3, 'Phòng Da liễu 202', 'Tầng 2 - Khu A', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(4, 4, 'Phòng Nhi 102', 'Tầng 1 - Khu B', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(5, 5, 'Phòng Sản 301', 'Tầng 3 - Khu B', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(6, 6, 'Phòng TMH 203', 'Tầng 2 - Khu B', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(7, 7, 'Phòng Mắt 204', 'Tầng 2 - Khu C', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(8, 8, 'Phòng RHM 205', 'Tầng 2 - Khu C', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(9, 9, 'Phòng CXK 302', 'Tầng 3 - Khu C', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07'),
(10, 10, 'Phòng Thần kinh 303', 'Tầng 3 - Khu C', 1, '2026-09-05 08:00:00+07', '2026-09-05 08:00:00+07');

-- 8. WORK_SCHEDULE
INSERT INTO work_schedule
(schedule_id, doctor_profile_id, room_id, work_date, start_time, end_time, max_quota, booked_count, schedule_status, unavailable_reason, created_at, updated_at)
VALUES
(1, 1, 1, '2026-09-20', '08:00', '11:30', 12, 1, 'OPEN', NULL, '2026-09-10 10:00:00+07', '2026-09-10 10:00:00+07'),
(2, 2, 2, '2026-09-21', '08:00', '11:30', 10, 1, 'OPEN', NULL, '2026-09-10 10:05:00+07', '2026-09-10 10:05:00+07'),
(3, 3, 3, '2026-09-22', '13:30', '17:00', 10, 1, 'OPEN', NULL, '2026-09-10 10:10:00+07', '2026-09-10 10:10:00+07'),
(4, 4, 4, '2026-09-23', '08:00', '11:30', 15, 1, 'OPEN', NULL, '2026-09-10 10:15:00+07', '2026-09-10 10:15:00+07'),
(5, 5, 5, '2026-09-24', '13:30', '17:00', 8, 1, 'OPEN', NULL, '2026-09-10 10:20:00+07', '2026-09-10 10:20:00+07'),
(6, 6, 6, '2026-09-25', '08:00', '11:30', 12, 1, 'OPEN', NULL, '2026-09-10 10:25:00+07', '2026-09-10 10:25:00+07'),
(7, 7, 7, '2026-09-26', '08:00', '11:30', 10, 1, 'OPEN', NULL, '2026-09-10 10:30:00+07', '2026-09-10 10:30:00+07'),
(8, 8, 8, '2026-09-27', '13:30', '17:00', 10, 1, 'OPEN', NULL, '2026-09-10 10:35:00+07', '2026-09-10 10:35:00+07'),
(9, 9, 9, '2026-09-28', '08:00', '11:30', 12, 1, 'OPEN', NULL, '2026-09-10 10:40:00+07', '2026-09-10 10:40:00+07'),
(10, 10, 10, '2026-09-29', '13:30', '17:00', 9, 1, 'OPEN', NULL, '2026-09-10 10:45:00+07', '2026-09-10 10:45:00+07');

-- 9. VISIT
INSERT INTO visit
(visit_id, visit_type, patient_id, doctor_profile_id, schedule_id, room_id, created_by_id, consultation_fee_snapshot, deposit_amount_snapshot, symptoms,
 visit_status, queue_number, estimated_exam_at, qr_code, hold_expires_at, checked_in_at,
 cancelled_by_id, cancel_reason, cancelled_at, created_at, updated_at)
VALUES
(1, 'ONLINE', 1, 1, 1, 1, 4, 250000, 75000, 'Đau đầu, mệt mỏi kéo dài', 'COMPLETED', 1, '2026-09-20 08:15:00+07', 'QR-VISIT-001', NULL, '2026-09-20 08:05:00+07', NULL, NULL, NULL, '2026-09-19 20:00:00+07', '2026-09-20 09:00:00+07'),
(2, 'WALK_IN', 2, 2, 2, 2, 2, 350000, 0, 'Đau ngực nhẹ khi vận động', 'COMPLETED', 2, '2026-09-21 09:00:00+07', NULL, NULL, '2026-09-21 08:40:00+07', NULL, NULL, NULL, '2026-09-21 08:30:00+07', '2026-09-21 10:00:00+07'),
(3, 'ONLINE', 3, 3, 3, 3, 4, 280000, 84000, 'Ngứa và nổi mẩn đỏ ở cánh tay', 'COMPLETED', 1, '2026-09-22 14:00:00+07', 'QR-VISIT-003', NULL, '2026-09-22 13:45:00+07', NULL, NULL, NULL, '2026-09-21 19:00:00+07', '2026-09-22 14:40:00+07'),
(4, 'WALK_IN', 4, 4, 4, 4, 2, 300000, 0, 'Trẻ sốt và ho trong hai ngày', 'COMPLETED', 3, '2026-09-23 09:20:00+07', NULL, NULL, '2026-09-23 08:55:00+07', NULL, NULL, NULL, '2026-09-23 08:50:00+07', '2026-09-23 10:10:00+07'),
(5, 'ONLINE', 5, 5, 5, 5, 5, 380000, 114000, 'Đau bụng dưới và rối loạn chu kỳ', 'COMPLETED', 1, '2026-09-24 14:10:00+07', 'QR-VISIT-005', NULL, '2026-09-24 13:50:00+07', NULL, NULL, NULL, '2026-09-23 21:10:00+07', '2026-09-24 15:00:00+07'),
(6, 'WALK_IN', 6, 6, 6, 6, 2, 270000, 0, 'Đau họng, nghẹt mũi', 'COMPLETED', 4, '2026-09-25 09:30:00+07', NULL, NULL, '2026-09-25 09:05:00+07', NULL, NULL, NULL, '2026-09-25 09:00:00+07', '2026-09-25 10:15:00+07'),
(7, 'ONLINE', 7, 7, 7, 7, 4, 260000, 78000, 'Mờ mắt khi đọc gần', 'COMPLETED', 1, '2026-09-26 08:45:00+07', 'QR-VISIT-007', NULL, '2026-09-26 08:25:00+07', NULL, NULL, NULL, '2026-09-25 20:00:00+07', '2026-09-26 09:30:00+07'),
(8, 'WALK_IN', 8, 8, 8, 8, 2, 320000, 0, 'Đau răng hàm dưới bên phải', 'COMPLETED', 5, '2026-09-27 15:00:00+07', NULL, NULL, '2026-09-27 14:35:00+07', NULL, NULL, NULL, '2026-09-27 14:30:00+07', '2026-09-27 15:50:00+07'),
(9, 'ONLINE', 9, 9, 9, 9, 5, 360000, 108000, 'Đau khớp gối khi đi lại', 'COMPLETED', 1, '2026-09-28 09:10:00+07', 'QR-VISIT-009', NULL, '2026-09-28 08:50:00+07', NULL, NULL, NULL, '2026-09-27 18:30:00+07', '2026-09-28 10:00:00+07'),
(10, 'WALK_IN', 10, 10, 10, 10, 2, 400000, 0, 'Đau đầu kèm mất ngủ', 'COMPLETED', 6, '2026-09-29 14:30:00+07', NULL, NULL, '2026-09-29 14:05:00+07', NULL, NULL, NULL, '2026-09-29 14:00:00+07', '2026-09-29 15:20:00+07');

-- 10. VISIT_STATUS_LOG
INSERT INTO visit_status_log
(log_id, visit_id, old_status, new_status, changed_by_id, note, changed_at)
VALUES
(1, 1, 'IN_PROGRESS', 'COMPLETED', 6, 'Hoàn tất khám nội tổng quát', '2026-09-20 09:00:00+07'),
(2, 2, 'IN_PROGRESS', 'COMPLETED', 7, 'Hoàn tất khám tim mạch', '2026-09-21 10:00:00+07'),
(3, 3, 'IN_PROGRESS', 'COMPLETED', 8, 'Hoàn tất khám da liễu', '2026-09-22 14:40:00+07'),
(4, 4, 'IN_PROGRESS', 'COMPLETED', 9, 'Hoàn tất khám nhi', '2026-09-23 10:10:00+07'),
(5, 5, 'IN_PROGRESS', 'COMPLETED', 10, 'Hoàn tất khám sản phụ khoa', '2026-09-24 15:00:00+07'),
(6, 6, 'IN_PROGRESS', 'COMPLETED', 11, 'Hoàn tất khám tai mũi họng', '2026-09-25 10:15:00+07'),
(7, 7, 'IN_PROGRESS', 'COMPLETED', 12, 'Hoàn tất khám mắt', '2026-09-26 09:30:00+07'),
(8, 8, 'IN_PROGRESS', 'COMPLETED', 13, 'Hoàn tất khám răng hàm mặt', '2026-09-27 15:50:00+07'),
(9, 9, 'IN_PROGRESS', 'COMPLETED', 14, 'Hoàn tất khám cơ xương khớp', '2026-09-28 10:00:00+07'),
(10, 10, 'IN_PROGRESS', 'COMPLETED', 15, 'Hoàn tất khám thần kinh', '2026-09-29 15:20:00+07');

-- 11. VISIT_TRANSFER_LOG
-- Dữ liệu lịch sử chuyển bác sĩ để kiểm thử chức năng audit.
INSERT INTO visit_transfer_log
(log_id, visit_id, old_doctor_id, new_doctor_id, transferred_by_id, reason, transferred_at)
VALUES
(1, 1, 2, 1, 2, 'Điều chỉnh về đúng chuyên khoa Nội tổng quát', '2026-09-19 20:10:00+07'),
(2, 2, 1, 2, 2, 'Triệu chứng liên quan tim mạch', '2026-09-21 08:35:00+07'),
(3, 3, 4, 3, 2, 'Chuyển sang bác sĩ Da liễu', '2026-09-21 19:10:00+07'),
(4, 4, 3, 4, 2, 'Bệnh nhân là trẻ em', '2026-09-23 08:52:00+07'),
(5, 5, 6, 5, 2, 'Chuyển đúng chuyên khoa Sản phụ khoa', '2026-09-23 21:20:00+07'),
(6, 6, 5, 6, 2, 'Triệu chứng thuộc Tai Mũi Họng', '2026-09-25 09:02:00+07'),
(7, 7, 8, 7, 2, 'Chuyển sang bác sĩ chuyên khoa Mắt', '2026-09-25 20:10:00+07'),
(8, 8, 7, 8, 2, 'Đau răng cần bác sĩ Răng Hàm Mặt', '2026-09-27 14:32:00+07'),
(9, 9, 10, 9, 2, 'Đau khớp cần bác sĩ Cơ Xương Khớp', '2026-09-27 18:40:00+07'),
(10, 10, 9, 10, 2, 'Triệu chứng thần kinh và mất ngủ', '2026-09-29 14:02:00+07');

-- 12. PAYMENT
INSERT INTO payment
(payment_id, visit_id, payment_type, amount, payment_method, transaction_status, transaction_code, paid_at, refunded_at, created_at, updated_at)
VALUES
(1, 1, 'EXAM_FEE', 175000, 'EWALLET', 'SUCCESS', 'TXN20260920001', '2026-09-20 17:10:00+07', NULL, '2026-09-20 17:10:00+07', '2026-09-20 17:10:00+07'),
(2, 2, 'EXAM_FEE', 350000, 'CASH', 'SUCCESS', 'TXN20260921002', '2026-09-21 10:05:00+07', NULL, '2026-09-21 10:00:00+07', '2026-09-21 10:05:00+07'),
(3, 3, 'EXAM_FEE', 196000, 'BANK', 'SUCCESS', 'TXN20260922003', '2026-09-22 17:10:00+07', NULL, '2026-09-22 17:10:00+07', '2026-09-22 17:10:00+07'),
(4, 4, 'EXAM_FEE', 300000, 'CASH', 'SUCCESS', 'TXN20260923004', '2026-09-23 10:15:00+07', NULL, '2026-09-23 10:10:00+07', '2026-09-23 10:15:00+07'),
(5, 5, 'EXAM_FEE', 266000, 'CARD', 'SUCCESS', 'TXN20260924005', '2026-09-24 17:10:00+07', NULL, '2026-09-24 17:10:00+07', '2026-09-24 17:10:00+07'),
(6, 6, 'EXAM_FEE', 270000, 'CASH', 'SUCCESS', 'TXN20260925006', '2026-09-25 10:20:00+07', NULL, '2026-09-25 10:15:00+07', '2026-09-25 10:20:00+07'),
(7, 7, 'EXAM_FEE', 182000, 'EWALLET', 'SUCCESS', 'TXN20260926007', '2026-09-26 17:10:00+07', NULL, '2026-09-26 17:10:00+07', '2026-09-26 17:10:00+07'),
(8, 8, 'EXAM_FEE', 320000, 'BANK', 'SUCCESS', 'TXN20260927008', '2026-09-27 15:55:00+07', NULL, '2026-09-27 15:50:00+07', '2026-09-27 15:55:00+07'),
(9, 9, 'EXAM_FEE', 252000, 'CARD', 'SUCCESS', 'TXN20260928009', '2026-09-28 17:10:00+07', NULL, '2026-09-28 17:10:00+07', '2026-09-28 17:10:00+07'),
(10, 10, 'EXAM_FEE', 400000, 'CASH', 'SUCCESS', 'TXN20260929010', '2026-09-29 15:25:00+07', NULL, '2026-09-29 15:20:00+07', '2026-09-29 15:25:00+07');

-- Thanh toán cọc giả lập 30%; EXAM_FEE phía trên là phần còn lại.
INSERT INTO payment
(payment_id, visit_id, payment_type, amount, payment_method, transaction_status, transaction_code, paid_at, refunded_at, created_at, updated_at)
VALUES
(11, 1, 'DEPOSIT', 75000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-001', '2026-09-19 20:02:00+07', NULL, '2026-09-19 20:02:00+07', '2026-09-19 20:02:00+07'),
(12, 3, 'DEPOSIT', 84000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-003', '2026-09-21 19:02:00+07', NULL, '2026-09-21 19:02:00+07', '2026-09-21 19:02:00+07'),
(13, 5, 'DEPOSIT', 114000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-005', '2026-09-23 21:12:00+07', NULL, '2026-09-23 21:12:00+07', '2026-09-23 21:12:00+07'),
(14, 7, 'DEPOSIT', 78000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-007', '2026-09-25 20:02:00+07', NULL, '2026-09-25 20:02:00+07', '2026-09-25 20:02:00+07'),
(15, 9, 'DEPOSIT', 108000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-009', '2026-09-27 18:32:00+07', NULL, '2026-09-27 18:32:00+07', '2026-09-27 18:32:00+07');

-- 13. MEDICAL_RECORD
INSERT INTO medical_record
(record_id, visit_id, diagnosis, treatment, doctor_notes, examined_at, created_at, updated_at)
VALUES
(1, 1, 'Suy nhược nhẹ do thiếu ngủ', 'Nghỉ ngơi, uống đủ nước và theo dõi', 'Tái khám nếu đau đầu kéo dài trên 7 ngày.', '2026-09-20 08:45:00+07', '2026-09-20 08:50:00+07', '2026-09-20 08:50:00+07'),
(2, 2, 'Theo dõi tăng huyết áp', 'Điều chỉnh sinh hoạt và theo dõi huyết áp', 'Đo huyết áp tại nhà trong 7 ngày.', '2026-09-21 09:40:00+07', '2026-09-21 09:45:00+07', '2026-09-21 09:45:00+07'),
(3, 3, 'Viêm da tiếp xúc', 'Tránh tác nhân kích ứng, dùng thuốc bôi', 'Giữ vùng da sạch và khô.', '2026-09-22 14:25:00+07', '2026-09-22 14:30:00+07', '2026-09-22 14:30:00+07'),
(4, 4, 'Viêm đường hô hấp trên', 'Hạ sốt, uống nước ấm và theo dõi', 'Theo dõi nhiệt độ của trẻ.', '2026-09-23 09:50:00+07', '2026-09-23 09:55:00+07', '2026-09-23 09:55:00+07'),
(5, 5, 'Rối loạn kinh nguyệt chức năng', 'Theo dõi chu kỳ và tái khám', 'Khuyến nghị siêu âm nếu triệu chứng tái diễn.', '2026-09-24 14:40:00+07', '2026-09-24 14:45:00+07', '2026-09-24 14:45:00+07'),
(6, 6, 'Viêm họng cấp', 'Súc họng và điều trị triệu chứng', 'Hạn chế đồ lạnh.', '2026-09-25 09:55:00+07', '2026-09-25 10:00:00+07', '2026-09-25 10:00:00+07'),
(7, 7, 'Tật khúc xạ nhẹ', 'Đo kính và điều chỉnh thói quen sử dụng màn hình', 'Tái khám mắt sau 6 tháng.', '2026-09-26 09:10:00+07', '2026-09-26 09:15:00+07', '2026-09-26 09:15:00+07'),
(8, 8, 'Sâu răng hàm', 'Làm sạch và hẹn trám răng', 'Vệ sinh răng miệng sau ăn.', '2026-09-27 15:30:00+07', '2026-09-27 15:35:00+07', '2026-09-27 15:35:00+07'),
(9, 9, 'Thoái hóa khớp gối mức độ nhẹ', 'Vật lý trị liệu và giảm tải khớp', 'Hạn chế vận động quá sức.', '2026-09-28 09:40:00+07', '2026-09-28 09:45:00+07', '2026-09-28 09:45:00+07'),
(10, 10, 'Rối loạn giấc ngủ', 'Điều chỉnh giờ ngủ và giảm chất kích thích', 'Theo dõi thêm triệu chứng đau đầu.', '2026-09-29 15:00:00+07', '2026-09-29 15:05:00+07', '2026-09-29 15:05:00+07');

-- 14. PRESCRIPTION_ITEM
INSERT INTO prescription_item
(item_id, record_id, medication_name, dosage, quantity, instructions)
VALUES
(1, 1, 'Paracetamol 500mg', '1 viên khi đau, tối đa 3 lần/ngày', 10, 'Uống sau ăn khi cần'),
(2, 2, 'Amlodipine 5mg', '1 viên/ngày', 14, 'Uống buổi sáng theo hướng dẫn bác sĩ'),
(3, 3, 'Hydrocortisone cream 1%', 'Bôi lớp mỏng 2 lần/ngày', 1, 'Không bôi lên vùng da trầy xước'),
(4, 4, 'Paracetamol trẻ em', 'Theo cân nặng khi sốt', 10, 'Dùng khi sốt từ 38.5°C'),
(5, 5, 'Vitamin E 400 IU', '1 viên/ngày', 14, 'Uống sau bữa ăn'),
(6, 6, 'Nước muối sinh lý 0.9%', 'Súc họng 3 lần/ngày', 2, 'Dùng sáng, trưa và tối'),
(7, 7, 'Nước mắt nhân tạo', '1-2 giọt/mắt, 3 lần/ngày', 1, 'Không chạm đầu lọ vào mắt'),
(8, 8, 'Ibuprofen 200mg', '1 viên khi đau', 6, 'Uống sau ăn, không dùng quá liều'),
(9, 9, 'Glucosamine 1500mg', '1 liều/ngày', 30, 'Uống sau bữa sáng'),
(10, 10, 'Melatonin 3mg', '1 viên trước khi ngủ', 10, 'Uống trước giờ ngủ khoảng 30 phút');

-- 15. REVIEW
INSERT INTO review
(review_id, record_id, rating, comment, created_at, updated_at)
VALUES
(1, 1, 5, 'Bác sĩ tư vấn rõ ràng và nhiệt tình.', '2026-09-20 20:00:00+07', '2026-09-20 20:00:00+07'),
(2, 2, 4, 'Khám kỹ, thời gian chờ hơi lâu.', '2026-09-21 20:00:00+07', '2026-09-21 20:00:00+07'),
(3, 3, 5, 'Bác sĩ giải thích dễ hiểu.', '2026-09-22 20:00:00+07', '2026-09-22 20:00:00+07'),
(4, 4, 5, 'Bác sĩ thân thiện với trẻ nhỏ.', '2026-09-23 20:00:00+07', '2026-09-23 20:00:00+07'),
(5, 5, 4, 'Quy trình đặt lịch thuận tiện.', '2026-09-24 20:00:00+07', '2026-09-24 20:00:00+07'),
(6, 6, 5, 'Khám nhanh và đúng giờ.', '2026-09-25 20:00:00+07', '2026-09-25 20:00:00+07'),
(7, 7, 4, 'Bác sĩ tư vấn chi tiết.', '2026-09-26 20:00:00+07', '2026-09-26 20:00:00+07'),
(8, 8, 5, 'Cơ sở sạch sẽ, bác sĩ tận tình.', '2026-09-27 20:00:00+07', '2026-09-27 20:00:00+07'),
(9, 9, 4, 'Hướng dẫn điều trị rõ ràng.', '2026-09-28 20:00:00+07', '2026-09-28 20:00:00+07'),
(10, 10, 5, 'Trải nghiệm khám tốt.', '2026-09-29 20:00:00+07', '2026-09-29 20:00:00+07');

-- 16. NOTIFICATION
INSERT INTO notification
(notification_id, user_id, notification_type, title, content, reference_type, reference_id, is_read, created_at)
VALUES
(1, 4, 'APPOINTMENT', 'Đặt lịch thành công', 'Lịch khám #1 của bạn đã được xác nhận.', 'VISIT', 1, 1, '2026-09-19 20:03:00+07'),
(2, 5, 'APPOINTMENT', 'Check-in thành công', 'Bạn đã check-in cho lượt khám #2.', 'VISIT', 2, 1, '2026-09-21 08:41:00+07'),
(3, 6, 'SCHEDULE', 'Lịch khám mới', 'Bạn có một lượt khám trong lịch làm việc ngày 20/09/2026.', 'SCHEDULE', 1, 1, '2026-09-19 20:05:00+07'),
(4, 7, 'SCHEDULE', 'Lượt khám mới', 'Có bệnh nhân được tiếp nhận vào phòng Tim mạch.', 'VISIT', 2, 0, '2026-09-21 08:42:00+07'),
(5, 8, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã đánh giá lượt khám Da liễu.', 'REVIEW', 3, 0, '2026-09-22 20:01:00+07'),
(6, 9, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã đánh giá lượt khám Nhi.', 'REVIEW', 4, 0, '2026-09-23 20:01:00+07'),
(7, 10, 'PAYMENT', 'Thanh toán thành công', 'Thanh toán cho lượt khám #5 đã thành công.', 'PAYMENT', 5, 1, '2026-09-23 21:13:00+07'),
(8, 11, 'SCHEDULE', 'Lịch khám hoàn tất', 'Lượt khám #6 đã được hoàn tất.', 'VISIT', 6, 1, '2026-09-25 10:16:00+07'),
(9, 12, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã gửi đánh giá cho lượt khám Mắt.', 'REVIEW', 7, 0, '2026-09-26 20:01:00+07'),
(10, 15, 'SYSTEM', 'Cập nhật hệ thống', 'Hệ thống đã cập nhật cấu hình nhắc lịch khám.', NULL, NULL, 0, '2026-10-01 09:00:00+07');

-- 17. ARTICLE
INSERT INTO article
(article_id, author_id, title, slug, category, thumbnail_url, content, is_active, published_at, created_at, updated_at)
VALUES
(1, 1, '5 thói quen giúp bảo vệ sức khỏe tim mạch', '5-thoi-quen-bao-ve-tim-mach', 'Tim mạch', '/uploads/articles/tim-mach-01.jpg', 'Bài viết cung cấp các thói quen sinh hoạt hỗ trợ chăm sóc sức khỏe tim mạch.', 1, '2026-09-10 08:00:00+07', '2026-09-09 15:00:00+07', '2026-09-09 15:00:00+07'),
(2, 6, 'Khi nào nên đi khám nội tổng quát?', 'khi-nao-nen-kham-noi-tong-quat', 'Sức khỏe', '/uploads/articles/noi-01.jpg', 'Một số dấu hiệu phổ biến cho thấy bạn nên sắp xếp lịch khám tổng quát.', 1, '2026-09-11 08:00:00+07', '2026-09-10 16:00:00+07', '2026-09-10 16:00:00+07'),
(3, 8, 'Cách chăm sóc da khi thời tiết thay đổi', 'cham-soc-da-khi-thoi-tiet-thay-doi', 'Da liễu', '/uploads/articles/da-lieu-01.jpg', 'Hướng dẫn cơ bản giúp giảm khô da và kích ứng khi thời tiết thay đổi.', 1, '2026-09-12 08:00:00+07', '2026-09-11 16:00:00+07', '2026-09-11 16:00:00+07'),
(4, 9, 'Theo dõi sốt ở trẻ đúng cách', 'theo-doi-sot-o-tre', 'Nhi', '/uploads/articles/nhi-01.jpg', 'Các lưu ý cơ bản khi theo dõi nhiệt độ và tình trạng của trẻ tại nhà.', 1, '2026-09-13 08:00:00+07', '2026-09-12 16:00:00+07', '2026-09-12 16:00:00+07'),
(5, 10, 'Khám phụ khoa định kỳ có ý nghĩa gì?', 'kham-phu-khoa-dinh-ky', 'Sản phụ khoa', '/uploads/articles/san-01.jpg', 'Khám định kỳ giúp theo dõi sức khỏe và phát hiện sớm bất thường.', 1, '2026-09-14 08:00:00+07', '2026-09-13 16:00:00+07', '2026-09-13 16:00:00+07'),
(6, 11, 'Phòng ngừa viêm họng trong mùa lạnh', 'phong-ngua-viem-hong-mua-lanh', 'Tai Mũi Họng', '/uploads/articles/tmh-01.jpg', 'Một số biện pháp đơn giản giúp giảm nguy cơ viêm họng khi thời tiết lạnh.', 1, '2026-09-15 08:00:00+07', '2026-09-14 16:00:00+07', '2026-09-14 16:00:00+07'),
(7, 12, 'Bảo vệ mắt khi dùng máy tính lâu', 'bao-ve-mat-khi-dung-may-tinh', 'Mắt', '/uploads/articles/mat-01.jpg', 'Các nguyên tắc nghỉ mắt và bố trí màn hình giúp giảm mỏi mắt.', 1, '2026-09-16 08:00:00+07', '2026-09-15 16:00:00+07', '2026-09-15 16:00:00+07'),
(8, 13, '5 lưu ý chăm sóc răng miệng hằng ngày', '5-luu-y-cham-soc-rang-mieng', 'Răng Hàm Mặt', '/uploads/articles/rhm-01.jpg', 'Thói quen vệ sinh đúng giúp hạn chế sâu răng và các bệnh răng miệng.', 1, '2026-09-17 08:00:00+07', '2026-09-16 16:00:00+07', '2026-09-16 16:00:00+07'),
(9, 14, 'Vận động thế nào để bảo vệ khớp gối?', 'van-dong-bao-ve-khop-goi', 'Cơ Xương Khớp', '/uploads/articles/cxk-01.jpg', 'Gợi ý vận động vừa sức và các lưu ý giúp hạn chế quá tải khớp gối.', 1, '2026-09-18 08:00:00+07', '2026-09-17 16:00:00+07', '2026-09-17 16:00:00+07'),
(10, 15, 'Các nguyên tắc cơ bản để ngủ tốt hơn', 'nguyen-tac-ngu-tot-hon', 'Thần kinh', '/uploads/articles/than-kinh-01.jpg', 'Duy trì giờ ngủ ổn định và giảm chất kích thích có thể hỗ trợ chất lượng giấc ngủ.', 1, '2026-09-19 08:00:00+07', '2026-09-18 16:00:00+07', '2026-09-18 16:00:00+07');

-- 18. SYSTEM_CONFIGURATION
INSERT INTO system_configuration
(config_key, config_value, description, updated_at)
VALUES
('APPOINTMENT_HOLD_MINUTES', '10', 'Số phút giữ lịch chờ thanh toán', '2026-10-01 08:00:00+07'),
('DEFAULT_DEPOSIT_PERCENT', '30', 'Tỷ lệ đặt cọc mặc định theo phần trăm', '2026-10-01 08:00:00+07'),
('NO_SHOW_FORFEIT_DEPOSIT', 'true', 'No-show sẽ mất khoản đặt cọc', '2026-10-01 08:00:00+07'),
('CHECKIN_EARLY_MINUTES', '30', 'Cho phép check-in sớm tối đa bao nhiêu phút', '2026-10-01 08:00:00+07'),
('CHECKIN_LATE_MINUTES', '15', 'Khoảng trễ tối đa khi check-in', '2026-10-01 08:00:00+07'),
('REMINDER_BEFORE_HOURS', '24', 'Gửi thông báo nhắc lịch trước giờ khám', '2026-10-01 08:00:00+07'),
('MAX_REVIEW_RATING', '5', 'Điểm đánh giá tối đa', '2026-10-01 08:00:00+07'),
('HOSPITAL_NAME', 'Medicare Demo Clinic', 'Tên cơ sở khám bệnh hiển thị trên hệ thống', '2026-10-01 08:00:00+07'),
('SUPPORT_PHONE', '19001234', 'Số điện thoại hỗ trợ khách hàng', '2026-10-01 08:00:00+07'),
('ALLOW_WALK_IN', 'true', 'Cho phép lễ tân tạo lượt khám trực tiếp', '2026-10-01 08:00:00+07');

-- 19. ROLE_REQUEST (Yêu cầu đổi vai trò)
-- Yêu cầu 1 đã duyệt: users #3 hiện có vai trò NURSE. Yêu cầu chờ/từ chối không đổi role.
INSERT INTO role_request
(request_id, user_id, requested_role_id, reason, request_status, reviewed_by_id, reviewed_at, review_note, created_at, updated_at)
VALUES
(1, 3, 4, 'Đăng ký làm điều dưỡng tại phòng khám', 'APPROVED', 1, '2026-09-01 08:10:00+07', 'Đã xác nhận hồ sơ điều dưỡng', '2026-09-01 08:00:00+07', '2026-09-01 08:10:00+07'),
(2, 4, 3, 'Đăng ký hỗ trợ công việc lễ tân', 'PENDING', NULL, NULL, NULL, '2026-10-02 09:00:00+07', '2026-10-02 09:00:00+07'),
(3, 5, 2, 'Đăng ký vai trò bác sĩ', 'REJECTED', 1, '2026-10-03 10:00:00+07', 'Chưa có hồ sơ chuyên môn phù hợp', '2026-10-02 10:00:00+07', '2026-10-03 10:00:00+07');

-- 20. NURSE_ASSIGNMENT (Phân công điều dưỡng theo ca)
-- Ca diễn ra ở các ngày khác nhau; điều dưỡng #3 được admin #1 phân công.
INSERT INTO nurse_assignment
(assignment_id, nurse_id, schedule_id, assigned_by_id, assigned_at, revoked_at, revoked_by_id, note)
VALUES
(1, 3, 1, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 1'),
(2, 3, 2, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 2'),
(3, 3, 3, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 3'),
(4, 3, 4, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 4'),
(5, 3, 5, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 5'),
(6, 3, 6, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 6'),
(7, 3, 7, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 7'),
(8, 3, 8, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 8'),
(9, 3, 9, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 9'),
(10, 3, 10, 1, '2026-09-11 08:00:00+07', NULL, NULL, 'Hỗ trợ tiếp nhận và chăm sóc trong ca 10'),
(11, 3, 1, 1, '2026-09-10 11:00:00+07', '2026-09-10 12:00:00+07', 1, 'Phân công cũ đã thu hồi, ca 1 được giao lại bằng bản ghi 1');

-- Đồng bộ sequence sau khi seed ID thủ công để lần INSERT tiếp theo không bị trùng khóa chính.
SELECT setval(pg_get_serial_sequence('role', 'role_id'), (SELECT MAX(role_id) FROM role), true);
SELECT setval(pg_get_serial_sequence('users', 'user_id'), (SELECT MAX(user_id) FROM users), true);
SELECT setval(pg_get_serial_sequence('auth_token', 'token_id'), (SELECT MAX(token_id) FROM auth_token), true);
SELECT setval(pg_get_serial_sequence('patient', 'patient_id'), (SELECT MAX(patient_id) FROM patient), true);
SELECT setval(pg_get_serial_sequence('department', 'department_id'), (SELECT MAX(department_id) FROM department), true);
SELECT setval(pg_get_serial_sequence('doctor_profile', 'doctor_profile_id'), (SELECT MAX(doctor_profile_id) FROM doctor_profile), true);
SELECT setval(pg_get_serial_sequence('room', 'room_id'), (SELECT MAX(room_id) FROM room), true);
SELECT setval(pg_get_serial_sequence('work_schedule', 'schedule_id'), (SELECT MAX(schedule_id) FROM work_schedule), true);
SELECT setval(pg_get_serial_sequence('visit', 'visit_id'), (SELECT MAX(visit_id) FROM visit), true);
SELECT setval(pg_get_serial_sequence('visit_status_log', 'log_id'), (SELECT MAX(log_id) FROM visit_status_log), true);
SELECT setval(pg_get_serial_sequence('visit_transfer_log', 'log_id'), (SELECT MAX(log_id) FROM visit_transfer_log), true);
SELECT setval(pg_get_serial_sequence('payment', 'payment_id'), (SELECT MAX(payment_id) FROM payment), true);
SELECT setval(pg_get_serial_sequence('medical_record', 'record_id'), (SELECT MAX(record_id) FROM medical_record), true);
SELECT setval(pg_get_serial_sequence('prescription_item', 'item_id'), (SELECT MAX(item_id) FROM prescription_item), true);
SELECT setval(pg_get_serial_sequence('review', 'review_id'), (SELECT MAX(review_id) FROM review), true);
SELECT setval(pg_get_serial_sequence('notification', 'notification_id'), (SELECT MAX(notification_id) FROM notification), true);
SELECT setval(pg_get_serial_sequence('article', 'article_id'), (SELECT MAX(article_id) FROM article), true);

SELECT setval(pg_get_serial_sequence('role_request', 'request_id'), (SELECT MAX(request_id) FROM role_request), true);
SELECT setval(pg_get_serial_sequence('nurse_assignment', 'assignment_id'), (SELECT MAX(assignment_id) FROM nurse_assignment), true);

COMMIT;

-- Kiểm tra nhanh số bản ghi sau khi seed:
SELECT 'role' AS table_name, COUNT(*) AS row_count FROM role
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'auth_token', COUNT(*) FROM auth_token
UNION ALL SELECT 'patient', COUNT(*) FROM patient
UNION ALL SELECT 'department', COUNT(*) FROM department
UNION ALL SELECT 'doctor_profile', COUNT(*) FROM doctor_profile
UNION ALL SELECT 'room', COUNT(*) FROM room
UNION ALL SELECT 'work_schedule', COUNT(*) FROM work_schedule
UNION ALL SELECT 'visit', COUNT(*) FROM visit
UNION ALL SELECT 'visit_status_log', COUNT(*) FROM visit_status_log
UNION ALL SELECT 'visit_transfer_log', COUNT(*) FROM visit_transfer_log
UNION ALL SELECT 'payment', COUNT(*) FROM payment
UNION ALL SELECT 'medical_record', COUNT(*) FROM medical_record
UNION ALL SELECT 'prescription_item', COUNT(*) FROM prescription_item
UNION ALL SELECT 'review', COUNT(*) FROM review
UNION ALL SELECT 'notification', COUNT(*) FROM notification
UNION ALL SELECT 'article', COUNT(*) FROM article
UNION ALL SELECT 'system_configuration', COUNT(*) FROM system_configuration
UNION ALL SELECT 'role_request', COUNT(*) FROM role_request
UNION ALL SELECT 'nurse_assignment', COUNT(*) FROM nurse_assignment
ORDER BY table_name;

