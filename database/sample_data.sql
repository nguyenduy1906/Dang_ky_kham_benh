-- Dữ liệu giả lập cho schema 21 bảng. File này xóa toàn bộ dữ liệu cũ.
BEGIN;
-- Chặn dữ liệu bị mất dấu khi truyền qua shell trước khi xóa dữ liệu cũ.
-- Nạp file UTF-8; có thể sao chép file vào container rồi dùng psql -f.
DO $encoding$
BEGIN
    IF 'Tiếng Việt' <> U&'Ti\1EBFng Vi\1EC7t' THEN
        RAISE EXCEPTION 'sample_data.sql must be loaded as UTF-8; copy the file and use psql -f';
    END IF;
END;
$encoding$;

-- Xóa dữ liệu cũ để có thể chạy lại file seed nhiều lần.
TRUNCATE TABLE
    department_leadership,
    patient_delegate,
    nurse_assignment,
    role_request,
    article,
    notification,
    review,
    prescription_item,
    medical_record,
    payment,
    encounter_transfer_log,
    encounter_status_log,
    encounter,
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
(11, 2, 'BS. Đỗ Hải Nam', '0902000006', 'yen.do@medicare.vn', 'scrypt:32768:8:1$K3VaBPDtqxfLUDEJ$11fa8db189497c5c8cc8384d6e4f2d9a7c779702077f4e6527f09d0abb1275f83788a4ed52048f47f285fe47a360668cfd6e5cdf648fb7b4fa9887a3d849b271', 'APPROVED', 'ACTIVE', 1, '2026-09-03 08:50:00+07', '2026-09-03 08:50:00+07'),
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

-- Mẫu tài khoản bệnh nhân theo số điện thoại; mật khẩu demo chung chỉ dùng cho bộ seed.
-- Tài khoản tự sinh qua API dùng mật khẩu ngẫu nhiên và không trả mật khẩu cho client.
UPDATE users u SET phone=p.phone FROM patient p WHERE p.user_id=u.user_id;
INSERT INTO users(user_id,role_id,full_name,phone,password_hash,approval_status)
SELECT 15+p.patient_id-2, 1, p.full_name, p.phone,
       (SELECT password_hash FROM users WHERE user_id=4), 'APPROVED'
FROM patient p WHERE p.user_id IS NULL;
UPDATE patient p SET user_id=u.user_id FROM users u WHERE p.user_id IS NULL AND p.phone=u.phone;

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
(1, 6, 1, 'Thạc sĩ', 'Nội khoa', 12, 'Bác sĩ chuyên khám nội tổng quát.', 250000, '/uploads/avatars/c4a8d50caedad0d8fed2dff0cfab0309.jpg', 1, '2026-09-04 08:00:00+07', '2026-09-04 08:00:00+07'),
(2, 7, 2, 'Tiến sĩ', 'Tim mạch', 15, 'Bác sĩ chuyên khoa tim mạch.', 350000, '/uploads/avatars/4f257e4de22c28a9b8790c500251990c.jpg', 1, '2026-09-04 08:10:00+07', '2026-09-04 08:10:00+07'),
(3, 8, 3, 'Chuyên khoa I', 'Da liễu', 9, 'Bác sĩ chuyên điều trị bệnh da.', 280000, '/uploads/avatars/7465c5220fd21bd49ef7913ad3f326d8.jpg', 1, '2026-09-04 08:20:00+07', '2026-09-04 08:20:00+07'),
(4, 9, 4, 'Thạc sĩ', 'Nhi khoa', 11, 'Bác sĩ chuyên khám và điều trị trẻ em.', 300000, '/uploads/avatars/2afd17e4e62cafa329d63b130480a807.jpg', 1, '2026-09-04 08:30:00+07', '2026-09-04 08:30:00+07'),
(5, 10, 5, 'Chuyên khoa II', 'Sản phụ khoa', 14, 'Bác sĩ chuyên sản phụ khoa.', 380000, '/uploads/avatars/1ba03faa4029ed403c4cb76576d72fb2.jpg', 1, '2026-09-04 08:40:00+07', '2026-09-04 08:40:00+07'),
(6, 11, 6, 'Thạc sĩ', 'Tai Mũi Họng', 10, 'Bác sĩ chuyên tai mũi họng.', 270000, '/uploads/avatars/107a45e9f9ff0768d4b25ba9ed28a96a.jpg', 1, '2026-09-04 08:50:00+07', '2026-09-04 08:50:00+07'),
(7, 12, 7, 'Chuyên khoa I', 'Nhãn khoa', 8, 'Bác sĩ chuyên khám và điều trị mắt.', 260000, '/uploads/avatars/2c58ba7f456ec5765c3812fdcd183d7b.jpg', 1, '2026-09-04 09:00:00+07', '2026-09-04 09:00:00+07'),
(8, 13, 8, 'Thạc sĩ', 'Răng Hàm Mặt', 13, 'Bác sĩ chuyên răng hàm mặt.', 320000, '/uploads/avatars/d2d73ede697069072a82604c8adb21f5.jpg', 1, '2026-09-04 09:10:00+07', '2026-09-04 09:10:00+07'),
(9, 14, 9, 'Tiến sĩ', 'Cơ Xương Khớp', 16, 'Bác sĩ chuyên cơ xương khớp.', 360000, '/uploads/avatars/a6ac79c44c9e0e56e83c03297452b13e.jpg', 1, '2026-09-04 09:20:00+07', '2026-09-04 09:20:00+07'),
(10, 15, 10, 'Chuyên khoa II', 'Thần kinh', 17, 'Bác sĩ chuyên thần kinh.', 400000, '/uploads/avatars/2bea9973014ba16451820b91412045c6.jpg', 1, '2026-09-04 09:30:00+07', '2026-09-04 09:30:00+07');

-- Hồ sơ đào tạo/công tác minh họa cho 10 bác sĩ mẫu, không thay phí khám hoặc ảnh.
UPDATE doctor_profile SET introduction='Bác sĩ chuyên khám nội tổng quát.

Quá trình đào tạo:
- 2018: Thạc sĩ chuyên ngành Nội khoa, Đại học Y Hà Nội.
- 2014: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Nội khoa tại Bệnh viện NEU Medical.
- 2014–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Nội khoa.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=1 AND user_id=6;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên khoa tim mạch.

Quá trình đào tạo:
- 2019: Tiến sĩ Y học chuyên ngành Tim mạch, Đại học Y Hà Nội.
- 2015: Thạc sĩ chuyên ngành Tim mạch, Đại học Y Hà Nội.
- 2011: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Tim mạch tại Bệnh viện NEU Medical.
- 2011–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Tim mạch.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=2 AND user_id=7;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên điều trị bệnh da.

Quá trình đào tạo:
- 2020: Bác sĩ chuyên khoa I chuyên ngành Da liễu, Đại học Y Hà Nội.
- 2017: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Da liễu tại Bệnh viện NEU Medical.
- 2017–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Da liễu.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=3 AND user_id=8;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên khám và điều trị trẻ em.

Quá trình đào tạo:
- 2019: Thạc sĩ chuyên ngành Nhi khoa, Đại học Y Hà Nội.
- 2015: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Nhi khoa tại Bệnh viện NEU Medical.
- 2015–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Nhi khoa.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=4 AND user_id=9;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên sản phụ khoa.

Quá trình đào tạo:
- 2020: Bác sĩ chuyên khoa II chuyên ngành Sản phụ khoa, Đại học Y Hà Nội.
- 2015: Bác sĩ chuyên khoa I chuyên ngành Sản phụ khoa, Đại học Y Hà Nội.
- 2012: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Sản phụ khoa tại Bệnh viện NEU Medical.
- 2012–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Sản phụ khoa.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=5 AND user_id=10;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên tai mũi họng.

Quá trình đào tạo:
- 2020: Thạc sĩ chuyên ngành Tai Mũi Họng, Đại học Y Hà Nội.
- 2016: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Tai Mũi Họng tại Bệnh viện NEU Medical.
- 2016–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Tai Mũi Họng.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=6 AND user_id=11;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên khám và điều trị mắt.

Quá trình đào tạo:
- 2021: Bác sĩ chuyên khoa I chuyên ngành Nhãn khoa, Đại học Y Hà Nội.
- 2018: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Nhãn khoa tại Bệnh viện NEU Medical.
- 2018–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Nhãn khoa.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=7 AND user_id=12;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên răng hàm mặt.

Quá trình đào tạo:
- 2017: Thạc sĩ chuyên ngành Răng Hàm Mặt, Đại học Y Hà Nội.
- 2013: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Răng Hàm Mặt tại Bệnh viện NEU Medical.
- 2013–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Răng Hàm Mặt.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=8 AND user_id=13;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên cơ xương khớp.

Quá trình đào tạo:
- 2018: Tiến sĩ Y học chuyên ngành Cơ Xương Khớp, Đại học Y Hà Nội.
- 2014: Thạc sĩ chuyên ngành Cơ Xương Khớp, Đại học Y Hà Nội.
- 2010: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Cơ Xương Khớp tại Bệnh viện NEU Medical.
- 2010–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Cơ Xương Khớp.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=9 AND user_id=14;
UPDATE doctor_profile SET introduction='Bác sĩ chuyên thần kinh.

Quá trình đào tạo:
- 2017: Bác sĩ chuyên khoa II chuyên ngành Thần kinh, Đại học Y Hà Nội.
- 2012: Bác sĩ chuyên khoa I chuyên ngành Thần kinh, Đại học Y Hà Nội.
- 2009: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Thần kinh tại Bệnh viện NEU Medical.
- 2009–2020: Khám, điều trị và theo dõi người bệnh trong lĩnh vực Thần kinh.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.' WHERE doctor_profile_id=10 AND user_id=15;

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
(schedule_id, doctor_profile_id, room_id, work_date, start_time, end_time, max_quota, booked_count, slot_minutes, schedule_status, unavailable_reason, created_at, updated_at)
VALUES
(1, 1, 1, '2026-09-20', '08:00', '11:30', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:00:00+07', '2026-09-10 10:00:00+07'),
(2, 2, 2, '2026-09-21', '08:00', '11:30', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:05:00+07', '2026-09-10 10:05:00+07'),
(3, 3, 3, '2026-09-22', '13:30', '17:00', 14, 1, 15, 'OPEN', NULL, '2026-09-10 10:10:00+07', '2026-09-10 10:10:00+07'),
(4, 4, 4, '2026-09-23', '08:00', '11:30', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:15:00+07', '2026-09-10 10:15:00+07'),
(5, 5, 5, '2026-09-24', '13:30', '17:00', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:20:00+07', '2026-09-10 10:20:00+07'),
(6, 6, 6, '2026-09-25', '08:00', '11:30', 14, 1, 15, 'OPEN', NULL, '2026-09-10 10:25:00+07', '2026-09-10 10:25:00+07'),
(7, 7, 7, '2026-09-26', '08:00', '11:30', 14, 1, 15, 'OPEN', NULL, '2026-09-10 10:30:00+07', '2026-09-10 10:30:00+07'),
(8, 8, 8, '2026-09-27', '13:30', '17:00', 14, 1, 15, 'OPEN', NULL, '2026-09-10 10:35:00+07', '2026-09-10 10:35:00+07'),
(9, 9, 9, '2026-09-28', '08:00', '11:30', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:40:00+07', '2026-09-10 10:40:00+07'),
(10, 10, 10, '2026-09-29', '13:30', '17:00', 7, 1, 30, 'OPEN', NULL, '2026-09-10 10:45:00+07', '2026-09-10 10:45:00+07');

-- Lịch đặt mới phục vụ demo: sáng/chiều cho 10 bác sĩ trong một tháng tới.
-- Tính theo ngày nạp mẫu tại Việt Nam; không sửa các ca/lượt khám lịch sử tháng 09.
-- Mỗi lần nạp mẫu đều có lịch từ ngày mai đến cùng ngày của tháng kế tiếp.
WITH demo_window AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Saigon')::date AS first_day
), demo_days AS (
    SELECT first_day + day_offset AS work_date
    FROM demo_window
    CROSS JOIN LATERAL generate_series(
        1, (first_day + INTERVAL '1 month')::date - first_day
    ) AS day_offset
), demo_shifts(start_time, end_time) AS (
    VALUES ('08:00'::time, '11:30'::time), ('13:30'::time, '17:00'::time)
)
INSERT INTO work_schedule
(schedule_id, doctor_profile_id, room_id, work_date, start_time, end_time,
 max_quota, booked_count, slot_minutes, schedule_status)
SELECT 10 + ROW_NUMBER() OVER (ORDER BY day.work_date, template.doctor_profile_id, shift.start_time),
       template.doctor_profile_id, template.room_id, day.work_date, shift.start_time, shift.end_time,
       210 / template.slot_minutes, 0, template.slot_minutes, 'OPEN'
FROM work_schedule template
CROSS JOIN demo_days day
CROSS JOIN demo_shifts shift
WHERE template.schedule_id BETWEEN 1 AND 10;

-- 9. ENCOUNTER
-- Các lượt mẫu không bị hủy: cancel_origin/refund_reference_at mặc định NULL.
INSERT INTO encounter
(encounter_id, encounter_type, patient_id, doctor_profile_id, schedule_id, room_id, created_by_id, consultation_fee_snapshot, deposit_amount_snapshot, symptoms,
 encounter_status, ticket_code, estimated_exam_at, appointment_end_at, qr_code, hold_expires_at, checked_in_at,
 cancelled_by_id, cancel_reason, cancelled_at, created_at, updated_at)
VALUES
(1, 'ONLINE', 1, 1, 1, 1, 4, 250000, 75000, 'Đau đầu, mệt mỏi kéo dài', 'COMPLETED', 'NEU-SAMPLE-001', '2026-09-20 08:30:00+07', '2026-09-20 08:30:00+07'::timestamptz + interval '30 minutes', 'QR-ENCOUNTER-001', NULL, '2026-09-20 08:05:00+07', NULL, NULL, NULL, '2026-09-19 20:00:00+07', '2026-09-20 09:00:00+07'),
(2, 'WALK_IN', 2, 2, 2, 2, 2, 350000, 0, 'Đau ngực nhẹ khi vận động', 'COMPLETED', 'NEU-SAMPLE-002', '2026-09-21 09:00:00+07', '2026-09-21 09:00:00+07'::timestamptz + interval '30 minutes', NULL, NULL, '2026-09-21 08:40:00+07', NULL, NULL, NULL, '2026-09-21 08:30:00+07', '2026-09-21 10:00:00+07'),
(3, 'ONLINE', 3, 3, 3, 3, 4, 280000, 84000, 'Ngứa và nổi mẩn đỏ ở cánh tay', 'COMPLETED', 'NEU-SAMPLE-003', '2026-09-22 14:00:00+07', '2026-09-22 14:00:00+07'::timestamptz + interval '15 minutes', 'QR-ENCOUNTER-003', NULL, '2026-09-22 13:45:00+07', NULL, NULL, NULL, '2026-09-21 19:00:00+07', '2026-09-22 14:40:00+07'),
(4, 'WALK_IN', 4, 4, 4, 4, 2, 300000, 0, 'Trẻ sốt và ho trong hai ngày', 'COMPLETED', 'NEU-SAMPLE-004', '2026-09-23 09:30:00+07', '2026-09-23 09:30:00+07'::timestamptz + interval '30 minutes', NULL, NULL, '2026-09-23 08:55:00+07', NULL, NULL, NULL, '2026-09-23 08:50:00+07', '2026-09-23 10:10:00+07'),
(5, 'ONLINE', 5, 5, 5, 5, 5, 380000, 114000, 'Đau bụng dưới và rối loạn chu kỳ', 'COMPLETED', 'NEU-SAMPLE-005', '2026-09-24 14:00:00+07', '2026-09-24 14:00:00+07'::timestamptz + interval '30 minutes', 'QR-ENCOUNTER-005', NULL, '2026-09-24 13:50:00+07', NULL, NULL, NULL, '2026-09-23 21:10:00+07', '2026-09-24 15:00:00+07'),
(6, 'WALK_IN', 6, 6, 6, 6, 2, 270000, 0, 'Đau họng, nghẹt mũi', 'COMPLETED', 'NEU-SAMPLE-006', '2026-09-25 09:30:00+07', '2026-09-25 09:30:00+07'::timestamptz + interval '15 minutes', NULL, NULL, '2026-09-25 09:05:00+07', NULL, NULL, NULL, '2026-09-25 09:00:00+07', '2026-09-25 10:15:00+07'),
(7, 'ONLINE', 7, 7, 7, 7, 4, 260000, 78000, 'Mờ mắt khi đọc gần', 'COMPLETED', 'NEU-SAMPLE-007', '2026-09-26 08:45:00+07', '2026-09-26 08:45:00+07'::timestamptz + interval '15 minutes', 'QR-ENCOUNTER-007', NULL, '2026-09-26 08:25:00+07', NULL, NULL, NULL, '2026-09-25 20:00:00+07', '2026-09-26 09:30:00+07'),
(8, 'WALK_IN', 8, 8, 8, 8, 2, 320000, 0, 'Đau răng hàm dưới bên phải', 'COMPLETED', 'NEU-SAMPLE-008', '2026-09-27 15:00:00+07', '2026-09-27 15:00:00+07'::timestamptz + interval '15 minutes', NULL, NULL, '2026-09-27 14:35:00+07', NULL, NULL, NULL, '2026-09-27 14:30:00+07', '2026-09-27 15:50:00+07'),
(9, 'ONLINE', 9, 9, 9, 9, 5, 360000, 108000, 'Đau khớp gối khi đi lại', 'COMPLETED', 'NEU-SAMPLE-009', '2026-09-28 09:00:00+07', '2026-09-28 09:00:00+07'::timestamptz + interval '30 minutes', 'QR-ENCOUNTER-009', NULL, '2026-09-28 08:50:00+07', NULL, NULL, NULL, '2026-09-27 18:30:00+07', '2026-09-28 10:00:00+07'),
(10, 'WALK_IN', 10, 10, 10, 10, 2, 400000, 0, 'Đau đầu kèm mất ngủ', 'COMPLETED', 'NEU-SAMPLE-010', '2026-09-29 14:30:00+07', '2026-09-29 14:30:00+07'::timestamptz + interval '30 minutes', NULL, NULL, '2026-09-29 14:05:00+07', NULL, NULL, NULL, '2026-09-29 14:00:00+07', '2026-09-29 15:20:00+07');

-- Lưu quan hệ đặt hộ để có thể chọn lại hồ sơ; chỉ xem lịch sử lượt chính mình đặt.
INSERT INTO patient_delegate(patient_id,user_id,relationship)
SELECT DISTINCT e.patient_id,e.created_by_id,COALESCE(NULLIF(p.relationship,'SELF'),'OTHER')
FROM encounter e JOIN patient p ON p.patient_id=e.patient_id
JOIN users u ON u.user_id=e.created_by_id JOIN role r ON r.role_id=u.role_id
WHERE r.role_name='USER' AND e.created_by_id<>p.user_id;

-- 10. ENCOUNTER_STATUS_LOG
INSERT INTO encounter_status_log
(log_id, encounter_id, old_status, new_status, changed_by_id, note, changed_at)
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

-- 11. ENCOUNTER_TRANSFER_LOG
-- Dữ liệu lịch sử chuyển bác sĩ để kiểm thử chức năng audit.
INSERT INTO encounter_transfer_log
(log_id, encounter_id, old_doctor_id, new_doctor_id, transferred_by_id, reason, transferred_at)
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
-- Giao dịch mẫu là lịch sử thu, không có REFUND: original_payment_id mặc định NULL.
-- Các trường audit nullable được API điền cho giao dịch mới; không tạo audit giả cho dữ liệu mẫu cũ.
INSERT INTO payment
(payment_id, encounter_id, payment_type, amount, payment_method, transaction_status, transaction_code, paid_at, refunded_at, created_at, updated_at)
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
(payment_id, encounter_id, payment_type, amount, payment_method, transaction_status, transaction_code, paid_at, refunded_at, created_at, updated_at)
VALUES
(11, 1, 'DEPOSIT', 75000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-001', '2026-09-19 20:02:00+07', NULL, '2026-09-19 20:02:00+07', '2026-09-19 20:02:00+07'),
(12, 3, 'DEPOSIT', 84000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-003', '2026-09-21 19:02:00+07', NULL, '2026-09-21 19:02:00+07', '2026-09-21 19:02:00+07'),
(13, 5, 'DEPOSIT', 114000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-005', '2026-09-23 21:12:00+07', NULL, '2026-09-23 21:12:00+07', '2026-09-23 21:12:00+07'),
(14, 7, 'DEPOSIT', 78000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-007', '2026-09-25 20:02:00+07', NULL, '2026-09-25 20:02:00+07', '2026-09-25 20:02:00+07'),
(15, 9, 'DEPOSIT', 108000, 'EWALLET', 'SUCCESS', 'DEMO-DEPOSIT-009', '2026-09-27 18:32:00+07', NULL, '2026-09-27 18:32:00+07', '2026-09-27 18:32:00+07');

-- 13. MEDICAL_RECORD
-- Bệnh án mẫu chưa có bản sửa qua API: version=0 và revision_history=[] theo mặc định schema.
INSERT INTO medical_record
(record_id, encounter_id, diagnosis, treatment, doctor_notes, examined_at, created_at, updated_at)
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
-- Thông báo mẫu thủ công có event_key=NULL; thông báo qua API/worker dùng khóa chống lặp.
INSERT INTO notification
(notification_id, user_id, notification_type, title, content, reference_type, reference_id, is_read, created_at)
VALUES
(1, 4, 'APPOINTMENT', 'Đặt lịch thành công', 'Lịch khám #1 của bạn đã được xác nhận.', 'ENCOUNTER', 1, 1, '2026-09-19 20:03:00+07'),
(2, 5, 'APPOINTMENT', 'Check-in thành công', 'Bạn đã check-in cho lượt khám #2.', 'ENCOUNTER', 2, 1, '2026-09-21 08:41:00+07'),
(3, 6, 'SCHEDULE', 'Lịch khám mới', 'Bạn có một lượt khám trong lịch làm việc ngày 20/09/2026.', 'SCHEDULE', 1, 1, '2026-09-19 20:05:00+07'),
(4, 7, 'SCHEDULE', 'Lượt khám mới', 'Có bệnh nhân được tiếp nhận vào phòng Tim mạch.', 'ENCOUNTER', 2, 0, '2026-09-21 08:42:00+07'),
(5, 8, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã đánh giá lượt khám Da liễu.', 'REVIEW', 3, 0, '2026-09-22 20:01:00+07'),
(6, 9, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã đánh giá lượt khám Nhi.', 'REVIEW', 4, 0, '2026-09-23 20:01:00+07'),
(7, 10, 'PAYMENT', 'Thanh toán thành công', 'Thanh toán cho lượt khám #5 đã thành công.', 'PAYMENT', 5, 1, '2026-09-23 21:13:00+07'),
(8, 11, 'SCHEDULE', 'Lịch khám hoàn tất', 'Lượt khám #6 đã được hoàn tất.', 'ENCOUNTER', 6, 1, '2026-09-25 10:16:00+07'),
(9, 12, 'REVIEW', 'Có đánh giá mới', 'Bệnh nhân đã gửi đánh giá cho lượt khám Mắt.', 'REVIEW', 7, 0, '2026-09-26 20:01:00+07'),
(10, 15, 'SYSTEM', 'Cập nhật hệ thống', 'Hệ thống đã cập nhật cấu hình nhắc lịch khám.', NULL, NULL, 0, '2026-10-01 09:00:00+07');

-- 17. ARTICLE
-- Nội dung có nguồn tham khảo, ảnh được chọn theo chủ đề và chú thích riêng.
INSERT INTO article
(article_id,author_id,title,slug,category,thumbnail_url,content,is_active,published_at,created_at,updated_at) VALUES
(1,1,'RSV và cúm mùa ở trẻ: Quan sát hô hấp để nhận biết diễn biến bất thường','benh-ho-hap-o-tre-rsv-va-cum-mua','Y học thường thức','/uploads/articles/d15603e6fc1db7baf5c53ee9ac7f0ab3.png','*Ho, sốt hay sổ mũi ở trẻ cần được theo dõi cùng nhịp thở, khả năng ăn uống và sự tỉnh táo. Nhận ra thay đổi sớm giúp gia đình tìm đến cơ sở y tế đúng lúc.*

## Vì sao trẻ nhỏ cần được quan sát sát hơn

Đường thở của trẻ nhỏ có kích thước hẹp. Phù nề và tăng tiết dịch có thể ảnh hưởng rõ đến việc lưu thông không khí, đặc biệt khi trẻ có viêm ở những đường thở nhỏ.

Trẻ sơ sinh, trẻ nhỏ, trẻ sinh non và trẻ có bệnh nền là những nhóm cần thận trọng. Những biểu hiện ban đầu có thể chưa phản ánh đầy đủ mức độ nặng, nên việc theo dõi phải tiếp tục khi tình trạng thay đổi.

Đi khám đúng thời điểm giúp bác sĩ đánh giá cả dấu hiệu hô hấp lẫn tình trạng toàn thân. Phụ huynh nên ghi nhận những thay đổi quan sát được để trao đổi rõ trong quá trình chăm sóc.

![Bác sĩ trao đổi với mẹ trong buổi khám cho trẻ nhỏ.](/uploads/articles/d15603e6fc1db7baf5c53ee9ac7f0ab3.png "Bác sĩ trao đổi với mẹ trong buổi khám cho trẻ nhỏ.")

## RSV và cúm có những biểu hiện khác nhau

RSV có thể gây biểu hiện giống cảm lạnh, sau đó một số trẻ xuất hiện khò khè, thở nhanh hoặc khó bú. RSV là một tác nhân gây viêm tiểu phế quản và viêm phổi ở trẻ nhỏ.

Cúm mùa thường có khởi phát đột ngột hơn với sốt, ho và mệt mỏi; trẻ nhỏ cũng có thể có những biểu hiện tiêu hóa hoặc giảm ăn, giảm bú. Cả hai tác nhân đều có thể đi kèm biến chứng hô hấp.

Không thể xác định tác nhân chỉ từ một triệu chứng. Điều cần làm là quan sát diễn biến và tìm đánh giá y tế phù hợp, tránh coi sốt ít đồng nghĩa bệnh nhẹ hoặc tự chọn thuốc theo tên virus phỏng đoán.

## Những dấu hiệu cần đưa trẻ đi đánh giá ngay

Cách thở là một dấu hiệu quan trọng. Thở nhanh, rút lõm lồng ngực, cánh mũi phập phồng hoặc mức gắng sức tăng cần được chú ý, đặc biệt khi thay đổi so với trạng thái thường ngày.

Cần đưa trẻ đến cơ sở y tế ngay khi có những biểu hiện sau:

- Khó thở rõ hoặc cách thở tăng gắng sức.
- Môi, lưỡi hoặc da chuyển màu tím.
- Li bì, khó đánh thức hay đáp ứng kém.
- Bỏ bú, không uống được hoặc có biểu hiện mất nước.
- Khoảng ngừng thở, co giật hoặc tình trạng xấu đi nhanh.

Đây là những tình huống cần được đánh giá trực tiếp tại cơ sở y tế. Bác sĩ sẽ kết hợp nhiều thông tin, bao gồm hô hấp, oxy máu, khả năng ăn uống và mức độ tỉnh táo, thay vì dựa vào một chỉ số đơn lẻ.

![Khuyến cáo phòng bệnh đường hô hấp: giữ vệ sinh, che miệng khi ho và bảo vệ người có nguy cơ.](/uploads/articles/e656d82fb47a099500c385f48336e829.jpg "Khuyến cáo phòng bệnh đường hô hấp: giữ vệ sinh, che miệng khi ho và bảo vệ người có nguy cơ.")

## Phòng bệnh theo tuổi và nguy cơ

Bệnh viện Bạch Mai đề cập tiêm phòng cúm theo khuyến cáo cùng các biện pháp dự phòng RSV dành cho những nhóm có chỉ định. Việc lựa chọn biện pháp cần trao đổi với bác sĩ, căn cứ tuổi, sức khỏe và khả năng tiếp cận phù hợp.

Rửa tay, hạn chế tiếp xúc với người đang mắc bệnh hô hấp, giữ môi trường thông thoáng và tránh khói thuốc là những thực hành cần duy trì trong sinh hoạt. Chúng cần đi cùng việc quan sát và tìm chăm sóc khi có biểu hiện bất thường.

Kháng sinh không điều trị được virus RSV hay cúm. Phụ huynh không nên tự cho trẻ dùng thuốc này; quyết định sử dụng phải do bác sĩ cân nhắc khi có tình huống cần điều trị nhiễm khuẩn.

Khi có thay đổi về cách thở hoặc tình trạng toàn thân, việc đưa trẻ đi đánh giá quan trọng hơn việc tiếp tục chờ xem nhiệt độ có tăng hay không.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/canh-bao-benh-ho-hap-giao-mua-o-tre-nhan-biet-som-rsv-cum-mua-va-dau-hieu-nguy-hiem?id=6c0af8f9-86ae-4ca7-acf8-f7598fc504b0).',1,'2026-10-01T17:00:00+00:00','2026-10-01T17:00:00+00:00','2026-10-15 12:00:00+07'),
(2,1,'Theo dõi ung thư gan: Vì sao cần phối hợp nhiều thông tin?','theo-doi-nguy-co-ung-thu-gan','Y học thường thức','/uploads/articles/026d6ca08a42390c533aa56c98eff5fd.jpg','*Theo dõi gan cần dựa trên nguy cơ của từng người và nhiều kết quả kiểm tra. Một chỉ số bình thường chưa đủ để kết luận gan hoàn toàn khỏe mạnh.*

## Kết quả thông thường vẫn có giới hạn

Siêu âm và xét nghiệm AFP là những phương pháp quen thuộc khi kiểm tra gan. Tuy nhiên, ở giai đoạn sớm, một số tổn thương có thể chưa được nhận diện bằng cách đánh giá đơn lẻ.

AFP bình thường cũng không đủ để khẳng định chắc chắn không có ung thư gan. Cách diễn giải phải đi cùng tình trạng người bệnh, tiền sử và những kết quả khác.

Điều này không có nghĩa các công cụ quen thuộc mất giá trị. Ý nghĩa của thông tin là hiểu giới hạn và tiếp tục theo dõi phù hợp, tránh coi một kết quả trước đây như bảo đảm cho mọi thời điểm sau đó.

## Các xét nghiệm bổ sung cung cấp thêm thông tin

Bệnh viện Bạch Mai đề cập PIVKA-II như một xét nghiệm có thể bổ sung thông tin cho đánh giá. GAAD là phương pháp kết hợp tuổi, giới tính cùng kết quả AFP và PIVKA-II để ước tính mức nguy cơ.

Đây là những dữ kiện hỗ trợ quyết định chuyên môn, không phải cách tự kết luận chẩn đoán từ một con số. Việc có sử dụng xét nghiệm nào và sử dụng khi nào phải gắn với tình trạng cụ thể.

Các công cụ bổ sung không thay thế hoàn toàn siêu âm hay chẩn đoán hình ảnh. Nếu có bất thường hoặc mức nguy cơ cần xem xét thêm, bác sĩ có thể lựa chọn CT, MRI hoặc những đánh giá phù hợp khác.

![Kỹ thuật viên hỗ trợ người bệnh trên bàn chụp cộng hưởng từ.](/uploads/articles/026d6ca08a42390c533aa56c98eff5fd.jpg "Kỹ thuật viên hỗ trợ người bệnh trên bàn chụp cộng hưởng từ.")

## Ai cần có kế hoạch theo dõi riêng

Những nhóm cần lưu ý gồm người viêm gan B hoặc C mạn tính, người xơ gan và một số người có bệnh gan nhiễm mỡ kèm yếu tố nguy cơ. Không phải mọi người có cùng nhu cầu xét nghiệm và khoảng cách giữa các lần kiểm tra.

Người có nguy cơ cao cần tuân thủ lịch đã được hướng dẫn. Thời điểm đánh giá lại có thể thay đổi theo tình trạng bệnh, các bất thường đã phát hiện và kế hoạch điều trị.

Theo dõi đều đặn không chỉ là thực hiện xét nghiệm, mà còn là mang kết quả đến bác sĩ để so sánh và quyết định các bước tiếp theo. Các kết quả từ nhiều lần khám có thể cung cấp bối cảnh quan trọng.

## Chuẩn bị thông tin cho lần tái khám

- Mang kết quả siêu âm, xét nghiệm và chẩn đoán hình ảnh trước đó.
- Thông báo bệnh gan đã được chẩn đoán và việc điều trị đang thực hiện.
- Ghi nhận những thay đổi sức khỏe từ lần khám gần nhất.
- Hỏi rõ lịch theo dõi và mục đích của từng xét nghiệm được đề xuất.
- Báo cho bác sĩ khi chưa thể thực hiện đúng kế hoạch để được hướng dẫn.

Bệnh gan có thể diễn tiến mà không có triệu chứng rõ. Người có bệnh mạn tính nên theo dõi theo kế hoạch, không chờ đến lúc xuất hiện vàng da, sụt cân hay đau mới tìm đến chăm sóc.

Mục tiêu là phối hợp thông tin để nhận diện nguy cơ và lựa chọn bước đánh giá phù hợp. Không nên suy diễn độ chính xác của một phương pháp thành bảo đảm tuyệt đối cho mỗi người bệnh.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/lam-sao-de-khong-bo-sot-ung-thu-gan-khi-benh-con-am-tham?id=4febab14-1abb-4e05-8e15-3fcdc168dbb6).',1,'2026-10-01T17:00:00+00:00','2026-10-01T17:00:00+00:00','2026-10-15 12:00:00+07'),
(3,1,'Men vi sinh trong bệnh tiêu hóa: Lợi ích cần được đánh giá theo từng chủng','su-dung-men-vi-sinh-theo-bang-chung','Y học thường thức','/uploads/articles/68178addee0c44c9a4121c22f11290dd.jpg','*Không phải sản phẩm men vi sinh nào cũng có tác dụng giống nhau. Lựa chọn phù hợp cần căn cứ vào chủng vi sinh, tình trạng bệnh và đặc điểm người sử dụng.*

## Hiệu quả không thể suy rộng từ một chủng sang mọi sản phẩm

Probiotics là các vi sinh vật sống được sử dụng trong những tình huống phù hợp. Hiệu quả của probiotics có tính đặc hiệu: bằng chứng về một chủng trong một bệnh cảnh không đồng nghĩa tất cả chế phẩm có tác dụng tương tự.

Người có đau bụng, tiêu chảy hoặc táo bón cần tìm nguyên nhân, thay vì mặc nhiên chọn men vi sinh. Dùng không phù hợp có thể làm tăng chi phí mà không đem lại lợi ích dự kiến.

Khi trao đổi về một sản phẩm, cần quan tâm thành phần cụ thể, dữ liệu khoa học và mục đích sử dụng. Giá cao hoặc số lượng chủng lớn không phải cách đủ tin cậy để so sánh hiệu quả.

![Bác sĩ dùng ống nghe thăm khám người bệnh tại giường.](/uploads/articles/68178addee0c44c9a4121c22f11290dd.jpg "Bác sĩ dùng ống nghe thăm khám người bệnh tại giường.")

## Trong điều trị H. pylori, vai trò là hỗ trợ

Phác đồ tiệt trừ *Helicobacter pylori* thường phối hợp nhiều thuốc. Bệnh viện Bạch Mai đề cập một số nghiên cứu về probiotics trong hỗ trợ giảm tác dụng không mong muốn hoặc cải thiện việc tuân thủ, nhưng đồng thời lưu ý bằng chứng và hiệu quả khác nhau giữa các chủng.

Men vi sinh không thể thay thế phác đồ điều trị H. pylori. Khi đã được kê thuốc, người bệnh không nên tự bỏ kháng sinh hoặc dùng probiotics như một phương án tiệt trừ độc lập.

Nếu bác sĩ chỉ định bổ sung, cách chọn chế phẩm, thời điểm dùng và khoảng thời gian cần được hướng dẫn cụ thể. Những thông tin này có ý nghĩa hơn việc lựa chọn theo lời quảng cáo chung.

## Hội chứng ruột kích thích cần đánh giá từng trường hợp

IBS là rối loạn tương tác não và ruột, có thể biểu hiện bằng đau bụng tái diễn cùng thay đổi việc đi ngoài. Các thể tiêu chảy, táo bón hay hỗn hợp không có cùng nhu cầu chăm sóc.

Các nghiên cứu về từng chủng vi sinh được thực hiện ở những nhóm người bệnh khác nhau. Kết quả ấy chưa cho phép lựa chọn một chế phẩm cho mọi trường hợp IBS. Những yếu tố tâm lý, căng thẳng và tình trạng dinh dưỡng cũng cần được cân nhắc trong kế hoạch điều trị.

Việc lựa chọn biện pháp hỗ trợ nên căn cứ vào triệu chứng và đánh giá chuyên môn, không chỉ vào nhãn sản phẩm. Khi triệu chứng kéo dài hoặc thay đổi, người bệnh cần được đánh giá lại nguyên nhân.

## Những nhóm cần hỏi ý kiến bác sĩ

Trẻ nhỏ, người suy giảm miễn dịch, người bệnh nặng hoặc đang hồi sức cần được xem xét riêng trước khi dùng probiotics. Dù một số biến cố ít gặp, việc sử dụng vi sinh vật sống vẫn đòi hỏi cân nhắc tình trạng toàn thân.

Những câu hỏi có thể đặt ra trong buổi tư vấn:

- Sản phẩm có cần thiết đối với bệnh đang được điều trị hay không.
- Chủng cụ thể nào có dữ liệu phù hợp.
- Lợi ích dự kiến và những điểm cần theo dõi.
- Thời gian sử dụng và khi nào cần đánh giá lại.
- Có những lựa chọn chăm sóc khác phù hợp hơn hay không.

Men vi sinh có thể hữu ích ở một số tình huống, nhưng không phải cách mặc định xử trí mọi rối loạn tiêu hóa.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/chuyen-gia-bach-mai-chi-cach-dung-men-vi-sinh-dung-benh-dung-nguoi?id=f18e2bb0-46cf-44aa-981b-0de94a01d565).',1,'2026-10-01T17:00:00+00:00','2026-10-01T17:00:00+00:00','2026-10-15 12:00:00+07'),
(4,1,'Giữ tay sạch để bảo vệ mắt: khi nào cần khám chuyên khoa?','bao-ve-mat-bang-ve-sinh-tay','Y học thường thức','/uploads/articles/36d4acc110bbe26e4c5e79f55c73c3e6.png','*Đưa tay chưa sạch lên mắt có thể tạo cơ hội cho tác nhân gây bệnh tiếp xúc với bề mặt nhãn cầu. Giữ tay sạch và khám sớm khi mắt đau, nhìn mờ là những việc cần nhớ.*

## Không bỏ qua thói quen khi tìm nguyên nhân

Bệnh viện Bạch Mai ghi nhận một người bệnh được chẩn đoán viêm loét giác mạc do nấm sau những đợt điều trị trước đó chưa cải thiện tình trạng. Khi khai thác thêm thông tin, nhóm chuyên môn ghi nhận công việc ở một cơ sở chế biến mắm thủ công và thói quen dụi mắt bằng tay.

Bàn tay thường xuyên tiếp xúc chất hữu cơ, bụi bẩn hoặc nhiều bề mặt có thể mang các vi sinh vật. Móng tay dài và phần bẩn còn lưu ở kẽ móng là những yếu tố cần chú ý trong vệ sinh cá nhân.

Những chi tiết sinh hoạt tưởng nhỏ lại có giá trị khi bác sĩ đánh giá nguồn tiếp xúc. Điều này cũng cho thấy đi khám cần trao đổi về công việc và thói quen hằng ngày, không chỉ mô tả triệu chứng hiện tại.

## Vì sao dụi mắt có thể làm tăng nguy cơ

Khi tay chưa sạch chạm vào vùng mắt, tác nhân gây bệnh có cơ hội tiếp xúc với bề mặt nhãn cầu. Động tác dụi mạnh hoặc móng tay dài cũng có thể tạo ra tổn thương trên những cấu trúc nhạy cảm.

Các tổn thương ở giác mạc cần được đánh giá chuyên khoa. Nhiễm trùng tại đây có thể ảnh hưởng đến thị lực và để lại hậu quả, nên việc điều trị không nên chỉ dựa vào kinh nghiệm từ một lần đau mắt trước đó.

Vi sinh vật còn có thể được đưa lên mắt khi lau mồ hôi, nhỏ thuốc hoặc xử lý kính áp tròng bằng tay chưa được vệ sinh. Những thao tác này cần được thực hiện với bàn tay sạch.

![Bác sĩ kiểm tra mắt bằng đèn khe tại phòng khám chuyên khoa.](/uploads/articles/36d4acc110bbe26e4c5e79f55c73c3e6.png "Bác sĩ kiểm tra mắt bằng đèn khe tại phòng khám chuyên khoa.")

## Những thay đổi ở mắt cần được thăm khám

Đau, đỏ mắt, cộm, chảy nước mắt, khó chịu với ánh sáng hoặc giảm khả năng nhìn là những thông tin cần cung cấp khi đi khám. Đặc biệt, thị lực thay đổi hoặc đau tăng là lý do không nên trì hoãn đánh giá.

Không nên tự kéo dài việc dùng thuốc nhỏ mắt khi chưa xác định nguyên nhân. Việc nhiều thuốc đã được thử nhưng tình trạng tiếp tục nặng lên cần được báo rõ cho bác sĩ, kèm tên thuốc và thời gian sử dụng nếu nhớ được.

Khám chuyên khoa giúp phân biệt các nguyên nhân và lựa chọn điều trị phù hợp. Một thói quen vệ sinh tốt có giá trị phòng ngừa, nhưng không thay thế việc xử trí một tổn thương đã xảy ra.

## Bắt đầu từ những việc hằng ngày

- Rửa tay với xà phòng và làm sạch kẽ ngón, đầu ngón, quanh móng.
- Giữ móng tay ngắn và sạch, nhất là sau công việc tiếp xúc đất, bụi hoặc chất hữu cơ.
- Tránh đưa tay chưa sạch lên mắt.
- Vệ sinh và lau khô tay trước khi nhỏ thuốc hay xử lý kính áp tròng.
- Đi khám khi có biểu hiện bất thường thay vì liên tục tự đổi thuốc.

Chú ý đến đường tiếp xúc giúp phòng ngừa, còn tìm đánh giá chuyên môn là điều cần thiết khi triệu chứng xuất hiện, đặc biệt lúc khả năng nhìn bị ảnh hưởng.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/dui-mat-bang-tay-ban-nguoi-phu-nu-63-tuoi-suyt-mat-thi-luc?id=aa3652dd-b552-448a-9d0a-2d7611ea6408).',1,'2026-10-04T17:00:00+00:00','2026-10-04T17:00:00+00:00','2026-10-15 12:00:00+07'),
(5,1,'Chăm sóc trẻ sơ sinh khi tắm: An toàn nằm trong từng thao tác','cham-soc-tre-so-sinh-khi-tam','Y học thường thức','/uploads/articles/34e01aafccfe561311107c41641858e8.jpg','*Chuẩn bị đủ đồ dùng, nâng đỡ đúng cách và luôn quan sát trẻ là những việc cần thiết khi tắm cho bé. Sự an toàn bắt đầu từ trước khi trẻ tiếp xúc với nước.*

## Chuẩn bị trước khi bắt đầu chăm sóc

Trong môi trường bệnh viện, bước nhận diện mẹ và con cần được thực hiện trước khi đưa trẻ đi tắm. Vòng định danh và những thông tin bàn giao giúp nhân viên y tế xác nhận đúng trẻ cần được chăm sóc.

Khăn, quần áo, tã và dụng cụ nên được chuẩn bị đầy đủ để quá trình chăm sóc diễn ra liên tục. Nhiệt độ nước cần được kiểm tra, còn phòng tắm phải bảo đảm điều kiện ấm và hạn chế gió lùa.

Ý nghĩa của việc chuẩn bị không chỉ là thuận tiện cho người thực hiện. Khi mọi dụng cụ đã ở vị trí cần thiết, nhân viên có thể tập trung theo dõi trẻ thay vì gián đoạn thao tác để tìm đồ dùng.

## Nâng đỡ và quan sát trong suốt quá trình tắm

Các bước chăm sóc cần có trình tự, từ vệ sinh tay, làm sạch mặt, tóc và cơ thể đến lau khô. Trong từng bước, đầu và cổ của trẻ cần được giữ chắc bằng thao tác phù hợp.

Không được để trẻ một mình trong lúc tắm. Người chăm sóc cần quan sát màu da, cách thở và phản ứng của trẻ, đồng thời duy trì những động tác nhẹ nhàng.

Trình tự và cách thực hiện nên được nhân viên y tế hướng dẫn trực tiếp. Với trẻ có tình trạng sức khỏe đặc biệt, việc chăm sóc phải theo đánh giá riêng, không nên dùng một quy trình chung để tự áp dụng cho mọi trường hợp.

![Nhân viên y tế nâng đỡ trẻ trong lúc tắm. Ảnh: Bệnh viện Bạch Mai.](/uploads/articles/34e01aafccfe561311107c41641858e8.jpg "Nhân viên y tế nâng đỡ trẻ trong lúc tắm. Ảnh: Bệnh viện Bạch Mai.")

## Sau tắm: Lau khô, giữ ấm và kiểm tra lại

Trẻ cần được lau khô, chú ý những vị trí nếp gấp, rồi mặc quần áo và tã sạch. Việc giữ ấm tiếp tục sau khi rời nước, cùng với theo dõi tình trạng của trẻ.

Tại bệnh viện, bàn giao trẻ về với mẹ là một bước cần kiểm tra lại thông tin định danh. Gia đình được hướng dẫn những điểm cần theo dõi sau chăm sóc và cách phối hợp với nhân viên y tế.

Quy trình an toàn vì vậy bao gồm cả thời điểm trước và sau tắm. Hoàn thành thao tác làm sạch chưa phải là kết thúc chăm sóc nếu chưa kiểm tra và bàn giao phù hợp.

## Hỗ trợ mẹ trong những ngày đầu nuôi con

Hướng dẫn cho bú cần chú ý tư thế và khớp ngậm phù hợp. Khi người mẹ gặp khó khăn, trao đổi với nhân viên y tế giúp tìm cách hỗ trợ đúng với tình trạng của mẹ và bé.

Những biểu hiện cần được báo ngay trong quá trình chăm sóc gồm:

- Da hoặc môi tím, khó thở hay cách thở bất thường.
- Trẻ lừ đừ, phản ứng khác thường hoặc có cơn co giật.
- Bỏ bú hay thay đổi rõ về khả năng bú.
- Thân nhiệt có biểu hiện bất thường.

Sự phối hợp giữa gia đình và nhân viên chăm sóc giúp các thay đổi được nhận diện sớm hơn. Đối với trẻ sơ sinh, những thao tác nhỏ cần được thực hiện trong một kế hoạch chăm sóc nhất quán, an toàn và có theo dõi.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/tam-be-mot-khoanh-khac-nho-mot-su-cham-soc-lon?id=da2e8874-21ac-408d-b842-137cc72a4ba8).',1,'2026-10-06T17:00:00+00:00','2026-10-06T17:00:00+00:00','2026-10-15 12:00:00+07'),
(6,1,'Tăng huyết áp khó kiểm soát: Khi nào cần đánh giá tuyến thượng thận?','tang-huyet-ap-va-cuong-aldosterone','Y học thường thức','/uploads/articles/621b4c4b6584b9fb80a535cc5dbfc6bf.jpg','*Huyết áp tăng kéo dài dù đang điều trị cần được đánh giá lại có hệ thống. Trong một số trường hợp, bác sĩ phải tìm nguyên nhân nội tiết, bao gồm cường aldosterone tiên phát.*

## Vai trò của hormone aldosterone

Tuyến thượng thận nằm phía trên mỗi thận và sản xuất nhiều hormone. Aldosterone tham gia điều hòa cân bằng muối, nước và kali, qua đó có vai trò đối với huyết áp.

Khi lượng aldosterone được tiết ra quá mức, thận có thể giữ muối và nước nhiều hơn, trong khi kali bị thải ra tăng. Bệnh cảnh vì vậy có thể bao gồm cả tăng huyết áp và hạ kali máu.

Nguyên nhân có thể là một khối u lành ở một bên tuyến hoặc tình trạng tăng sản ở hai bên. Việc xác định đúng nguồn gốc giúp lựa chọn hướng xử trí, chứ không chỉ nhằm điều chỉnh một chỉ số huyết áp.

![Bác sĩ đo huyết áp cho người bệnh trong buổi khám và tư vấn.](/uploads/articles/621b4c4b6584b9fb80a535cc5dbfc6bf.jpg "Bác sĩ đo huyết áp cho người bệnh trong buổi khám và tư vấn.")

## Những thông tin gợi ý cần kiểm tra thêm

Theo tư vấn của TS.BS Nguyễn Quang Bảy tại Bệnh viện Bạch Mai, cần lưu ý các trường hợp huyết áp vẫn cao khi phải phối hợp nhiều thuốc. Những biểu hiện như yếu cơ, chuột rút hay hạ kali chưa rõ nguyên nhân cũng cần được xem xét.

Phát hiện khối u tuyến thượng thận trên hình ảnh học là một thông tin khác cần cung cấp cho bác sĩ. Ngoài ra, tuổi khởi phát tăng huyết áp, tiền sử gia đình và các bất thường tim mạch có thể ảnh hưởng đến kế hoạch đánh giá.

Các dấu hiệu này không đủ để tự kết luận mắc cường aldosterone. Không phải mọi trường hợp tăng huyết áp đều bắt nguồn từ tuyến thượng thận; cần có các xét nghiệm và thăm dò theo chỉ định chuyên khoa.

## Điều trị phụ thuộc vị trí và đặc điểm tổn thương

Nếu nguồn tăng tiết được xác định ở một bên tuyến, một số người bệnh có thể được cân nhắc phẫu thuật. Kết quả điều trị khác nhau giữa các trường hợp, nên không thể cam kết tất cả đều ngừng được thuốc hạ huyết áp sau can thiệp.

Khi tổn thương liên quan cả hai bên hoặc người bệnh không có chỉ định phẫu thuật, bác sĩ có thể lựa chọn thuốc đối kháng thụ thể mineralocorticoid. Mục tiêu là hạn chế tác động của aldosterone và kiểm soát những rối loạn đi kèm.

Hướng điều trị cần căn cứ vào chẩn đoán, tình trạng toàn thân và đánh giá của bác sĩ. Người bệnh không nên tự tăng liều, đổi thuốc hay ngừng điều trị chỉ vì nghi ngờ một nguyên nhân nội tiết.

## Chuẩn bị thông tin khi đi khám

- Mang danh sách thuốc hạ huyết áp đang dùng và cách sử dụng thực tế.
- Ghi nhận các kết quả đo huyết áp đã có.
- Thông báo những đợt chuột rút, yếu cơ hoặc kết quả kali bất thường.
- Mang kết quả siêu âm, CT và các xét nghiệm trước đó nếu có.
- Cung cấp tiền sử bản thân và gia đình liên quan đến bệnh tim mạch.

Bệnh viện Bạch Mai nhấn mạnh rằng việc kiểm soát huyết áp đôi khi cần đi cùng tìm kiếm nguyên nhân phía sau. Đánh giá đúng có thể mở ra hướng điều trị phù hợp hơn cho từng người, đồng thời tránh việc chỉ liên tục bổ sung thuốc mà thiếu một kế hoạch xem xét toàn diện.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/tang-huyet-ap-kho-kiem-soat-coi-chung-benh-tu-tuyen-thuong-than?id=acd55e47-7dd9-4205-bed0-c1cc3de7be11).',1,'2026-10-08T17:00:00+00:00','2026-10-08T17:00:00+00:00','2026-10-15 12:00:00+07'),
(7,1,'An toàn thực phẩm: Kiểm soát nguy cơ từ nguyên liệu đến bữa ăn','nguyen-tac-an-toan-thuc-pham-phong-ngo-doc','Y học thường thức','/uploads/articles/4920ea87d172e204dde3b077a5a23bee.png','*Một bữa ăn an toàn là kết quả của nhiều bước: chọn nguyên liệu, vệ sinh tay và dụng cụ, nấu chín rồi bảo quản đúng cách. Bỏ qua một bước có thể làm tăng nguy cơ ngộ độc.*

## Nguy cơ có thể xuất hiện ở nhiều công đoạn

Một món ăn có thể bị nhiễm bẩn khi vận chuyển, sơ chế, chế biến hoặc bảo quản. Tác nhân gây hại không chỉ đến từ nguyên liệu mà còn có thể truyền qua bàn tay, dao thớt, khăn lau và các bề mặt trong bếp.

Nhiễm khuẩn chéo xảy ra khi nguồn bẩn từ thực phẩm sống tiếp xúc với món đã chín hoặc thực phẩm được ăn ngay. Để hạn chế nguy cơ, cần tổ chức luồng làm việc và dụng cụ phù hợp, thay vì chỉ chú ý đến bước nấu.

Nguyên liệu nên có nguồn gốc rõ ràng, hạn sử dụng còn phù hợp và bao bì nguyên vẹn. Đối với bếp ăn tập thể, việc kiểm tra điều kiện giao nhận và bảo quản là một phần quan trọng của quy trình.

## Vệ sinh tay và phân tách dụng cụ

Người tham gia chế biến cần giữ tay, móng tay và trang phục sạch. Rửa tay với xà phòng là bước cần thực hiện trước khi làm thức ăn, sau khi đi vệ sinh, xử lý nguyên liệu sống hoặc tiếp xúc với rác và bề mặt bẩn.

Thớt, dao, khay và hộp dùng cho thực phẩm sống cần được tách khỏi nhóm dùng cho món chín. Nếu dùng lại dụng cụ, phải làm sạch và xử lý phù hợp trước khi tiếp xúc với thực phẩm ăn ngay.

Khu vực bồn rửa, bàn chế biến và các vật dụng cần được vệ sinh thường xuyên. Khăn lau và miếng bọt biển cũng cần được làm sạch, làm khô và thay khi không còn phù hợp, vì chúng có thể trở thành nguồn truyền vi sinh vật.

![Rửa tay trước khi chế biến là một bước bảo đảm vệ sinh thực phẩm. Đồ họa: Bệnh viện Bạch Mai.](/uploads/articles/4920ea87d172e204dde3b077a5a23bee.png "Rửa tay trước khi chế biến là một bước bảo đảm vệ sinh thực phẩm. Đồ họa: Bệnh viện Bạch Mai.")

## Bảo quản phải gắn với thời gian và nhiệt độ

Nấu chín kỹ cần đi cùng phục vụ kịp thời và bảo quản đúng yêu cầu từng món. Với thức ăn nóng, cơ sở cần duy trì điều kiện giữ nóng phù hợp; với món lạnh, cần hạn chế thời gian ở nhiệt độ phòng.

Một số việc cần chú ý trong tổ chức bữa ăn:

- Kiểm soát đồng thời thời gian và nhiệt độ khi bày món.
- Dùng dụng cụ sạch, có nắp khi bảo quản phần thức ăn còn lại.
- Không trộn thức ăn mới vào một khay cũ nếu chưa bảo đảm vệ sinh.
- Không sử dụng nguyên liệu có dấu hiệu biến đổi bất thường.
- Ghi chép các thông tin cần thiết tại bếp ăn tập thể.

Mùi vị bình thường không bảo đảm một thực phẩm không mang tác nhân gây bệnh. Vì vậy, đánh giá an toàn cần dựa cả vào nguồn gốc, thao tác chế biến và điều kiện bảo quản.

## Khi nghi ngờ xảy ra ngộ độc

Nôn nhiều, tiêu chảy kéo dài, đau bụng dữ dội hoặc những biểu hiện toàn thân bất thường là lý do cần đưa người bệnh đi khám. Cơ sở phục vụ bữa ăn cần đồng thời báo cho người phụ trách và phối hợp với cơ quan y tế.

Món ăn hoặc lô nguyên liệu nghi ngờ cần được ngừng phục vụ và bảo quản riêng để hỗ trợ xác minh. Mẫu lưu, thức ăn còn lại và thông tin giao nhận, chế biến đều có thể hữu ích khi truy tìm nguyên nhân.

Việc phòng ngừa hiệu quả không nằm ở một thao tác riêng lẻ. Một quy trình được duy trì đều đặn, có người chịu trách nhiệm và có thông tin truy xuất sẽ giúp cơ sở phản ứng phù hợp khi có sự cố.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/kiem-soat-an-toan-thuc-pham-nhung-nguyen-tac-can-nho-de-phong-ngua-ngo-doc?id=e74eabd5-2bfa-4acf-bbf3-724341aa8820).',1,'2026-10-11T17:00:00+00:00','2026-10-11T17:00:00+00:00','2026-10-15 12:00:00+07'),
(8,1,'Rối loạn ăn uống ở người trẻ: Cần quan tâm cả sức khỏe thể chất và tinh thần','roi-loan-an-uong-va-ha-kali-mau','Y học thường thức','/uploads/articles/b6f491239f14078bc972158ca5f8eb1d.jpg','*Ăn uống mất kiểm soát, tự gây nôn hay liên tục lo sợ tăng cân có thể là dấu hiệu cần được hỗ trợ chuyên môn. Việc chăm sóc phải quan tâm đồng thời đến cơ thể và sức khỏe tinh thần.*

## Một vòng lặp khó thoát ra nếu thiếu hỗ trợ

Trong trường hợp được Bệnh viện Bạch Mai công bố, một nữ sinh 21 tuổi đã trải qua những đợt ăn mất kiểm soát rồi tự gây nôn trong khoảng một năm. Áp lực học tập, những lời bình luận về ngoại hình và căng thẳng gia đình là những yếu tố được ghi nhận khi khai thác tình trạng của người bệnh.

Khi đến khám, người bệnh có BMI 17,6, mất kinh trong ba tháng và kết quả kali máu 2,9 mmol/L. Đây là những dữ kiện của một ca lâm sàng cụ thể, không phải các ngưỡng để người đọc tự chẩn đoán rối loạn ăn uống tại nhà.

Người bệnh được điều trị phối hợp nhiều phương pháp theo đánh giá của nhóm chuyên môn. Sự cải thiện từng bước cho thấy việc hồi phục cần một kế hoạch chăm sóc phù hợp chứ không chỉ là yêu cầu thay đổi thói quen ăn uống.

## Cân nặng không phản ánh đầy đủ tình trạng bệnh

Ăn vô độ tâm thần, hay *Bulimia nervosa*, có thể liên quan đến các đợt ăn mất kiểm soát và hành vi bù trừ sau ăn. Những suy nghĩ về hình thể, cảm giác tội lỗi và sợ tăng cân có thể khiến người bệnh bị cuốn vào vòng lặp kéo dài.

Không phải mọi người mắc tình trạng này đều gầy. Bệnh viện Bạch Mai nhấn mạnh rằng người bệnh có thể có cân nặng trong khoảng thông thường hoặc thừa cân, nên việc quan sát vóc dáng đơn thuần dễ bỏ sót vấn đề.

Những biến đổi về hành vi cần được đặt trong bối cảnh: ăn uống kín đáo bất thường, lo lắng nhiều về cân nặng, thường xuyên rời bữa ăn để vào nhà vệ sinh hoặc tập luyện quá mức. Khi các biểu hiện lặp lại, gia đình nên khuyến khích đánh giá chuyên khoa.

![Bác sĩ và điều dưỡng trao đổi với người bệnh tại giường.](/uploads/articles/b6f491239f14078bc972158ca5f8eb1d.jpg "Bác sĩ và điều dưỡng trao đổi với người bệnh tại giường.")

## Vì sao việc thăm khám cần bao quát nhiều mặt

Rối loạn ăn uống có thể đi kèm mất nước, thay đổi điện giải và những vấn đề tiêu hóa, răng miệng hoặc kinh nguyệt. Các vấn đề tâm lý cũng có thể cùng tồn tại. Vì vậy, kế hoạch chăm sóc cần xem xét cả tình trạng cơ thể và sức khỏe tinh thần.

Bác sĩ có thể phối hợp điều trị chuyên khoa tâm thần, liệu pháp tâm lý và tư vấn dinh dưỡng. Phương pháp cụ thể được lựa chọn theo từng người bệnh; không nên lấy một ca điều trị làm công thức áp dụng cho tất cả.

Các biểu hiện nặng như ngất, khó thở, đau ngực, co giật, lú lẫn hoặc yếu cơ rõ rệt cần được đưa đến cơ sở y tế để đánh giá kịp thời. Đây là những tình huống cần hỗ trợ trực tiếp, không nên chờ một lịch tư vấn thông thường.

## Đồng hành bằng cách lắng nghe

- Tránh bình luận gây áp lực về cân nặng hay ngoại hình.
- Lắng nghe trải nghiệm của người bệnh và những khó khăn trong sinh hoạt.
- Khuyến khích tìm đến chuyên gia tâm thần, tâm lý và dinh dưỡng.
- Đồng hành với kế hoạch theo dõi, không yêu cầu người bệnh phải tự giải quyết bằng ý chí.
- Quan tâm các thay đổi về sức khỏe và báo cho nhóm điều trị khi cần.

Sự hỗ trợ của gia đình có thể giúp việc tìm kiếm chăm sóc bớt khó khăn. Rối loạn ăn uống cần được nhận diện và điều trị trong môi trường tôn trọng, tránh phán xét.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/nu-sinh-21-tuoi-ha-kali-mau-vi-am-anh-can-nang-lien-tuc-an-roi-tu-gay-non?id=8383a596-959a-49e8-b635-bddf07c63483).',1,'2026-10-12T17:00:00+00:00','2026-10-12T17:00:00+00:00','2026-10-15 12:00:00+07'),
(9,1,'Thuốc tránh thai nội tiết và huyết khối: Những dấu hiệu không nên bỏ qua','nguy-co-huyet-khoi-khi-dung-thuoc-tranh-thai','Y học thường thức','/uploads/articles/621b4c4b6584b9fb80a535cc5dbfc6bf.jpg','*Trước khi dùng thuốc tránh thai nội tiết, người sử dụng cần được tư vấn về tiền sử bệnh và các yếu tố nguy cơ. Sưng đau một chân hoặc khó thở đột ngột là những biểu hiện cần chú ý.*

## Từ sưng đau ở chân đến tình trạng cấp cứu

Trong ca bệnh do Bệnh viện Bạch Mai công bố, người bệnh đã tự sử dụng thuốc tránh thai trong khoảng 10 tháng. Trước khi nhập viện, chân phải xuất hiện sưng đau; việc đi lại gây khó chịu. Người bệnh xử trí tại nhà bằng xoa dầu và mát-xa, sau đó mới đến cấp cứu khi có khó thở, đau ngực và nhịp tim nhanh.

Qua thăm khám, bác sĩ xác định huyết khối tĩnh mạch sâu ở chi dưới kèm thuyên tắc phổi. Người bệnh làm công việc văn phòng, ít vận động và có BMI 26. Tình trạng dần ổn định sau những ngày đầu điều trị tại bệnh viện.

Việc đánh giá cần xem xét nhiều yếu tố nguy cơ cùng lúc. Không thể từ một trường hợp riêng lẻ suy ra rằng mọi người sử dụng thuốc tránh thai đều sẽ gặp biến chứng.

## Vì sao cần được tư vấn trước khi lựa chọn thuốc

Một số thuốc tránh thai phối hợp chứa estrogen và progestin có liên quan đến tăng nguy cơ huyết khối. Với phần lớn phụ nữ khỏe mạnh, nguy cơ nhìn chung vẫn thấp, nhưng cách lựa chọn thuốc cần cân nhắc các yếu tố đi kèm.

Những thông tin nên cung cấp trong buổi tư vấn gồm tiền sử bản thân hoặc gia đình từng có huyết khối, việc hút thuốc, các bệnh tim mạch, đau nửa đầu có tiền triệu và tình trạng sau sinh. Bác sĩ cũng cần biết người bệnh có sắp phẫu thuật hoặc phải nằm bất động lâu hay không.

Thừa cân và ngồi lâu là những yếu tố cần được xem xét trong bối cảnh sức khỏe tổng thể. Không nên chọn sản phẩm chỉ dựa trên quảng cáo, lời giới thiệu của người quen hoặc đơn thuốc của một người khác.

![Đo huyết áp trong buổi khám giúp bổ sung thông tin đánh giá sức khỏe trước khi lựa chọn thuốc.](/uploads/articles/621b4c4b6584b9fb80a535cc5dbfc6bf.jpg "Đo huyết áp trong buổi khám giúp bổ sung thông tin đánh giá sức khỏe trước khi lựa chọn thuốc.")

## Dấu hiệu ở chân và dấu hiệu ở phổi khác nhau

Huyết khối ở tĩnh mạch sâu có thể gây sưng một bên chân, đau, căng tức, nóng hoặc thay đổi màu da. Khi cục máu đông di chuyển đến phổi, biểu hiện có thể chuyển thành khó thở đột ngột, đau ngực, tim đập nhanh hoặc choáng.

Các dấu hiệu đột ngột như khó thở và đau ngực cần được đánh giá cấp cứu. Người có chân sưng đau nghi do huyết khối cũng cần đi khám; cần tránh xoa bóp, mát-xa hoặc chườm nóng tại vùng đó.

Nhận biết sớm không thay thế cho chẩn đoán. Điều quan trọng là cung cấp đầy đủ thời điểm xuất hiện triệu chứng và những thuốc đang dùng để nhân viên y tế đánh giá.

## Những việc cần trao đổi để sử dụng thuốc phù hợp

- Báo tiền sử huyết khối của bản thân và gia đình khi được tư vấn.
- Thông tin rõ về hút thuốc, bệnh nền và những thuốc đang sử dụng.
- Hỏi phương án tránh thai phù hợp với tình trạng sức khỏe hiện tại.
- Cho bác sĩ biết thuốc tránh thai đang dùng trước phẫu thuật hoặc khi cần bất động dài ngày.
- Trao đổi khi lo ngại tác dụng phụ, thay vì tự đổi hoặc dùng chung thuốc.

Trong sinh hoạt, người phải ngồi lâu có thể chủ động vận động chân và dành những khoảng nghỉ phù hợp. Khi đi khám vì bất cứ vấn đề nào, danh sách thuốc là thông tin hữu ích để bác sĩ nhận diện những nguy cơ liên quan.

Lựa chọn biện pháp tránh thai cần có tư vấn, đồng thời chú ý những thay đổi bất thường của cơ thể. Hiệu quả và sự an toàn cần được xem xét cùng nhau ở từng người.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/bac-si-canh-bao-nguy-co-huyet-khoi-o-phu-nu-thua-can-it-van-dong-dung-thuoc-tranh-thai?id=391dd160-dc48-48d6-8d32-56958155f80c).',1,'2026-10-12T17:00:00+00:00','2026-10-12T17:00:00+00:00','2026-10-15 12:00:00+07'),
(10,1,'Nội soi đại tràng khi khám sức khỏe, phát hiện sán dây bò dài 70cm','noi-soi-dai-trang-phat-hien-san-day-bo','Y học thường thức','/uploads/articles/ac5930b03caffc393a2e7b0a43226e4a.jpg','*Bệnh viện Bạch Mai thông tin về một trường hợp phát hiện sán dây bò qua nội soi khi khám sức khỏe. Ca bệnh cho thấy nhiễm ký sinh trùng có thể hiện diện dù triệu chứng tiêu hóa không rõ ràng.*

## Phát hiện trong một lần kiểm tra sức khỏe

Người bệnh H.T.H., sống tại Lai Châu, đến Bệnh viện Bạch Mai để khám tổng quát. Điểm đáng chú ý của trường hợp này là trước đó người bệnh không nhận thấy những rối loạn tiêu hóa rõ rệt, nên không chủ động tìm đến cơ sở chuyên khoa vì nghi ngờ nhiễm sán.

Ngày 30/9/2026, trong lúc thực hiện nội soi đại trực tràng có gây mê, ThS.BSNT Vũ Thị Ngọc Bích cùng ê-kíp của Viện Tiêu hóa phát hiện một cấu trúc trắng, dẹt ở đoạn cuối hồi tràng. Dải ký sinh trùng kéo dài sang đại tràng ngang. Bác sĩ dùng dụng cụ nội soi lấy ra một phần thân sán với chiều dài khoảng 70 cm.

Bệnh phẩm được chuyển đến đơn vị vi sinh của Viện Xét nghiệm Y học để kiểm tra. Kết quả phù hợp với *Taenia saginata*, tên khoa học của sán dây bò. Sau thủ thuật, người bệnh tiếp tục được đánh giá tại phòng khám bệnh nhiệt đới và viêm gan để lập kế hoạch điều trị bằng thuốc.

![Bác sĩ Vũ Thị Ngọc Bích thực hiện nội soi phát hiện sán dây bò. Ảnh: Bệnh viện Bạch Mai.](/uploads/articles/ac5930b03caffc393a2e7b0a43226e4a.jpg "Bác sĩ Vũ Thị Ngọc Bích thực hiện nội soi phát hiện sán dây bò. Ảnh: Bệnh viện Bạch Mai.")

## Lấy được thân sán chưa có nghĩa đã điều trị khỏi

Theo bác sĩ điều trị, người nhiễm sán dây bò có thể có rất ít biểu hiện, thậm chí không nhận ra điều gì khác thường. Việc nội soi lấy được bệnh phẩm tạo điều kiện cho xét nghiệm định danh, nhưng không thể dùng riêng kết quả đó để kết luận ký sinh trùng đã được loại bỏ hoàn toàn.

Phần được lấy ra trong ca bệnh chỉ là một đoạn thân. Nếu đầu sán còn bám vào ruột non, ký sinh trùng có thể tiếp tục phát triển. Vì vậy, người bệnh vẫn cần được bác sĩ đánh giá và chỉ định điều trị đặc hiệu; việc theo dõi sau thủ thuật là một phần của quá trình xử trí.

![Đoạn thân sán dây bò được lấy ra qua nội soi trong ca bệnh. Ảnh: Bệnh viện Bạch Mai.](/uploads/articles/02a1af2735e037b89f766f877e40795d.jpg "Đoạn thân sán dây bò được lấy ra qua nội soi trong ca bệnh. Ảnh: Bệnh viện Bạch Mai.")

## Đường lây và những dấu hiệu cần chú ý

Con người có thể nhiễm sán dây bò khi ăn thịt bò sống hoặc chưa được nấu chín kỹ có chứa ấu trùng. Sau khi vào cơ thể, ấu trùng phát triển thành sán trưởng thành trong ruột non. Các món bò tái hoặc gỏi bò có thể mang nguy cơ nếu nguyên liệu bị nhiễm.

Cần phân biệt sán dây bò với sán dây lợn, *Taenia solium*. Đây là hai loài khác nhau về đường lây và những vấn đề sức khỏe liên quan. Việc nhận diện loài và đánh giá bệnh phẩm cần được thực hiện tại cơ sở chuyên môn, tránh tự suy đoán chỉ từ hình dạng quan sát được.

Những biểu hiện có thể gặp bao gồm:

- Khó chịu hoặc đau bụng, đầy hơi, buồn nôn hay tiêu chảy.
- Chán ăn hoặc giảm cân mà chưa xác định được nguyên nhân.
- Nhìn thấy các đốt màu trắng trong phân hoặc quanh vùng hậu môn.

Một số người không có đủ các biểu hiện trên. Ngược lại, các triệu chứng tiêu hóa cũng có thể xuất phát từ nhiều nguyên nhân khác, nên người bệnh cần được thăm khám để xác định chẩn đoán.

## Chẩn đoán, điều trị và phòng ngừa

Xét nghiệm phân để tìm trứng hoặc đốt sán là một hướng đánh giá thường được sử dụng. Trong những tình huống cần thiết, mẫu đốt sán có thể giúp xác định loài. Lựa chọn xét nghiệm và diễn giải kết quả thuộc về bác sĩ chuyên khoa.

Bệnh viện Bạch Mai đề cập praziquantel trong điều trị sán dây bò. Người bệnh cần dùng thuốc theo chỉ định và tái khám khi được yêu cầu, thay vì tự mua thuốc hoặc coi việc lấy được thân sán qua nội soi là đủ để kết thúc theo dõi.

Các thực hành giúp hạn chế nguy cơ gồm nấu chín thịt bò, chọn nguyên liệu có nguồn gốc được kiểm soát, tách dụng cụ chế biến thực phẩm sống và chín, vệ sinh tay và giữ môi trường chăn nuôi, sinh hoạt sạch sẽ.

Ca bệnh nhấn mạnh vai trò của đánh giá chuyên môn: có bệnh ký sinh trùng tồn tại âm thầm, trong khi xét nghiệm và điều trị phù hợp vẫn cần thiết ngay cả sau khi đã lấy được một phần ký sinh trùng.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/noi-soi-dai-trang-khi-kham-suc-khoe-phat-hien-san-day-bo-dai-70cm?id=e5652f8d-2b4f-4ae9-8ba2-5f742d87ce0d).',1,'2026-10-12T17:00:00+00:00','2026-10-12T17:00:00+00:00','2026-10-15 12:00:00+07');

-- 18. SYSTEM_CONFIGURATION
INSERT INTO system_configuration
(config_key, config_value, description, updated_at)
VALUES
('APPOINTMENT_HOLD_MINUTES', '10', 'Số phút giữ lịch chờ thanh toán', '2026-10-01 08:00:00+07'),
('DEFAULT_DEPOSIT_PERCENT', '100', 'Đặt mới cọc 100% giá bác sĩ; các snapshot 30% cũ giữ nguyên', '2026-10-09 00:00:00+07'),
('NO_SHOW_FORFEIT_DEPOSIT', 'true', 'No-show sẽ mất khoản đặt cọc', '2026-10-01 08:00:00+07'),
('CHECKIN_EARLY_MINUTES', '30', 'Online bắt buộc check-in ít nhất 30 phút trước giờ hẹn', '2026-10-09 00:00:00+07'),
('CHECKIN_LATE_MINUTES', '0', 'Không cho check-in sau hạn 30 phút trước giờ hẹn', '2026-10-09 00:00:00+07'),
('NO_SHOW_GRACE_MINUTES', '15', 'No-show sau kết thúc ca 15 phút; chính sách cố định', '2026-10-09 00:00:00+07'),
('CANCEL_HOURS_LIMIT', '12', 'Bệnh nhân hủy từ 12 giờ trước giờ hẹn được hoàn 50% cọc', '2026-10-09 00:00:00+07'),
('CANCEL_REFUND_PERCENT', '50', 'Hoàn 50% cọc khi hủy đủ hạn; lỗi bệnh viện hoàn 100%', '2026-10-09 00:00:00+07'),
('REMINDER_BEFORE_HOURS', '24', 'Gửi thông báo nhắc lịch trước giờ khám', '2026-10-01 08:00:00+07'),
('MAX_REVIEW_RATING', '5', 'Điểm đánh giá tối đa', '2026-10-01 08:00:00+07'),
('HOSPITAL_NAME', 'Bệnh viện NEU Medical', 'Tên cơ sở khám bệnh hiển thị trên hệ thống', '2026-10-01 08:00:00+07'),
('SUPPORT_PHONE', '19001234', 'Số điện thoại hỗ trợ khách hàng', '2026-10-01 08:00:00+07'),
('SUPPORT_EMAIL', 'neumedical@gmail.com', 'Email liên hệ của bệnh viện', '2026-10-01 08:00:00+07'),
('EXAM_HOURS', E'Sáng: 07:00–12:00\nChiều: 13:30–16:30', 'Giờ khám tham khảo cho đồ án từ thông báo MEDLATEC ngày 16/03/2026', '2026-10-14 08:00:00+07'),
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

-- Ảnh và hồ sơ mẫu bổ sung 14/10/2026: 14 bác sĩ, 13 điều dưỡng, 39 bài viết.
-- Tên/học vị/công tác là dữ liệu đồ án, không xác nhận danh tính người trong ảnh.
INSERT INTO users(user_id,role_id,full_name,email,password_hash,approval_status,account_status,email_verified)
SELECT 24,2,'BS. Nguyễn Đức Hải','demo.doctor.11@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 25,2,'BS. Phan Minh Quang','demo.doctor.12@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 26,2,'BS. Trần Tuấn Kiệt','demo.doctor.13@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 27,2,'BS. Lê Hoàng Nam','demo.doctor.14@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 28,4,'Nguyễn Thu Hà','demo.nurse.2@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 29,4,'Trần Phương Linh','demo.nurse.3@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 30,4,'Phạm Ngọc Mai','demo.nurse.4@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 31,4,'Đỗ Thanh Hương','demo.nurse.5@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 32,4,'Bùi Khánh Ngọc','demo.nurse.6@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 33,4,'Hoàng Minh Châu','demo.nurse.7@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 34,4,'Vũ Thảo Vy','demo.nurse.8@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 35,4,'Lê Bảo An','demo.nurse.9@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 36,4,'Nguyễn Quỳnh Hoa','demo.nurse.10@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 37,4,'Trần Hà My','demo.nurse.11@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 38,4,'Phan Ngọc Lan','demo.nurse.12@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3
UNION ALL
SELECT 39,4,'Đặng Thu Thảo','demo.nurse.13@example.invalid',password_hash,'APPROVED','ACTIVE',0 FROM users WHERE user_id=3;

INSERT INTO doctor_profile(doctor_profile_id,user_id,department_id,academic_degree,specialization,experience_years,introduction,consultation_fee,avatar_url) VALUES
(11,24,1,'Thạc sĩ','Nội khoa',12,'Bác sĩ chuyên ngành Nội khoa.

Quá trình đào tạo:
- 2018: Thạc sĩ chuyên ngành Nội khoa, Đại học Y Hà Nội.
- 2014: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Nội khoa tại Bệnh viện NEU Medical.
- 2014–2020: Khám và theo dõi người bệnh trong lĩnh vực Nội khoa.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.',290000,'/uploads/avatars/54f8618f24bc9d43fd5da9e54f0fab6c.jpg'),
(12,25,2,'Tiến sĩ','Tim mạch',18,'Bác sĩ chuyên ngành Tim mạch.

Quá trình đào tạo:
- 2016: Tiến sĩ Y học chuyên ngành Tim mạch, Đại học Y Hà Nội.
- 2012: Thạc sĩ chuyên ngành Tim mạch, Đại học Y Hà Nội.
- 2008: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Tim mạch tại Bệnh viện NEU Medical.
- 2008–2020: Khám và theo dõi người bệnh trong lĩnh vực Tim mạch.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.',390000,'/uploads/avatars/99c539578baed65fc917a2377998af6f.jpg'),
(13,26,6,'Thạc sĩ','Tai Mũi Họng',10,'Bác sĩ chuyên ngành Tai Mũi Họng.

Quá trình đào tạo:
- 2020: Thạc sĩ chuyên ngành Tai Mũi Họng, Đại học Y Hà Nội.
- 2016: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Tai Mũi Họng tại Bệnh viện NEU Medical.
- 2016–2020: Khám và theo dõi người bệnh trong lĩnh vực Tai Mũi Họng.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.',300000,'/uploads/avatars/cc4daae70cd39341824a6a948c0bb8a5.jpg'),
(14,27,9,'Chuyên khoa II','Cơ Xương Khớp',15,'Bác sĩ chuyên ngành Cơ Xương Khớp.

Quá trình đào tạo:
- 2019: Bác sĩ chuyên khoa II chuyên ngành Cơ Xương Khớp, Đại học Y Hà Nội.
- 2015: Thạc sĩ chuyên ngành Cơ Xương Khớp, Đại học Y Hà Nội.
- 2011: Tốt nghiệp Bác sĩ đa khoa, Đại học Y Hà Nội.

Quá trình công tác:
- 2020–nay: Bác sĩ chuyên ngành Cơ Xương Khớp tại Bệnh viện NEU Medical.
- 2011–2020: Khám và theo dõi người bệnh trong lĩnh vực Cơ Xương Khớp.

Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.',380000,'/uploads/avatars/fa20ce283eb787dc827de89ad681deac.jpg');

INSERT INTO room(room_id,department_id,room_name,description) VALUES
(11,1,'Phòng Nội 103','Phòng mẫu bổ sung cho đồ án'),
(12,2,'Phòng Tim mạch 206','Phòng mẫu bổ sung cho đồ án'),
(13,6,'Phòng TMH 207','Phòng mẫu bổ sung cho đồ án'),
(14,9,'Phòng CXK 304','Phòng mẫu bổ sung cho đồ án');

-- Ca mẫu của bốn bác sĩ mới; dùng phòng riêng để không chồng ca cũ.
WITH days AS (
 SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Saigon')::date + day_offset AS work_date
 FROM generate_series(0,30) AS day_offset
), shifts(start_time,end_time) AS (VALUES ('08:00'::time,'11:30'::time),('13:30'::time,'17:00'::time)),
base AS (SELECT MAX(schedule_id) AS id FROM work_schedule)
INSERT INTO work_schedule(schedule_id,doctor_profile_id,room_id,work_date,start_time,end_time,max_quota,slot_minutes)
SELECT base.id + ROW_NUMBER() OVER(ORDER BY day.work_date,d.doctor_profile_id,s.start_time),
 d.doctor_profile_id,d.doctor_profile_id,day.work_date,s.start_time,s.end_time,7,30
FROM doctor_profile d CROSS JOIN days day CROSS JOIN shifts s CROSS JOIN base WHERE d.doctor_profile_id BETWEEN 11 AND 14;

INSERT INTO article
(article_id,author_id,title,slug,category,thumbnail_url,content,is_active,published_at,created_at,updated_at) VALUES
(11,1,'Chuẩn bị thông tin để buổi khám thuận tiện hơn','chuan-bi-thong-tin-de-buoi-kham-thuan-tien-hon','Hướng dẫn khám bệnh','/uploads/articles/621b4c4b6584b9fb80a535cc5dbfc6bf.jpg','*Một buổi khám dễ theo dõi hơn khi người bệnh mang theo đúng hồ sơ, nhớ các thuốc đang dùng và chuẩn bị trước điều muốn trao đổi. Có thể bắt đầu bằng một tờ ghi chú ngắn, sắp xếp theo vấn đề quan tâm nhất.*

## Ghi lại diễn biến thay vì chỉ nhớ tên triệu chứng

Hãy ghi thời điểm triệu chứng bắt đầu, diễn ra liên tục hay từng đợt, điều gì làm tăng hoặc giảm khó chịu và những thay đổi trong ăn uống, giấc ngủ, vận động. Với vấn đề đã tái diễn, kết quả của những lần khám trước giúp bác sĩ có thêm bối cảnh.

Chọn vài câu hỏi quan trọng để hỏi trước. Chẳng hạn: triệu chứng này cần theo dõi điều gì, xét nghiệm được đề nghị nhằm làm rõ vấn đề nào, hoặc khi nào cần quay lại khám. Nếu khó nhớ, có thể viết câu hỏi trên điện thoại hoặc giấy và mang vào phòng khám.

![Quầy tiếp đón được bố trí tại khu vực sảnh để hướng dẫn người đến khám.](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Quầy tiếp đón được bố trí tại khu vực sảnh để hướng dẫn người đến khám.")

## Mang theo hồ sơ và danh sách thuốc

Sắp xếp giấy tờ cá nhân, thông tin lịch hẹn và kết quả gần đây vào cùng một tập. Đơn thuốc, giấy ra viện, kết quả xét nghiệm và phim chụp cũ nên có ngày thực hiện rõ ràng để thuận tiện đối chiếu.

Danh sách thuốc cần gồm cả thuốc kê đơn, thuốc tự mua, vitamin, thực phẩm bổ sung và sản phẩm thảo dược. Ghi tên, cách sử dụng thực tế, những lần bỏ liều và phản ứng từng gặp; nếu không nhớ tên, mang theo vỏ hộp hoặc ảnh nhãn thuốc.

## Hỏi rõ việc chuẩn bị cho từng chỉ định

Một số xét nghiệm hoặc thủ thuật cần có hướng dẫn riêng trước khi thực hiện. Hãy xác nhận yêu cầu từ cơ sở khám, nhất là chuyện ăn uống, dùng thuốc và có cần người đi cùng hay không. Không tự nhịn ăn hoặc dừng thuốc chỉ vì lần khám trước từng được hướng dẫn như vậy.

Nếu cần hỗ trợ di chuyển, giao tiếp hoặc đọc giấy tờ, nên báo từ lúc tiếp nhận. Người thân đi cùng có thể giúp ghi nhớ hướng dẫn, trong khi người bệnh vẫn được trực tiếp chia sẻ điều mình quan tâm.

## Trước khi kết thúc buổi khám

Hãy kiểm tra mình đã hiểu kế hoạch tiếp theo: thực hiện chỉ định ở đâu, nhận kết quả bằng cách nào, sử dụng thuốc ra sao và thời điểm tái khám. Có thể nhắc lại bằng lời của mình để nhân viên y tế xác nhận hoặc giải thích thêm.

Giữ hồ sơ sau khám theo thứ tự thời gian. Những thông tin này giúp lần tái khám tiếp nối được buổi khám trước và giảm việc phải nhớ lại toàn bộ quá trình từ đầu.

Nguồn: [National Institute on Aging — chuẩn bị câu hỏi và trao đổi khi đi khám](https://www.nia.nih.gov/health/5-ways-make-most-your-time-doctors-office).',1,'2026-10-13T01:00:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(12,1,'Lựa chọn chuyên khoa và trao đổi cùng bác sĩ','lua-chon-chuyen-khoa-va-trao-doi-cung-bac-si','Hướng dẫn khám bệnh','/uploads/articles/68178addee0c44c9a4121c22f11290dd.jpg','*Chọn chuyên khoa bắt đầu từ vấn đề sức khỏe đang gặp, không nhất thiết phải tự biết chính xác tên bệnh. Mô tả rõ triệu chứng và tiền sử giúp nhân viên y tế hướng dẫn điểm khám phù hợp.*

## Bắt đầu từ điều khiến bạn cần đi khám

Nếu triệu chứng mới xuất hiện hoặc ảnh hưởng nhiều cơ quan, hãy trình bày với bộ phận hướng dẫn để được định hướng. Người đang được theo dõi một bệnh mạn tính nên mang hồ sơ và lịch hẹn của bác sĩ điều trị để việc tiếp nhận có đủ thông tin.

Khi tìm hiểu chuyên khoa, cần đọc phạm vi khám và thông tin bác sĩ đang được cơ sở công bố. Tên chuyên khoa chỉ là bước định hướng; kết luận bệnh và lựa chọn xét nghiệm vẫn cần dựa trên buổi thăm khám trực tiếp.

![Bác sĩ thăm khám và điều dưỡng ghi nhận thông tin tại giường người bệnh.](/uploads/articles/b6f491239f14078bc972158ca5f8eb1d.jpg "Bác sĩ thăm khám và điều dưỡng ghi nhận thông tin tại giường người bệnh.")

## Chuẩn bị một bản mô tả ngắn gọn

Có thể sắp xếp thông tin theo ba câu hỏi: vấn đề bắt đầu từ khi nào, hiện gây khó chịu thế nào và trước đây đã được xử trí ra sao. Ghi rõ các thuốc đã dùng và mức thay đổi của triệu chứng sau đó.

Nếu có nhiều vấn đề, hãy nói vấn đề đáng lo nhất trước, rồi cung cấp phần còn lại để bác sĩ cùng cân nhắc thứ tự đánh giá. Đừng bỏ qua thông tin chỉ vì cho rằng nó không liên quan đến chuyên khoa đã chọn.

## Trao đổi để hiểu hướng đánh giá

Người bệnh có thể hỏi mục đích của xét nghiệm, những cách xử trí đang được cân nhắc và điều cần theo dõi sau buổi khám. Khi chưa hiểu một thuật ngữ, hãy đề nghị giải thích bằng cách diễn đạt quen thuộc hơn.

Nếu được hướng dẫn khám thêm chuyên khoa khác, cần hỏi rõ lý do chuyển, giấy tờ cần mang theo và kết quả nào nên giữ để đối chiếu. Việc chuyển chuyên khoa có thể là một phần của quá trình làm rõ vấn đề, vì từng nhóm chuyên môn có phạm vi đánh giá riêng.

## Tìm chăm sóc kịp thời khi diễn biến thay đổi

Lịch khám thông thường phù hợp với việc đánh giá theo hẹn. Khi tình trạng xấu đi nhanh hoặc có biểu hiện nặng như khó thở, đau ngực dữ dội, mất ý thức, hãy tìm trợ giúp y tế ngay và báo rõ triệu chứng tại nơi tiếp nhận.

Sau buổi khám, giữ lại tóm tắt hướng dẫn và lịch theo dõi. Một lần trao đổi đầy đủ giúp người bệnh hiểu mình cần làm gì tiếp theo và biết khi nào nên liên hệ lại với cơ sở y tế.

Nguồn: [National Institute on Aging — những câu hỏi trong buổi khám](https://www.nia.nih.gov/health/medical-care-and-appointments/what-should-i-ask-my-doctor-during-checkup).',1,'2026-10-13T01:01:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(13,1,'Từ khu vực tiếp đón đến phòng khám','tu-khu-vuc-tiep-don-den-phong-kham','Hướng dẫn khám bệnh','/uploads/articles/83e856c669a06875a98190946b0f1d8d.jpg','*Từ tiếp đón đến phòng khám, người bệnh thường cần xác nhận thông tin, nhận hướng dẫn và chờ đến lượt. Chuẩn bị giấy tờ gọn gàng, kiểm tra đúng nơi khám và chủ động hỏi khi chưa rõ giúp quá trình này thuận tiện hơn.*

## Kiểm tra thông tin ngay từ bước tiếp nhận

Khi đến cơ sở khám, hãy xuất trình giấy tờ và thông tin lịch hẹn theo hướng dẫn. Nếu đi cùng người thân hoặc đặt lịch hộ, cần xác nhận đúng người sẽ được khám để tránh nhầm hồ sơ.

Đối chiếu họ tên, ngày sinh, số điện thoại liên hệ và chuyên khoa. Khi phát hiện sai khác, báo nhân viên tiếp nhận để kiểm tra trước khi tiếp tục. Những điều chỉnh ở bước đầu giúp kết quả, đơn thuốc và giấy hẹn sau đó gắn với đúng hồ sơ.

![Không gian quầy tiếp đón và lối đi tại khu vực khám bệnh.](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Không gian quầy tiếp đón và lối đi tại khu vực khám bệnh.")

## Hỏi rõ phòng khám và bước cần thực hiện

Trước khi rời quầy, nên biết mình cần đến khu vực nào, mang theo giấy tờ gì và có cần hoàn tất thêm bước nào hay không. Nếu biển chỉ dẫn khó đọc, có thể nhờ nhân viên hướng dẫn trực tiếp thay vì tự đoán đường.

Người cần xe lăn, người cao tuổi hoặc người gặp khó khăn về nghe nhìn nên được hỗ trợ ngay từ đầu. Người đi cùng có thể giữ hồ sơ, trong khi người bệnh tập trung trao đổi về nhu cầu của bản thân.

## Chờ khám trong tâm thế chủ động

Theo dõi hướng dẫn tại khu vực đang chờ. Trước khi vào phòng, chuẩn bị sẵn giấy tờ và ghi chú về triệu chứng để không mất thời gian tìm lại. Giữ lối đi thông thoáng và trao đổi với nhân viên khi cần rời khu vực.

![Dãy ghế chờ được bố trí dọc hành lang, bên cạnh các cửa phòng khám.](/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg "Dãy ghế chờ được bố trí dọc hành lang, bên cạnh các cửa phòng khám.")

Nếu xuất hiện mệt nhiều hoặc triệu chứng thay đổi trong lúc chờ, cần báo ngay để được đánh giá. Không nên im lặng chờ chỉ vì đã có lịch hẹn từ trước.

## Giữ lại hướng dẫn sau buổi khám

Khi nhận chỉ định, đơn thuốc hoặc lịch tái khám, hãy kiểm tra lại thông tin cá nhân. Hỏi rõ nơi thực hiện xét nghiệm, cách nhận kết quả và bước tiếp theo; giữ giấy tờ cùng một tập để dễ đối chiếu.

Trước khi ra về, xác nhận những câu hỏi còn vướng mắc với nhân viên phụ trách. Sự rõ ràng ở từng bước giúp người bệnh tiếp tục kế hoạch chăm sóc mà không phải quay lại chỉ để bổ sung một thông tin có thể kiểm tra từ trước.',1,'2026-10-13T01:02:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(14,1,'Theo dõi lịch đã đăng ký và chuẩn bị cho ngày khám','khong-gian-kham-benh-va-theo-doi-lich-da-dang-ky','Hướng dẫn khám bệnh','/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg','*Lịch hẹn giúp người bệnh chủ động sắp xếp thời gian, nhưng vẫn cần được kiểm tra lại trước ngày khám. Họ tên, ngày, giờ, bác sĩ và trạng thái lịch là những thông tin nên đọc cùng nhau.*

## Đối chiếu đúng lịch của đúng người

Sau khi đăng ký, mở phần lịch khám để xem lại thông tin đã được ghi nhận. Nếu quản lý lịch cho nhiều thành viên gia đình, cần đọc tên người bệnh ở từng lịch, tránh chỉ nhìn ngày và giờ.

Giữ thông tin xác nhận ở nơi dễ tìm, chẳng hạn ghi chú trên điện thoại. Khi cần trao đổi với cơ sở y tế, cung cấp mã lịch hoặc thông tin định danh theo hướng dẫn để nhân viên tra cứu đúng lượt khám.

## Chuẩn bị trước ngày đến viện

Sắp xếp giấy tờ, kết quả cũ và danh sách thuốc đang dùng. Nếu lần khám có hướng dẫn chuẩn bị riêng, hãy đọc lại và hỏi cơ sở khám khi chưa rõ, đặc biệt với việc ăn uống hoặc sử dụng thuốc.

Chủ động tính thời gian di chuyển và thời gian làm thủ tục tại nơi khám. Khi cần người đi cùng, nên thống nhất trước việc hỗ trợ đi lại, giữ hồ sơ và ghi nhớ thông tin sau tư vấn.

![Khu vực ghế chờ bên ngoài các phòng khám, có biển chỉ dẫn tại hành lang.](/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg "Khu vực ghế chờ bên ngoài các phòng khám, có biển chỉ dẫn tại hành lang.")

## Khi muốn thay đổi kế hoạch

Nếu không thể đến đúng hẹn, kiểm tra những thao tác và điều kiện đang được hệ thống hoặc cơ sở khám cung cấp. Sau khi thực hiện một thay đổi, cần đọc lại trạng thái xác nhận; việc gửi yêu cầu chưa luôn đồng nghĩa lịch đã được thay đổi thành công.

Không tạo thêm nhiều lịch cho cùng một nhu cầu chỉ để thử các lựa chọn. Khi thông tin hiển thị chưa rõ hoặc thao tác chưa hoàn tất, nên liên hệ kênh hỗ trợ được công bố để kiểm tra.

## Nối tiếp việc theo dõi sau buổi khám

Lưu đơn thuốc, kết quả và lịch hẹn tiếp theo cùng hồ sơ của người được khám. Nếu bác sĩ dặn theo dõi một biểu hiện cụ thể, có thể ghi vào cùng ghi chú để nhớ trao đổi trong lần tái khám.

Một lịch hẹn được quản lý tốt đi cùng thông tin được lưu đầy đủ. Điều này giúp người bệnh dễ nhìn lại quá trình, biết bước tiếp theo và chuẩn bị đúng cho lần đến viện sau.',1,'2026-10-13T01:03:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(15,1,'Tâm Anh được vinh danh tại cuộc thi Cơ sở y tế xanh – sạch – đẹp','tam-anh-giai-thuong-co-so-y-te-xanh-sach-dep','Tin trong ngành','/uploads/articles/7c8162370033a43511468d0bdbc3b30f.jpg','*Giải thưởng về môi trường bệnh viện ghi nhận những nỗ lực từ cảnh quan đến vệ sinh và tổ chức không gian chăm sóc. Tại lễ trao giải ngày 7/8/2025, Bệnh viện Đa khoa Tâm Anh nhận giải Nhất cuộc thi Cơ sở y tế xanh – sạch – đẹp.*

## Ghi nhận từ cuộc thi lần đầu tổ chức

Theo thông tin Tâm Anh công bố, cuộc thi do Bộ Y tế phát động từ tháng 8/2024, có hơn 2.000 cơ sở tham gia. Kết quả vinh danh gắn việc xây dựng môi trường y tế với chất lượng phục vụ người bệnh.

![Các đơn vị nhận giải tại lễ trao giải Cơ sở y tế xanh – sạch – đẹp lần thứ nhất, năm 2025. Ảnh: Bệnh viện Đa khoa Tâm Anh.](/uploads/articles/7c8162370033a43511468d0bdbc3b30f.jpg "Các đơn vị nhận giải tại lễ trao giải Cơ sở y tế xanh – sạch – đẹp lần thứ nhất, năm 2025. Ảnh: Bệnh viện Đa khoa Tâm Anh.")

## Môi trường chăm sóc bắt đầu từ việc hằng ngày

Nhóm tiêu chí vệ sinh bao quát những việc thiết thực: giường bệnh, nhà vệ sinh, nước sạch, đồ vải và quản lý chất thải. Không gian chăm sóc cần được duy trì qua công việc thường ngày của nhiều bộ phận, từ lâm sàng đến vận hành.

Với người đến khám, một lối đi thuận tiện, khu vực chờ dễ nhận biết và đồ dùng sạch là những điểm có thể trực tiếp cảm nhận. Chăm chút các chi tiết ấy giúp môi trường bệnh viện gần gũi hơn.

## Tiếp tục duy trì sau vinh danh

Giải thưởng là dấu mốc để giới thiệu kinh nghiệm tổ chức môi trường y tế. Giá trị của những cải tiến tiếp tục được thể hiện trong mỗi ngày phục vụ, khi việc giữ sạch và bảo vệ môi trường trở thành trách nhiệm chung.

Nguồn: [Bệnh viện Đa khoa Tâm Anh — kết quả cuộc thi](https://tamanhhospital.vn/giai-thuong/co-so-y-te-xanh-sach-dep/), [những hoạt động giữ vệ sinh trong bệnh viện](https://tamanhhospital.vn/giai-thuong/3-giai-thuong-sach-khang-dinh-vi-the-dan-dau/).',1,'2026-10-13T01:04:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(16,1,'Uông Bí trao giải các tác phẩm truyền thông năm 2026','uong-bi-trao-giai-tac-pham-truyen-thong-2026','Tin trong ngành','/uploads/articles/0b5dd902e1346e1d037b9bd101acec26.jpg','*Ngày 18/6/2026, Bệnh viện Việt Nam – Thụy Điển Uông Bí tổ chức trao giải cuộc thi sáng tác tác phẩm truyền thông. Các tác giả và nhóm tác giả được ghi nhận qua những câu chuyện về đời sống, công việc và hình ảnh của bệnh viện.*

## Kể câu chuyện từ chính nơi làm việc

Cuộc thi hưởng ứng Tháng Công nhân năm 2026, khuyến khích sự sáng tạo và tinh thần gắn kết giữa các khoa, phòng, trung tâm. Nhân viên y tế có thêm một cách chia sẻ những điều được quan sát trong công việc hằng ngày.

![Các tác giả nhận giải cuộc thi sáng tác tác phẩm truyền thông năm 2026 tại Bệnh viện Việt Nam – Thụy Điển Uông Bí.](/uploads/articles/0b5dd902e1346e1d037b9bd101acec26.jpg "Các tác giả nhận giải cuộc thi sáng tác tác phẩm truyền thông năm 2026 tại Bệnh viện Việt Nam – Thụy Điển Uông Bí.")

## Truyền thông bằng những chi tiết gần gũi

Một câu chuyện dễ hiểu có thể bắt đầu từ việc rất nhỏ: hỗ trợ một người mới đến khám, giải thích một hướng dẫn hoặc phối hợp giữa đồng nghiệp. Cách kể rõ ràng giúp người đọc hình dung được công việc phía sau hoạt động chăm sóc.

## Ghi nhận và khuyến khích sáng tạo

Lễ trao giải dành sự ghi nhận cho những tác phẩm được lựa chọn. Hoạt động này cũng mở thêm không gian để đội ngũ y tế quan sát, viết và chia sẻ bằng trải nghiệm nghề nghiệp của mình.

Nguồn: [Bệnh viện Việt Nam – Thụy Điển Uông Bí — lễ trao giải năm 2026](https://vsh.org.vn/trao-giai-cuoc-thi-sang-tac-tac-pham-truyen-thong-nam-2026.htm).',1,'2026-10-12T01:05:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(17,1,'Hai giải pháp y tế thông minh được vinh danh tại Thành tựu Y khoa Việt Nam 2024','hai-giai-phap-y-te-thong-minh-thanh-tuu-y-khoa-2024','Tin trong ngành','/uploads/articles/14c210007a4c4b308808b8379726eeea.webp','*Bệnh viện Đại học Y Dược TP. Hồ Chí Minh được trao hai giải thưởng tại chương trình Thành tựu Y khoa Việt Nam 2024. Lễ trao giải diễn ra ngày 26/2/2025, với các công trình thuộc lĩnh vực dữ liệu bệnh án và công tác dược.*

## Hai công trình được ghi nhận

Giải Nhì dành cho giải pháp mã hóa dữ liệu lâm sàng trong bệnh án điện tử bằng SNOMED CT. Giải Ba ghi nhận ứng dụng công nghệ thông tin trong quản lý và triển khai công tác dược bệnh viện.

![Đoàn Bệnh viện Đại học Y Dược TP. Hồ Chí Minh tại lễ trao giải Thành tựu Y khoa Việt Nam 2024 với hai công trình y tế thông minh.](/uploads/articles/14c210007a4c4b308808b8379726eeea.webp "Đoàn Bệnh viện Đại học Y Dược TP. Hồ Chí Minh tại lễ trao giải Thành tựu Y khoa Việt Nam 2024 với hai công trình y tế thông minh.")

## Từ dữ liệu đến công việc chăm sóc

Mã hóa giúp thông tin lâm sàng được ghi nhận nhất quán hơn. Trong công tác dược, dữ liệu hỗ trợ kết nối các khâu cung ứng, cấp phát và theo dõi sử dụng thuốc. Đây là hai hướng ứng dụng công nghệ được bệnh viện giới thiệu qua giải thưởng.

## Công nghệ cần gắn với nhu cầu thực tế

Với người bệnh, điều dễ cảm nhận là thông tin được tìm thấy đúng lúc và hướng dẫn được tiếp nối qua các lần khám. Những cải tiến phía sau màn hình chỉ có ý nghĩa khi giúp đội ngũ chăm sóc làm việc rõ ràng, có thể kiểm tra và phối hợp tốt hơn.

Nguồn: [Bệnh viện Đại học Y Dược TP. Hồ Chí Minh — hai giải pháp được vinh danh](https://bvdaihoc.com.vn/thanh-tuu-va-giai-thuong/dat-giai-thuong-thanh-tuu-y-khoa-viet-nam-2024-voi-hai-giai-phap-y-te-thong-minh).',1,'2026-10-12T01:06:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(18,1,'Nhìn lại hội thi tay nghề điều dưỡng, kỹ thuật viên tại Bệnh viện Châm cứu Trung ương','hoi-thi-tay-nghe-dieu-duong-ky-thuat-vien-2020','Tin trong ngành','/uploads/articles/57635d7afcf74f14b44579cfa2f9f179.jpg','*Hội thi tay nghề là dịp để điều dưỡng và kỹ thuật viên ôn lại kiến thức, thực hành và học hỏi từ đồng nghiệp. Tại Bệnh viện Châm cứu Trung ương, lễ trao giải hội thi năm 2020 diễn ra ngày 3/12/2020.*

## Đánh giá qua lý thuyết và thực hành

Các thí sinh tham gia cả phần kiến thức và thao tác chuyên môn. Tám thí sinh từ bảy khoa được khen thưởng; điều dưỡng Hoàng Thị Mỹ Hạnh, Khoa Đột quỵ – Phục hồi chức năng, nhận giải Nhất.

![Đại diện Phòng Điều dưỡng phát biểu tại lễ trao giải hội thi tay nghề điều dưỡng, kỹ thuật viên năm 2020. Ảnh: Bệnh viện Châm cứu Trung ương.](/uploads/articles/57635d7afcf74f14b44579cfa2f9f179.jpg "Đại diện Phòng Điều dưỡng phát biểu tại lễ trao giải hội thi tay nghề điều dưỡng, kỹ thuật viên năm 2020. Ảnh: Bệnh viện Châm cứu Trung ương.")

## Học hỏi từ những thao tác cụ thể

Một buổi thi còn là cơ hội nhận ra phần việc cần rèn thêm. Khi một bước được làm rõ, người thực hiện có thể ghi nhớ lý do và áp dụng có ý thức hơn trong công việc.

## Mang tinh thần học tập về khoa phòng

Sự ghi nhận dành cho thí sinh tạo thêm động lực chia sẻ kinh nghiệm. Với một đội ngũ chăm sóc, học hỏi đều đặn giúp những điều đã được hướng dẫn có cơ hội trở thành thói quen làm việc chung.

Nguồn: [Bệnh viện Châm cứu Trung ương — kết quả hội thi năm 2020](https://benhvienchamcuu.com/tin-tuc/le-trao-giai-hoi-thi-tay-nghe-dieu-duong--ky-thuat-vien-nam-2020-184).',1,'2026-10-12T01:07:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(19,1,'An toàn phẫu thuật bắt đầu từ sự phối hợp của cả ê kíp','phoi-hop-cua-e-kip-trong-phong-phau-thuat','Hoạt động chuyên môn','/uploads/articles/085097a311df4184ea0222e027b5c131.jpg','*Trong phòng mổ, mỗi thành viên đảm nhận một phần việc nhưng cùng hướng đến sự an toàn của người bệnh. Trao đổi rõ ràng, xác nhận thông tin và bàn giao đầy đủ giúp các bước chăm sóc nối tiếp nhau.*

## Xác nhận trước khi bắt đầu

Người bệnh, thủ thuật dự kiến và vị trí can thiệp cần được kiểm tra theo quy trình của cơ sở. Những câu hỏi được lặp lại ở các thời điểm khác nhau nhằm đối chiếu thông tin trước những bước quan trọng.

Người bệnh nên báo các thuốc đang dùng, dị ứng đã biết và vấn đề từng gặp trong lần phẫu thuật hoặc gây mê trước. Nếu còn điều chưa hiểu về thủ thuật, hãy đề nghị giải thích trước khi hoàn tất việc đồng ý thực hiện.

![Các thành viên ê kíp làm việc quanh bàn phẫu thuật dưới hệ thống đèn mổ.](/uploads/articles/085097a311df4184ea0222e027b5c131.jpg "Các thành viên ê kíp làm việc quanh bàn phẫu thuật dưới hệ thống đèn mổ.")

## Trao đổi để cùng nắm kế hoạch

Bảng kiểm an toàn phẫu thuật của WHO đặt trọng tâm vào những điểm xác nhận trước gây mê, trước rạch da và trước khi người bệnh rời phòng mổ. Tại các thời điểm này, ê kíp có cơ hội cùng nói rõ những nội dung cần lưu ý.

Một thông tin được nói ra đúng lúc có thể giúp đồng nghiệp kiểm tra lại trước khi tiếp tục. Mỗi người cần có cơ hội nêu thắc mắc khi nhận thấy điều chưa rõ, thay vì giữ lại vì cho rằng người khác đã biết.

## Bàn giao để chăm sóc được tiếp nối

Khi kết thúc thủ thuật, những thông tin liên quan đến diễn biến, mẫu bệnh phẩm, dụng cụ và kế hoạch theo dõi cần được chuyển đến bộ phận tiếp nhận theo quy trình. Bàn giao là cầu nối giữa công việc trong phòng mổ và chăm sóc sau đó.

![Ê kíp phối hợp trong phòng can thiệp có hệ thống màn hình theo dõi hình ảnh.](/uploads/articles/a63effb466662b57fc234bfc75bbcdc6.jpg "Ê kíp phối hợp trong phòng can thiệp có hệ thống màn hình theo dõi hình ảnh.")

## Người bệnh và gia đình cùng tham gia

Gia đình cần biết ai là đầu mối cung cấp thông tin và khi nào nhận hướng dẫn sau phẫu thuật. Trước khi ra viện, nên hỏi rõ cách chăm sóc, lịch tái khám và những thay đổi cần liên hệ lại với cơ sở điều trị.

An toàn được xây dựng từ nhiều bước nhỏ được thực hiện nhất quán. Từ xác nhận danh tính đến trao đổi và bàn giao, sự phối hợp giúp mỗi phần việc gắn với kế hoạch chung dành cho đúng người bệnh.

Nguồn: [WHO — bảng kiểm và tài liệu về an toàn phẫu thuật](https://www.who.int/teams/integrated-health-services/quality-of-care-and-patient-safety/patient-safety-guidance-and-tools/safe-surgery/tool-and-resources).',1,'2026-10-12T01:08:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(24,1,'Viêm não do vi rút: phòng bệnh và nhận biết dấu hiệu cần cấp cứu','tim-hieu-thong-tin-ve-viem-nao-nhat-ban','Kiến thức sức khỏe','/uploads/articles/3814bc5d86e8cf64ecf472d9141ed3c7.jpg','*Sốt kèm đau đầu dữ dội, thay đổi ý thức hoặc co giật cần được đánh giá y tế ngay. Viêm não có nhiều nguyên nhân; các biện pháp phòng bệnh cần dựa vào đường lây của từng tác nhân.*

## Viêm não và viêm não Nhật Bản khác nhau thế nào?

Viêm não là tình trạng viêm ở não, có thể liên quan đến nhiều loại vi rút. Viêm não Nhật Bản là một bệnh cụ thể do vi rút truyền qua muỗi, không phải tên gọi chung của mọi trường hợp viêm não.

Đặc điểm này có ý nghĩa khi lựa chọn biện pháp phòng ngừa. Giữ vệ sinh, hạn chế muỗi đốt và tiêm chủng cần được hiểu theo từng bệnh; một loại vắc xin không phòng được tất cả tác nhân gây viêm não.

![Các biện pháp phòng viêm não do vi rút: vệ sinh môi trường, tránh muỗi đốt và tiêm chủng đúng hướng dẫn.](/uploads/articles/3814bc5d86e8cf64ecf472d9141ed3c7.jpg "Các biện pháp phòng viêm não do vi rút: vệ sinh môi trường, tránh muỗi đốt và tiêm chủng đúng hướng dẫn.")

## Giảm tiếp xúc với muỗi và giữ nơi ở sạch

Ngủ màn, sử dụng biện pháp xua muỗi phù hợp và mặc quần áo giúp hạn chế vùng da hở là những cách giảm muỗi đốt. Gia đình nên kiểm tra chỗ nước đọng, vệ sinh nơi ở và phối hợp với hoạt động kiểm soát muỗi tại địa phương.

Đối với tiêm phòng viêm não Nhật Bản, cần mang sổ tiêm để nhân viên y tế kiểm tra loại vắc xin và các mũi đã có. Lịch tiêm phụ thuộc sản phẩm, tuổi và tiền sử; không tự áp dụng một lịch duy nhất cho mọi trẻ chỉ từ thông tin trên áp phích.

## Khi nào cần đưa người bệnh đi ngay?

Sốt đi cùng lơ mơ, khó đánh thức, co giật, đau đầu nặng hoặc cổ cứng là tình huống cần đến cơ sở y tế khẩn cấp. Không chờ xuất hiện đầy đủ các dấu hiệu mới tìm chăm sóc.

Người đi cùng nên cung cấp thời điểm khởi phát, những thay đổi đã quan sát và thuốc đã sử dụng. Những thông tin ấy hỗ trợ đánh giá, nhưng việc xác định nguyên nhân vẫn cần thăm khám và xét nghiệm theo chỉ định.

## Chuẩn bị để phòng bệnh lâu dài

Gia đình có thể giữ sổ tiêm ở một nơi dễ tìm, ghi lại các lần hẹn tiếp theo và duy trì việc kiểm tra môi trường quanh nhà. Phòng bệnh đều đặn giúp các việc nhỏ không bị bỏ quên giữa những sinh hoạt bận rộn.

Nguồn: [WHO — Viêm não Nhật Bản](https://www.who.int/news-room/fact-sheets/detail/japanese-encephalitis).',1,'2026-10-11T01:13:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(25,1,'Vệ sinh cá nhân: duy trì thói quen sạch trong sinh hoạt hằng ngày','ve-sinh-ca-nhan-trong-sinh-hoat-hang-ngay','Kiến thức sức khỏe','/uploads/articles/95dd9dc83516bbd85fc983a5134791f8.jpg','*Vệ sinh cá nhân hiệu quả bắt đầu từ những thời điểm dễ làm lây tác nhân gây bệnh: chuẩn bị bữa ăn, đi vệ sinh, chăm trẻ và tiếp xúc đồ dùng chung. Thói quen đều đặn quan trọng hơn việc chỉ làm sạch khi thấy bẩn.*

## Bàn tay nối giữa nhiều bề mặt

Trong một ngày, bàn tay chạm vào điện thoại, tay nắm cửa, thực phẩm và cơ thể. Khi chưa được làm sạch, tay có thể đưa tác nhân từ bề mặt lên mắt, mũi, miệng hoặc sang thức ăn.

Cần nhớ rửa tay trước khi chế biến và ăn uống; sau khi đi vệ sinh, thay tã, ho hoặc hắt hơi, tiếp xúc động vật và xử lý rác. Người chăm sóc người đang nôn, tiêu chảy cũng cần chú ý vệ sinh tay trước và sau khi hỗ trợ.

## Rửa đủ các vùng trên bàn tay

Làm ướt tay bằng nước sạch, dùng xà phòng rồi chà kỹ lòng bàn tay, mu bàn tay, kẽ ngón và quanh móng trong ít nhất 20 giây. Sau đó xả sạch và làm khô bằng khăn sạch hoặc thiết bị phù hợp.

![Hướng dẫn vệ sinh cá nhân trước và sau lao động: rửa tay, làm sạch cơ thể và giữ đồ dùng sạch.](/uploads/articles/95dd9dc83516bbd85fc983a5134791f8.jpg "Hướng dẫn vệ sinh cá nhân trước và sau lao động: rửa tay, làm sạch cơ thể và giữ đồ dùng sạch.")

## Giữ đồ dùng cá nhân khô và sạch

Sắp xếp khăn, bàn chải và dụng cụ chăm sóc ở vị trí dễ làm sạch, tránh để lẫn đồ bẩn với đồ đã vệ sinh. Những món dùng thường xuyên cần được làm sạch theo hướng dẫn của sản phẩm.

Với trẻ nhỏ, người lớn có thể cùng thực hiện thay vì chỉ nhắc. Một chỗ rửa tay có xà phòng, khăn sạch và đồ dùng vừa tầm giúp trẻ chủ động hơn trong sinh hoạt.

## Biến việc cần làm thành thói quen dễ nhớ

Có thể gắn mỗi việc vệ sinh với một mốc quen thuộc: trước bữa ăn, sau khi về nhà hoặc sau khi dọn rác. Khi chuẩn bị đi xa, kiểm tra trước nơi có thể rửa tay và đồ dùng cần mang theo.

Trong gia đình, thống nhất nơi để đồ sạch và cách xử lý đồ bẩn giúp các thành viên dễ tiếp nối công việc của nhau. Những sắp xếp nhỏ ấy làm cho việc giữ vệ sinh bền vững và thuận tiện hơn.

Nguồn: [CDC — Vệ sinh tay](https://www.cdc.gov/clean-hands/about/index.html).',1,'2026-10-11T01:14:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(26,1,'Cộng đồng cùng phòng bệnh: bắt đầu từ những việc có thể duy trì','chu-dong-tim-hieu-thong-tin-phong-chong-dich-benh','Kiến thức sức khỏe','/uploads/articles/fcf77260c0a78800d65382dbfd864285.jpg','*Phòng chống dịch bệnh cần sự tham gia của từng gia đình, trường học và nơi làm việc. Thông tin rõ ràng đi cùng hành động cụ thể giúp mọi người biết mình có thể làm gì để bảo vệ bản thân và người xung quanh.*

## Chọn thông tin có thể kiểm tra

Khi đọc một khuyến cáo, cần xem cơ quan ban hành, ngày cập nhật và bệnh đang được đề cập. Một hướng dẫn dành cho bệnh này hoặc một giai đoạn dịch không nhất thiết áp dụng nguyên vẹn cho tình huống khác.

Nếu nhận được thông tin khiến lo lắng, hãy kiểm tra tại cơ quan y tế địa phương hoặc nguồn chính thức trước khi chia sẻ. Hạn chế chuyển tiếp hình ảnh có thông tin riêng tư hay kết luận về người mắc bệnh khi chưa được xác minh.

![Những hành động cộng đồng có thể cùng thực hiện: giữ vệ sinh, dùng thực phẩm an toàn và phối hợp với y tế.](/uploads/articles/fcf77260c0a78800d65382dbfd864285.jpg "Những hành động cộng đồng có thể cùng thực hiện: giữ vệ sinh, dùng thực phẩm an toàn và phối hợp với y tế.")

## Tạo điều kiện để mọi người cùng làm

Đặt xà phòng ở nơi rửa tay, giữ khu vực sinh hoạt chung sạch và lựa chọn cách thông gió phù hợp là những việc có thể phân công rõ ràng. Ở nơi tập thể, nên có người kiểm tra định kỳ thay vì chỉ dọn khi có phản ánh.

Với bệnh hô hấp, tiêm chủng theo khuyến cáo, giữ vệ sinh và cải thiện chất lượng không khí là các biện pháp nền tảng. Khẩu trang và hạn chế tiếp xúc gần có thể bổ sung bảo vệ ở nơi đông người hoặc khi cần bảo vệ người dễ bệnh nặng.

## Hỗ trợ người đang có triệu chứng

Người mệt, ho hoặc sốt cần điều kiện nghỉ ngơi và tìm tư vấn phù hợp. Gia đình có thể hỗ trợ việc ăn uống, theo dõi thay đổi và liên hệ cơ sở y tế khi có dấu hiệu đáng lo.

Tại trường học hoặc nơi làm việc, nên có cách báo nghỉ dễ hiểu và đầu mối giải đáp thống nhất. Cách tổ chức thuận tiện giúp một khuyến cáo trở thành việc có thể làm được trong thực tế.

## Phối hợp mà không kỳ thị

Cung cấp thông tin sức khỏe liên quan theo hướng dẫn của nhân viên y tế và tôn trọng quyền riêng tư của người bệnh. Một cộng đồng biết hỗ trợ sẽ giúp người có triệu chứng chủ động tìm chăm sóc sớm hơn.

Nguồn: [CDC — Phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/index.html).',1,'2026-10-10T01:15:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(27,1,'Vi rút Nipah: đường lây và những điều cần chú ý khi phòng bệnh','tu-lieu-tim-hieu-ve-virus-nipah','Kiến thức sức khỏe','/uploads/articles/88545f51c30d6b9df8ccedd4dcd8a67f.jpg','*Nipah là vi rút có thể lây từ động vật sang người, qua thực phẩm bị nhiễm hoặc khi tiếp xúc gần với người bệnh. Phòng ngừa cần chú ý nguồn tiếp xúc, an toàn ăn uống và việc tìm chăm sóc sớm khi có triệu chứng đáng lo.*

## Nhận biết những đường tiếp xúc cần lưu ý

Dơi ăn quả là vật chủ tự nhiên của vi rút Nipah. Một số vụ dịch có liên quan đến tiếp xúc động vật mắc bệnh hoặc dùng sản phẩm bị nhiễm từ dơi; vi rút cũng có thể lây giữa người với người khi tiếp xúc gần.

Vì vậy, không nên hiểu Nipah chỉ là bệnh liên quan đến một loại thực phẩm. Công việc chăn nuôi, chăm sóc người bệnh và hành trình đến vùng có dịch đều là những thông tin cần trao đổi khi được đánh giá nguy cơ.

![Khuyến cáo về Nipah tập trung vào người đi từ vùng dịch, vệ sinh ăn uống và tiếp xúc an toàn.](/uploads/articles/88545f51c30d6b9df8ccedd4dcd8a67f.jpg "Khuyến cáo về Nipah tập trung vào người đi từ vùng dịch, vệ sinh ăn uống và tiếp xúc an toàn.")

## Ăn uống và chăm sóc an toàn

Rửa sạch và gọt vỏ trái cây; loại bỏ quả có dấu hiệu bị động vật cắn. Tránh sử dụng sản phẩm sống có nguy cơ bị dơi làm nhiễm, đồng thời tuân thủ hướng dẫn tại nơi đến nếu có cảnh báo dịch.

Khi chăm sóc người nghi mắc bệnh, cần hạn chế tiếp xúc không được bảo vệ với dịch cơ thể, vệ sinh tay và làm theo hướng dẫn của nhân viên y tế. Không tự tiếp xúc hoặc xử lý động vật ốm mà thiếu hướng dẫn chuyên môn.

## Khi xuất hiện biểu hiện bất thường

Sốt có thể đi cùng đau đầu, ho, khó thở hoặc thay đổi thần kinh. Triệu chứng không đủ để tự xác định Nipah; xét nghiệm và đánh giá chuyên môn giúp phân biệt với các nguyên nhân khác.

Nếu sốt sau một tiếp xúc đáng ngờ, hãy liên hệ cơ sở y tế, nói rõ nơi đã đến và tình huống tiếp xúc. Khi có khó thở, lú lẫn hoặc diễn biến nặng, cần được chăm sóc khẩn cấp.

## Theo dõi khuyến cáo đúng nơi, đúng thời điểm

Trước chuyến đi, lưu kênh thông tin của cơ quan y tế tại điểm đến và đầu mối có thể liên hệ. Khi trở về, giữ lại thông tin hành trình để dễ cung cấp nếu cần thăm khám.

Nguồn: [WHO — Vi rút Nipah](https://www.who.int/news-room/fact-sheets/detail/nipah-virus).',1,'2026-10-10T01:16:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(28,1,'Mùa đông xuân: chuẩn bị thói quen bảo vệ sức khỏe cho gia đình','cham-soc-suc-khoe-trong-mua-dong-xuan','Kiến thức sức khỏe','/uploads/articles/8266e3b47f3843f086d02c292235c7b7.png','*Ngày lạnh thường khiến sinh hoạt diễn ra nhiều hơn trong không gian kín. Chuẩn bị quần áo phù hợp, giữ vệ sinh và có kế hoạch chăm sóc người dễ bị bệnh nặng giúp gia đình chủ động hơn trong mùa đông xuân.*

## Chuẩn bị theo nhu cầu từng thành viên

Người cao tuổi, trẻ nhỏ, phụ nữ mang thai và người có bệnh nền cần được chú ý khi có bệnh hô hấp. Hãy kiểm tra lịch tái khám, thuốc đang sử dụng và đầu mối liên hệ của cơ sở điều trị trước những kỳ nghỉ dài.

Với người đang được theo dõi bệnh mạn tính, kế hoạch đã thống nhất với bác sĩ cần được tiếp tục. Khi sức khỏe thay đổi, báo tình trạng mới thay vì tự thay liều hoặc dùng thêm thuốc theo lời truyền miệng.

![Khuyến cáo mùa đông xuân nhắc giữ ấm, ăn uống đủ chất, vệ sinh và tiêm chủng phòng các bệnh có vắc xin.](/uploads/articles/8266e3b47f3843f086d02c292235c7b7.png "Khuyến cáo mùa đông xuân nhắc giữ ấm, ăn uống đủ chất, vệ sinh và tiêm chủng phòng các bệnh có vắc xin.")

## Giữ ấm cùng với giữ nơi ở thoáng

Chọn quần áo phù hợp nhiệt độ và khả năng vận động. Trong nhà, giữ không gian sạch và thông thoáng khi điều kiện cho phép; tránh khói thuốc và những nguồn làm chất lượng không khí kém đi.

Sắp xếp sẵn đồ dùng chăm sóc, giấy tờ sức khỏe và thông tin liên hệ giúp giảm lúng túng khi một thành viên bị mệt. Người chăm trẻ nên biết trước ai có thể hỗ trợ nếu trẻ cần đến cơ sở y tế.

## Khi gia đình có người ho, sốt

Tạo điều kiện nghỉ ngơi, hạn chế tiếp xúc gần với người dễ bệnh nặng và chú ý vệ sinh tay. Nếu nghi cúm ở người thuộc nhóm nguy cơ, nên tìm tư vấn sớm để được đánh giá hướng chăm sóc phù hợp.

Khó thở, đau ngực, lơ mơ hoặc tình trạng xấu đi nhanh cần được đưa đi khám khẩn cấp. Không chỉ nhìn nhiệt độ để quyết định mức độ nghiêm trọng của bệnh.

## Chủ động trước mùa bệnh

Mang sổ tiêm khi tư vấn tiêm chủng và hỏi các mũi phù hợp với tuổi, bệnh nền. Một danh sách việc cần chuẩn bị ngắn gọn giúp gia đình duy trì kế hoạch phòng bệnh cả khi nhịp sinh hoạt thay đổi.

Nguồn: [NHS — Cúm](https://www.nhs.uk/conditions/flu/).',1,'2026-10-10T01:17:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(29,1,'Bệnh đường hô hấp: phòng ngừa bằng nhiều lớp bảo vệ','thong-tin-ve-benh-duong-ho-hap-va-cum-mua','Kiến thức sức khỏe','/uploads/articles/e656d82fb47a099500c385f48336e829.jpg','*Rửa tay, không khí sạch, tiêm chủng và những biện pháp bảo vệ khi tiếp xúc đều có vai trò trong phòng bệnh hô hấp. Kết hợp các biện pháp phù hợp giúp giảm nguy cơ ở gia đình và nơi tập thể.*

## Mỗi biện pháp hỗ trợ một phần

Tác nhân gây bệnh hô hấp có thể lan qua không khí và tiếp xúc trong sinh hoạt. Vì vậy, chỉ lau đồ dùng mà bỏ qua thông khí hoặc tiếp xúc gần sẽ chưa bao quát hết các tình huống.

Các biện pháp nền tảng gồm tiêm chủng theo khuyến cáo, vệ sinh tay và cải thiện không khí trong nhà. Khi bệnh lưu hành nhiều hoặc cần bảo vệ người có nguy cơ, khẩu trang và giảm tiếp xúc gần là những lớp bảo vệ bổ sung.

![Khuyến cáo phòng bệnh đường hô hấp nêu các việc cần làm khi sinh hoạt và khi có triệu chứng.](/uploads/articles/e656d82fb47a099500c385f48336e829.jpg "Khuyến cáo phòng bệnh đường hô hấp nêu các việc cần làm khi sinh hoạt và khi có triệu chứng.")

## Bố trí không gian thuận tiện cho phòng bệnh

Đảm bảo nơi rửa tay có xà phòng, đặt thùng rác ở vị trí phù hợp và giữ các khu vực thường chạm sạch. Thực hiện những việc này đều đặn giúp người dùng không phải tìm đồ hoặc bỏ qua chỉ vì bất tiện.

Với phòng kín, cân nhắc tăng không khí ngoài trời khi điều kiện cho phép hoặc sử dụng hệ thống thông khí, lọc khí phù hợp. Giảm thời gian ở nơi đông người, bí khí cũng giúp hạn chế những cuộc tiếp xúc không cần thiết.

## Có triệu chứng thì cần làm gì?

Người ho, sốt hoặc mệt nên nghỉ ngơi, hạn chế tiếp xúc với người khác và theo dõi diễn biến. Người thuộc nhóm dễ bệnh nặng cần tìm tư vấn y tế sớm, vì việc đánh giá và điều trị có thể phụ thuộc thời điểm.

Không tự phân biệt cúm, COVID-19 hoặc tác nhân khác chỉ bằng một biểu hiện. Khi đi khám, cung cấp thời điểm bắt đầu bệnh, tiếp xúc gần đây, bệnh nền và thuốc đã dùng.

## Bảo vệ người dễ bệnh nặng

Nếu sống cùng trẻ nhỏ, người cao tuổi hoặc người suy giảm miễn dịch, nên thống nhất cách hỗ trợ khi có người ốm. Những thói quen được cả nhà cùng thực hiện giúp kế hoạch phòng bệnh bớt phụ thuộc vào việc phải nhắc nhau liên tục.

Nguồn: [CDC — Phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/index.html).',1,'2026-10-10T01:18:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(30,1,'Phòng bệnh mùa hè từ nước sạch, bữa ăn và môi trường sống','ve-sinh-moi-truong-va-suc-khoe-trong-mua-he','Kiến thức sức khỏe','/uploads/articles/2725da7d4db960c7a6ecd9f2972b4b3a.jpg','*Mùa hè là lúc cần chú ý đồng thời đến thực phẩm, nước sinh hoạt và nơi muỗi sinh sản. Những việc phòng bệnh có thể bắt đầu ngay từ căn bếp, sân nhà và cách theo dõi người đang mệt.*

## Kiểm tra từ nguồn nước và nguyên liệu

Nước dùng để uống, làm đá và chế biến thức ăn cần được bảo đảm an toàn. Khi đi xa hoặc ăn ở nơi mới, cần quan tâm nguồn nước, điều kiện bảo quản và việc thức ăn có được nấu chín hay không.

Giữ sạch, tách thực phẩm sống và chín, nấu kỹ, bảo quản ở nhiệt độ phù hợp và sử dụng nguyên liệu an toàn là năm nguyên tắc WHO nhấn mạnh. Các bước cần được tiếp nối từ chuẩn bị đến phục vụ, không chỉ tập trung vào lúc nấu.

![Phòng dịch mùa hè: bảo đảm an toàn ăn uống, giữ vệ sinh, diệt lăng quăng và đi khám khi có dấu hiệu nghi ngờ.](/uploads/articles/2725da7d4db960c7a6ecd9f2972b4b3a.jpg "Phòng dịch mùa hè: bảo đảm an toàn ăn uống, giữ vệ sinh, diệt lăng quăng và đi khám khi có dấu hiệu nghi ngờ.")

## Dọn nước đọng và hạn chế muỗi đốt

Kiểm tra dụng cụ chứa nước, đồ phế thải và những vị trí có thể đọng nước quanh nơi ở. Phân công người kiểm tra định kỳ giúp việc dọn môi trường không bị gián đoạn sau một lần tổng vệ sinh.

Phòng sốt xuất huyết cần chú ý tránh muỗi đốt cả ban ngày. Gia đình nên sử dụng các biện pháp bảo vệ phù hợp và phối hợp với hướng dẫn kiểm soát muỗi tại địa phương.

## Không xem mọi cơn sốt là giống nhau

Sốt, đau đầu, nôn hoặc đau bụng có thể do nhiều nguyên nhân. Khi đi khám, cần nói rõ thời điểm bắt đầu bệnh, thực phẩm đã dùng, nơi đã đến và thuốc đang sử dụng.

Đặc biệt, nghi sốt xuất huyết mà có đau bụng nhiều, nôn liên tục, chảy máu hoặc mệt lả cần được đánh giá ngay. Dấu hiệu nặng có thể xuất hiện khi sốt đã giảm, nên không chỉ dựa vào nhiệt độ để yên tâm.

## Duy trì những việc dễ kiểm tra

Có thể lập một bảng việc ngắn cho gia đình: kiểm tra nước uống, làm sạch khu chế biến, kiểm tra tủ bảo quản và dọn nơi nước đọng. Gắn người phụ trách với từng việc giúp thói quen phòng bệnh tiếp tục sau mùa cao điểm.

Nguồn: [WHO — năm nguyên tắc thực phẩm an toàn](https://www.who.int/activities/promoting-safe-food-handling/five-key-to-safer-food/), [WHO — sốt xuất huyết](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue).',1,'2026-10-10T01:19:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(31,1,'Dịch tả lợn châu Phi: hiểu đúng để cùng bảo vệ chăn nuôi','dich-ta-lon-chau-phi-thong-tin-ve-benh-o-dong-vat','Kiến thức sức khỏe','/uploads/articles/09ac3ebe914af27173caa06882828273.jpg','*Dịch tả lợn châu Phi là bệnh ở lợn nuôi và lợn rừng, gây thiệt hại lớn cho chăn nuôi. Hiểu đúng về bệnh giúp người dân tránh hoang mang và thực hiện những biện pháp hạn chế phát tán mầm bệnh.*

## Phân biệt bệnh ở động vật với nguy cơ ở người

Theo Tổ chức Thú y Thế giới, vi rút dịch tả lợn châu Phi không gây bệnh cho người. Tuy vậy, dịch có thể ảnh hưởng nghiêm trọng đến đàn lợn, sinh kế và chuỗi cung ứng thực phẩm.

Người tiêu dùng vẫn cần chọn thịt có nguồn gốc được kiểm soát và chế biến đúng vệ sinh. Thông tin một bệnh không lây sang người không có nghĩa mọi sản phẩm không rõ nguồn gốc đều an toàn để sử dụng.

![Dấu hiệu mắc bệnh ở lợn và biện pháp an toàn sinh học trong phòng dịch tả lợn châu Phi.](/uploads/articles/09ac3ebe914af27173caa06882828273.jpg "Dấu hiệu mắc bệnh ở lợn và biện pháp an toàn sinh học trong phòng dịch tả lợn châu Phi.")

## Con người có thể làm mầm bệnh di chuyển

Vi rút có thể tồn tại trên phương tiện, giày dép, quần áo, dụng cụ và một số sản phẩm từ lợn. Vận chuyển hoặc sử dụng thức ăn thừa không được xử lý phù hợp có thể góp phần đưa mầm bệnh đến đàn lợn khác.

Ở cơ sở chăn nuôi, cần kiểm soát người và phương tiện ra vào, làm sạch dụng cụ và tuân thủ hướng dẫn an toàn sinh học. Người không có nhiệm vụ nên hạn chế ra vào khu đang có nghi ngờ dịch.

## Khi phát hiện đàn lợn có biểu hiện bất thường

Lợn sốt, bỏ ăn, có vùng da đổi màu hoặc chết bất thường cần được báo cho thú y địa phương. Dấu hiệu bên ngoài chỉ gợi ý; xác định bệnh cần xét nghiệm chuyên môn.

Không tự vận chuyển, bán chạy hoặc xử lý xác động vật theo cách làm phát tán ra môi trường. Ghi lại thời điểm phát hiện và những thay đổi của đàn để cung cấp cho đơn vị phụ trách.

## Chia sẻ thông tin có nguồn

Trước khi chuyển tiếp tin về ổ dịch hoặc khuyến cáo tiêu dùng, cần kiểm tra cơ quan công bố và phạm vi áp dụng. Thông tin chính xác giúp việc phòng dịch tập trung vào hành động cần thiết và hỗ trợ người chăn nuôi phản ứng kịp thời.

Nguồn: [WOAH — Dịch tả lợn châu Phi](https://www.woah.org/en/disease/african-swine-fever/).',1,'2026-10-09T01:20:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(32,1,'Đau mắt đỏ: vệ sinh đúng và nhận biết khi cần khám','dau-mat-do-doc-thong-tin-tu-nguon-chinh-thong','Kiến thức sức khỏe','/uploads/articles/a27b33ba114fbca36ad72b1466487c1d.jpg','*Mắt đỏ có thể do vi rút, vi khuẩn, dị ứng hoặc những nguyên nhân khác. Giữ vệ sinh giúp hạn chế lây trong một số trường hợp, còn đau mắt, sợ ánh sáng và nhìn mờ là những dấu hiệu cần được khám.*

## Đừng kết luận chỉ vì thấy mắt đỏ

Viêm kết mạc thường gây đỏ, chảy nước mắt, ngứa hoặc ghèn. Tuy nhiên, biểu hiện giống nhau không luôn có cùng nguyên nhân, nên thuốc từng dùng trong một đợt đau mắt trước chưa chắc phù hợp với lần này.

Người đeo kính áp tròng, trẻ sơ sinh hoặc người có thị lực thay đổi cần được đánh giá phù hợp. Khi đi khám, mang thông tin thuốc nhỏ mắt đã sử dụng và cho biết triệu chứng bắt đầu ở mắt nào.

![Khuyến cáo phòng đau mắt đỏ nhấn mạnh rửa tay và không dùng chung khăn, chậu rửa mặt.](/uploads/articles/a27b33ba114fbca36ad72b1466487c1d.jpg "Khuyến cáo phòng đau mắt đỏ nhấn mạnh rửa tay và không dùng chung khăn, chậu rửa mặt.")

## Hạn chế lây qua tay và đồ dùng

Rửa tay trước và sau khi chăm sóc mắt; tránh dụi mắt hoặc chạm đầu lọ thuốc vào mắt, tay và các bề mặt. Không dùng chung khăn mặt, mỹ phẩm mắt hoặc vật dụng có thể dính dịch tiết.

Khi gia đình có người đau mắt, nên sắp xếp đồ dùng riêng và làm sạch những bề mặt hay chạm. Người hỗ trợ chăm sóc cũng cần vệ sinh tay sau khi tiếp xúc với khăn, giấy lau đã dùng.

## Những lúc cần khám sớm

Đau rõ, nhạy cảm với ánh sáng, nhìn mờ hoặc triệu chứng tăng lên cần được khám. Trẻ sơ sinh có mắt đỏ hoặc tiết dịch cần được bác sĩ đánh giá ngay.

Không tự dùng kéo dài thuốc nhỏ mắt, nhất là sản phẩm có corticoid hoặc thuốc được người khác chia sẻ. Điều trị phụ thuộc nguyên nhân, không chỉ nhằm làm mắt bớt đỏ.

![Bác sĩ dùng đèn khe kiểm tra mắt, giúp đánh giá các cấu trúc tại chuyên khoa mắt.](/uploads/articles/36d4acc110bbe26e4c5e79f55c73c3e6.png "Bác sĩ dùng đèn khe kiểm tra mắt, giúp đánh giá các cấu trúc tại chuyên khoa mắt.")

## Khi quay lại sinh hoạt tập thể

Trao đổi với nhân viên y tế về thời điểm trở lại lớp học hoặc nơi làm việc nếu còn triệu chứng. Cách sắp xếp nên tính đến mức tiếp xúc gần, điều kiện vệ sinh và hướng dẫn tại cơ sở, thay vì tự đặt một số ngày nghỉ giống nhau cho mọi người.

Nguồn: [CDC — Viêm kết mạc](https://www.cdc.gov/conjunctivitis/about/index.html).',1,'2026-10-09T01:21:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(33,1,'Mpox: nhận biết biểu hiện và phòng lây khi tiếp xúc gần','tu-lieu-truyen-thong-ve-mpox','Kiến thức sức khỏe','/uploads/articles/a3a3befb4c430ba35dca80646230561d.jpg','*Mpox có thể gây tổn thương da hoặc niêm mạc, đôi khi đi cùng sốt, đau người và nổi hạch. Nhận biết sớm, hạn chế tiếp xúc khi nghi bệnh và tìm tư vấn giúp bảo vệ người bệnh cùng những người ở gần.*

## Biểu hiện cần được đánh giá trong bối cảnh

Phát ban hoặc vết loét có thể xuất hiện ở những vị trí khác nhau. Các triệu chứng có thể đi kèm mệt, đau đầu hoặc sưng hạch, nhưng không phải ai cũng có cùng trình tự biểu hiện.

Một tổn thương trên da chưa đủ để tự kết luận mpox. Khi đến khám, nên cung cấp thời điểm xuất hiện, tiếp xúc gần đây và những thuốc đã dùng; nhân viên y tế sẽ cân nhắc khám và xét nghiệm cần thiết.

![Thông tin về triệu chứng, đường lây và sáu nhóm biện pháp phòng tránh bệnh mpox trên tài liệu truyền thông.](/uploads/articles/a3a3befb4c430ba35dca80646230561d.jpg "Thông tin về triệu chứng, đường lây và sáu nhóm biện pháp phòng tránh bệnh mpox trên tài liệu truyền thông.")

## Chú ý tiếp xúc gần và đồ dùng nhiễm bẩn

Mpox có thể lây qua tiếp xúc gần với người mắc bệnh, vật dụng bị nhiễm hoặc động vật nhiễm bệnh. Người chăm sóc cần tránh chạm trực tiếp vào tổn thương và làm theo hướng dẫn vệ sinh, bảo vệ tại nơi điều trị.

Khi nghi mắc bệnh, hạn chế tiếp xúc gần, không dùng chung khăn, quần áo hoặc đồ giường và chủ động liên hệ cơ sở y tế. Không tự làm vỡ tổn thương hay sử dụng các sản phẩm không rõ thành phần để bôi lên da.

## Chăm sóc cần đi cùng đánh giá nguy cơ

Trẻ nhỏ, phụ nữ mang thai và người suy giảm miễn dịch cần được chú ý khi có nghi ngờ nhiễm bệnh. Nhân viên y tế sẽ hướng dẫn việc chăm sóc, xử lý đồ dùng và theo dõi theo tình trạng từng người.

Các biện pháp dự phòng, bao gồm việc có cần tiêm chủng hay không, phải dựa vào nguy cơ và hướng dẫn y tế đang áp dụng. Không lấy khuyến cáo dành cho một nhóm tiếp xúc để áp dụng cho tất cả mọi người.

## Tôn trọng người bệnh khi trao đổi thông tin

Cung cấp thông tin tiếp xúc cho nhân viên có trách nhiệm và giữ kín những chi tiết cá nhân không cần công khai. Tránh kỳ thị giúp người có triệu chứng dễ tìm chăm sóc và phối hợp phòng bệnh hơn.

Nguồn: [WHO — Mpox](https://www.who.int/news-room/fact-sheets/detail/mpox).',1,'2026-10-09T01:22:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(34,1,'COVID-19: theo dõi triệu chứng và bảo vệ người có nguy cơ','thong-tin-suc-khoe-ve-covid-19','Kiến thức sức khỏe','/uploads/articles/d881bd16e45d49c0c1dae1b5e2e92d2c.jpg','*COVID-19 có thể ảnh hưởng khác nhau tùy tuổi và tình trạng sức khỏe. Theo dõi diễn biến, tìm tư vấn sớm cho người có nguy cơ và hạn chế lây cho người khác vẫn là những việc cần quan tâm.*

## Triệu chứng cần được nhìn cùng tình trạng toàn thân

Ho, sốt, đau họng hoặc mệt có thể gặp trong COVID-19 và nhiều bệnh hô hấp khác. Việc có cần xét nghiệm hay không phụ thuộc tình huống, nguy cơ và đánh giá của nhân viên y tế.

Người cao tuổi, người có bệnh nền hoặc suy giảm miễn dịch cần chú ý hơn khi bắt đầu có triệu chứng. Khi tìm tư vấn, hãy thông báo bệnh đang điều trị và toàn bộ thuốc sử dụng để hỗ trợ lựa chọn chăm sóc.

![Bác sĩ nghe tim phổi trong lúc thăm khám người bệnh tại giường.](/uploads/articles/d881bd16e45d49c0c1dae1b5e2e92d2c.jpg "Bác sĩ nghe tim phổi trong lúc thăm khám người bệnh tại giường.")

## Giảm tiếp xúc khi đang ốm

Ở nhà khi mắc bệnh hô hấp, hạn chế tiếp xúc gần và lựa chọn biện pháp bảo vệ phù hợp khi cần ở cùng người khác. Giữ vệ sinh tay, che miệng khi ho và cải thiện không khí trong không gian chung.

Đặc biệt quan tâm người dễ bệnh nặng trong gia đình. Có thể thống nhất trước cách hỗ trợ ăn uống, liên hệ y tế và những việc ai sẽ đảm nhận nếu một thành viên phải nghỉ ngơi.

## Dấu hiệu không nên chờ theo dõi thêm

Khó thở, đau hoặc tức ngực kéo dài, lú lẫn, khó đánh thức hoặc tình trạng xấu đi nhanh cần được đánh giá khẩn cấp. Đừng chỉ dựa vào việc có sốt hay không để quyết định mức độ nghiêm trọng.

Khi đi khám, mang thông tin xét nghiệm nếu có, ngày bắt đầu triệu chứng và thuốc đã sử dụng. Người bệnh không nên tự dùng kháng sinh hoặc thuốc kháng vi rút theo đơn của người khác.

## Cập nhật hướng dẫn theo thời điểm

Lịch tiêm, dự phòng và cách tổ chức chăm sóc cần theo khuyến cáo hiện hành tại nơi sinh sống và tình trạng từng người. Kiểm tra ngày của tài liệu trước khi áp dụng, vì các quy định trong giai đoạn dịch trước có thể đã thay đổi.

Nguồn: [WHO — COVID-19](https://www.who.int/news-room/fact-sheets/detail/coronavirus-disease-%28covid-19%29), [CDC — phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/index.html).',1,'2026-10-09T01:23:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(35,1,'Thương hàn: chú ý nước uống, thực phẩm và sốt kéo dài','tim-hieu-ve-benh-thuong-han','Kiến thức sức khỏe','/uploads/articles/d5adc9f5cb294f44571b82c7122ab85f.jpg','*Thương hàn lây chủ yếu qua thực phẩm hoặc nước nhiễm vi khuẩn Salmonella Typhi. Bảo đảm vệ sinh ăn uống và đi khám khi sốt kéo dài giúp hạn chế nguy cơ và tránh chậm trễ trong điều trị.*

## Bệnh liên quan đến điều kiện nước và vệ sinh

Người nhiễm có thể đưa vi khuẩn ra môi trường qua phân, làm nhiễm nguồn nước hoặc thức ăn nếu vệ sinh không bảo đảm. Cải thiện nước sạch, nhà vệ sinh và thực hành của người chế biến là những phần việc gắn chặt với phòng bệnh.

Bệnh có thể gây sốt kéo dài, mệt, đau đầu, đau bụng, táo bón hoặc tiêu chảy. Các biểu hiện này cũng gặp ở nhiều bệnh khác, nên cần được khám và xét nghiệm theo chỉ định thay vì tự kết luận từ triệu chứng.

![Các biện pháp phòng thương hàn trên tài liệu truyền thông: giám sát bệnh, nước sạch, vệ sinh và an toàn thực phẩm.](/uploads/articles/d5adc9f5cb294f44571b82c7122ab85f.jpg "Các biện pháp phòng thương hàn trên tài liệu truyền thông: giám sát bệnh, nước sạch, vệ sinh và an toàn thực phẩm.")

## Chú ý những điểm dễ bỏ quên trong bữa ăn

Không chỉ món ăn, đá uống và nước dùng rửa thực phẩm cũng cần có nguồn an toàn. Khi ăn xa nhà, ưu tiên món được nấu chín và phục vụ nóng; thận trọng với thực phẩm sống hoặc sản phẩm từ sữa chưa được xử lý phù hợp.

Rửa tay sau khi đi vệ sinh và trước khi chuẩn bị bữa ăn. Nếu đang được điều trị thương hàn, hỏi bác sĩ về việc chế biến thức ăn cho người khác và những kiểm tra cần thực hiện trước khi trở lại công việc liên quan thực phẩm.

## Điều trị phải theo chỉ định

Thương hàn cần được bác sĩ đánh giá để chọn thuốc phù hợp. Tình trạng kháng kháng sinh làm việc tự mua thuốc càng khó bảo đảm hiệu quả; cần dùng đủ theo chỉ định và tái khám khi được yêu cầu.

Khi đi khám, thông báo thời gian sốt, nơi đã đến, thực phẩm có thể liên quan và các thuốc đã dùng. Giữ thông tin đơn thuốc giúp bác sĩ biết quá trình trước đó nếu cần đánh giá lại.

## Chuẩn bị trước chuyến đi

Nếu đến nơi có nguy cơ, trao đổi trước với cơ sở y tế về phòng bệnh và tiêm chủng phù hợp. Vắc xin là một phần của dự phòng; nước sạch và thực hành ăn uống an toàn vẫn cần được duy trì.

Nguồn: [WHO — Thương hàn](https://www.who.int/news-room/fact-sheets/detail/typhoid).',1,'2026-10-09T01:24:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(36,1,'Phòng bệnh dại: xử lý ngay sau khi bị động vật cắn hoặc cào','tu-lieu-truyen-thong-ve-benh-dai','Kiến thức sức khỏe','/uploads/articles/7789421677ad2f69c8865edf54468e22.jpg','*Sau khi bị động vật cắn, cào hoặc có nước bọt tiếp xúc với da tổn thương, cần xử lý vết thương và đến cơ sở y tế sớm. Không chờ xuất hiện triệu chứng bệnh dại mới tìm chăm sóc.*

## Rửa vết thương ngay khi có thể

Rửa kỹ vết cắn hoặc cào với xà phòng và nước chảy trong ít nhất 15 phút. Sau sơ cứu, đến cơ sở y tế để đánh giá nguy cơ; không đắp lá, bôi các chất không rõ thành phần hoặc trì hoãn để thử phương pháp dân gian.

Ngay cả vết thương nhỏ cũng cần được xem xét theo tình huống tiếp xúc. Nếu nước bọt động vật vào mắt, miệng hoặc vùng da đã trầy xước, cần báo rõ khi được tư vấn.

![Hướng dẫn phòng bệnh dại: tiêm phòng cho vật nuôi, quản lý chó mèo và đến cơ sở y tế sau khi bị cắn.](/uploads/articles/7789421677ad2f69c8865edf54468e22.jpg "Hướng dẫn phòng bệnh dại: tiêm phòng cho vật nuôi, quản lý chó mèo và đến cơ sở y tế sau khi bị cắn.")

## Nhân viên y tế sẽ đánh giá những gì?

Cung cấp thời điểm bị cắn, vị trí vết thương, loài động vật, tình trạng của con vật và lịch tiêm phòng dại trước đây của người bị phơi nhiễm. Nếu không nhớ hoặc không có hồ sơ, nói rõ để được hướng dẫn.

Dự phòng sau phơi nhiễm có thể gồm vắc xin và, trong trường hợp có chỉ định, chế phẩm miễn dịch. Lựa chọn và lịch sử dụng do nhân viên y tế quyết định; không tự chờ theo dõi con vật thay cho việc đến khám.

## Hoàn thành các bước được hướng dẫn

Giữ phiếu hẹn, ghi lại nơi đã tiêm và đến đúng lịch được chỉ định. Nếu bỏ lỡ một mốc, liên hệ cơ sở tiêm để được hướng dẫn tiếp tục, không tự quyết định dừng hoặc tiêm lại toàn bộ.

Khi con vật có thay đổi hoặc không còn theo dõi được, báo cho nhân viên phụ trách. Những thông tin mới cần được đánh giá trong kế hoạch đã lập, thay vì tự diễn giải tại nhà.

## Phòng phơi nhiễm từ việc quản lý vật nuôi

Tiêm phòng dại và quản lý chó, mèo theo hướng dẫn thú y; không để trẻ tự trêu chọc hay tiếp cận động vật lạ. Gia đình nên dạy trẻ báo ngay khi bị cắn hoặc cào, kể cả lúc vết xước có vẻ nhỏ.

Nguồn: [WHO — chăm sóc vết thương và dự phòng sau phơi nhiễm](https://www.who.int/teams/control-of-neglected-tropical-diseases/rabies/vaccinations-and-immunization), [CDC — chăm sóc sau phơi nhiễm bệnh dại](https://www.cdc.gov/rabies/hcp/clinical-care/post-exposure-prophylaxis.html).',1,'2026-10-08T01:25:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(37,1,'Cúm mùa: chủ động phòng ngừa và theo dõi người có nguy cơ','cum-mua-va-thong-tin-can-tim-hieu','Kiến thức sức khỏe','/uploads/articles/c4dbea520a8654fbb3ca3f54bf61440b.jpg','*Cúm mùa có thể khởi phát nhanh với sốt, ho, đau mỏi và mệt. Phòng ngừa từ trước, đồng thời tìm tư vấn sớm cho người có nguy cơ giúp việc chăm sóc không bị chậm trễ.*

## Cúm không chỉ là một cơn cảm lạnh

Cúm là bệnh hô hấp do vi rút influenza. Nhiều người hồi phục sau thời gian nghỉ ngơi và chăm sóc phù hợp, nhưng một số có thể bị biến chứng hoặc bệnh nền nặng lên.

Phụ nữ mang thai, trẻ nhỏ, người cao tuổi, người mắc bệnh mạn tính hoặc suy giảm miễn dịch cần được chú ý. Khi có triệu chứng, nên liên hệ cơ sở y tế sớm để được đánh giá và tư vấn hướng xử trí.

![Đồ họa về cúm mùa trình bày đường lây và những thói quen giúp phòng bệnh trong sinh hoạt.](/uploads/articles/c4dbea520a8654fbb3ca3f54bf61440b.jpg "Đồ họa về cúm mùa trình bày đường lây và những thói quen giúp phòng bệnh trong sinh hoạt.")

## Phòng bệnh trước khi xuất hiện triệu chứng

Tiêm phòng cúm theo khuyến cáo là biện pháp dự phòng quan trọng. Người đi tiêm nên cung cấp tuổi, bệnh nền, tình trạng mang thai và phản ứng từng gặp để được tư vấn phù hợp.

Duy trì vệ sinh tay, che miệng khi ho và cải thiện không khí trong nhà. Khi cần ở nơi đông người hoặc gần người dễ bệnh nặng, có thể bổ sung khẩu trang và hạn chế tiếp xúc gần.

## Theo dõi khi trong nhà có người mắc bệnh

Tạo điều kiện nghỉ ngơi và chú ý khả năng ăn uống, mức tỉnh táo, cách thở. Không dùng một đơn thuốc chung cho mọi thành viên, nhất là khi có trẻ nhỏ hoặc người đang điều trị bệnh khác.

Khó thở, đau ngực, lơ mơ hoặc tình trạng xấu đi sau khi đã có vẻ cải thiện cần được đánh giá kịp thời. Kháng sinh không điều trị vi rút cúm; việc sử dụng thuốc cần theo chỉ định cho tình trạng cụ thể.

![Thăm khám tim phổi giúp bác sĩ đánh giá tình trạng người bệnh khi có biểu hiện hô hấp.](/uploads/articles/d881bd16e45d49c0c1dae1b5e2e92d2c.jpg "Thăm khám tim phổi giúp bác sĩ đánh giá tình trạng người bệnh khi có biểu hiện hô hấp.")

## Chuẩn bị thông tin cho lần khám

Ghi ngày bắt đầu sốt, mức thay đổi của triệu chứng và thuốc đã dùng. Với người đang có bệnh nền, mang theo hồ sơ gần nhất để bác sĩ xem xét kế hoạch chăm sóc trong bối cảnh đầy đủ hơn.

Nguồn: [WHO — cúm mùa](https://www.who.int/news-room/fact-sheets/detail/influenza-%28seasonal%29), [CDC — phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/index.html).',1,'2026-10-08T01:26:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(38,1,'Không khí sạch và vệ sinh: giảm nguy cơ lây bệnh hô hấp','thu-vien-poster-truyen-thong-ve-coronavirus','Kiến thức sức khỏe','/uploads/articles/9ec20652c1431e12861a804f189c4c8f.jpg','*Không khí trong phòng là một phần của phòng bệnh hô hấp. Bên cạnh rửa tay và giữ đồ dùng sạch, cần quan tâm cách đưa không khí ngoài trời vào, giảm nơi bí khí và bảo vệ người có nguy cơ khi phải tiếp xúc gần.*

## Vì sao cần chú ý không gian kín?

Khi nhiều người cùng ở trong một căn phòng, không khí được dùng chung trong suốt thời gian sinh hoạt. Việc lau bề mặt không thay thế được các biện pháp cải thiện không khí và hạn chế tiếp xúc khi có người đang mắc bệnh.

Có thể cân nhắc tăng thông gió tự nhiên khi an toàn và điều kiện bên ngoài phù hợp, bảo trì hệ thống thông khí hoặc dùng thiết bị lọc khí phù hợp với không gian. Mỗi nơi cần lựa chọn cách làm theo điều kiện thực tế.

![Đồ họa về đường lây và phòng bệnh hô hấp qua vệ sinh tay, che miệng khi ho và hạn chế tiếp xúc khi có triệu chứng.](/uploads/articles/9ec20652c1431e12861a804f189c4c8f.jpg "Đồ họa về đường lây và phòng bệnh hô hấp qua vệ sinh tay, che miệng khi ho và hạn chế tiếp xúc khi có triệu chứng.")

## Sắp xếp sinh hoạt để giảm tiếp xúc kéo dài

Nếu có thể, chọn hoạt động ngoài trời hoặc nơi thông thoáng hơn cho các cuộc gặp. Trong nhà, cân nhắc số người, thời gian ở cùng và nhu cầu bảo vệ những người dễ bệnh nặng.

Khi có người ho hoặc sốt, nên điều chỉnh sinh hoạt chung, tạo điều kiện nghỉ ngơi và bổ sung biện pháp bảo vệ khi cần ở gần. Cách sắp xếp đơn giản, dễ làm giúp các thành viên tuân thủ tốt hơn.

## Giữ vệ sinh đi cùng cải thiện không khí

Rửa tay ở những thời điểm cần thiết và làm sạch các bề mặt thường chạm. Xử lý khăn giấy đã dùng, giữ đồ dùng chăm sóc gọn gàng và nhắc nhau che miệng khi ho, hắt hơi.

Không đưa hóa chất vệ sinh vào không khí để tự khử khuẩn nơi có người ở. Dùng sản phẩm đúng hướng dẫn và bảo đảm trẻ nhỏ không tiếp cận được hóa chất hoặc thiết bị đang sử dụng.

## Kiểm tra định kỳ thay vì chờ có người ốm

Gia đình hoặc nơi làm việc có thể ghi lịch vệ sinh, thay bộ lọc và kiểm tra hệ thống theo hướng dẫn nhà sản xuất. Một người phụ trách rõ ràng giúp các công việc bảo trì không bị bỏ sót.

Phòng bệnh là sự phối hợp giữa không gian, thói quen và cách ứng xử khi có triệu chứng. Những điều chỉnh nhỏ được duy trì thường xuyên có giá trị hơn việc chỉ làm đồng loạt trong vài ngày.

Nguồn: [CDC — cải thiện chất lượng không khí để phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/air-quality.html).',1,'2026-10-08T01:27:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07'),
(39,1,'Giao mùa: phân biệt triệu chứng để tìm hướng chăm sóc phù hợp','tim-hieu-cac-chu-de-suc-khoe-khi-giao-mua','Kiến thức sức khỏe','/uploads/articles/622a5a3a812e0bf79bbb7a62bf811a94.jpg','*Khi thời tiết thay đổi, ho, sổ mũi, sốt hoặc phát ban có thể xuất hiện do nhiều nguyên nhân. Đọc đúng triệu chứng và biết giới hạn của việc tự theo dõi giúp gia đình tìm hướng chăm sóc phù hợp.*

## Giao mùa không phải tên một bệnh

Cúm, viêm đường hô hấp, sởi, tay chân miệng và viêm mũi dị ứng có cơ chế khác nhau. Một số bệnh có thể lây, trong khi dị ứng lại cần được đánh giá theo những yếu tố kích phát riêng.

Vì vậy, không nên gọi mọi biểu hiện ho hoặc hắt hơi là cảm do thời tiết. Ghi thời điểm xuất hiện, biểu hiện đi kèm và mức ảnh hưởng sinh hoạt sẽ hữu ích hơn việc tự đặt tên bệnh từ một triệu chứng.

![Năm nhóm bệnh được nhắc trong khuyến cáo giao mùa: cúm, sởi, tay chân miệng, viêm đường hô hấp và viêm mũi dị ứng.](/uploads/articles/622a5a3a812e0bf79bbb7a62bf811a94.jpg "Năm nhóm bệnh được nhắc trong khuyến cáo giao mùa: cúm, sởi, tay chân miệng, viêm đường hô hấp và viêm mũi dị ứng.")

## Quan sát những thay đổi có ý nghĩa

Ở trẻ nhỏ, cần chú ý cách thở, khả năng bú hoặc uống, sự tỉnh táo và mức thay đổi so với bình thường. Ở người có bệnh mạn tính, theo dõi thêm những dấu hiệu đã được bác sĩ dặn từ trước.

Khi xuất hiện khó thở, li bì, co giật hoặc diễn biến nặng nhanh, cần tìm chăm sóc khẩn cấp. Không chờ xem thời tiết ấm lên hoặc nhiệt độ hạ xuống mới quyết định đi khám.

## Chọn biện pháp phòng ngừa đúng hướng

Giữ vệ sinh tay, nhà ở sạch và không khí thông thoáng hỗ trợ phòng các bệnh hô hấp. Kiểm tra lịch tiêm với nhân viên y tế để biết những bệnh nào có vắc xin phù hợp tuổi và tiền sử.

Nếu có biểu hiện gợi ý dị ứng tái diễn, ghi lại hoàn cảnh xuất hiện như tiếp xúc bụi, thay đổi môi trường hoặc thời điểm trong ngày để trao đổi khi đi khám. Không tự dùng cùng một loại thuốc cho cả nhà.

![Bác sĩ trao đổi với gia đình trong buổi khám trẻ nhỏ để ghi nhận triệu chứng và hướng dẫn theo dõi.](/uploads/articles/d15603e6fc1db7baf5c53ee9ac7f0ab3.png "Bác sĩ trao đổi với gia đình trong buổi khám trẻ nhỏ để ghi nhận triệu chứng và hướng dẫn theo dõi.")

## Chuẩn bị cho buổi tư vấn

Mang theo sổ tiêm, hồ sơ bệnh cũ và tên những thuốc đã sử dụng. Một ghi chú ngắn về diễn biến giúp bác sĩ hiểu câu chuyện sức khỏe rõ hơn và hướng dẫn gia đình những việc cần làm tiếp theo.

Nguồn: [CDC — các biện pháp phòng bệnh hô hấp](https://www.cdc.gov/respiratory-viruses/prevention/index.html), [WHO — cúm mùa](https://www.who.int/news-room/fact-sheets/detail/influenza-%28seasonal%29).',1,'2026-10-08T01:28:00+00:00','2026-10-14T16:40:12.227821+00:00','2026-10-15 12:00:00+07');

-- Incremental demo content: fill empty department profiles; never overwrite administrator content.
UPDATE department SET overview='Khoa Nội tổng quát trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực nội tổng quát. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động nội tổng quát với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/aabe2deb72fab7ca6aff745508f1e993.png',
    group_type='CLINICAL',
    specialties='["Nội khoa tổng quát", "Theo dõi bệnh lý mạn tính", "Đánh giá sức khỏe ban đầu"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa nội tổng quát", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực nội tổng quát", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/aabe2deb72fab7ca6aff745508f1e993.png", "caption": "Bác sĩ dùng ống nghe thăm khám cho người bệnh tại phòng khám."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Nội tổng quát và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=1 AND name='Nội tổng quát' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Tim mạch trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực tim mạch. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động tim mạch với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/67c51a87dd71b58d9d3114eb58277565.png',
    group_type='CLINICAL',
    specialties='["Tim mạch nội khoa", "Đánh giá yếu tố nguy cơ tim mạch", "Theo dõi sức khỏe tim mạch"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa tim mạch", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực tim mạch", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/67c51a87dd71b58d9d3114eb58277565.png", "caption": "Bác sĩ trao đổi với người bệnh tại phòng khám tim mạch."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Tim mạch và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=2 AND name='Tim mạch' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Da liễu trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực da liễu. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động da liễu với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/492696ff3a0f21110b55b9b927cf4b7c.png',
    group_type='CLINICAL',
    specialties='["Da, tóc và móng", "Tư vấn chăm sóc da", "Theo dõi bệnh lý da liễu"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa da liễu", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực da liễu", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/492696ff3a0f21110b55b9b927cf4b7c.png", "caption": "Bác sĩ tư vấn và trao đổi với người bệnh tại phòng khám da liễu."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Da liễu và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=3 AND name='Da liễu' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Nhi trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực nhi. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động nhi với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/d15603e6fc1db7baf5c53ee9ac7f0ab3.png',
    group_type='CLINICAL',
    specialties='["Nhi khoa tổng quát", "Theo dõi sự phát triển của trẻ", "Tư vấn chăm sóc sức khỏe trẻ em"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa nhi", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực nhi", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị thông tin của trẻ và thông tin liên hệ của người đưa trẻ tới khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/d15603e6fc1db7baf5c53ee9ac7f0ab3.png", "caption": "Bác sĩ khám và trao đổi với gia đình của trẻ tại phòng khám nhi."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Nhi và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=4 AND name='Nhi' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Sản phụ khoa trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực sản phụ khoa. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động sản phụ khoa với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/fbbb1896f60a71a08cafaf9da711ea77.png',
    group_type='CLINICAL',
    specialties='["Sức khỏe phụ nữ", "Sản khoa", "Theo dõi và tư vấn phụ khoa"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa sản phụ khoa", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực sản phụ khoa", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/fbbb1896f60a71a08cafaf9da711ea77.png", "caption": "Bác sĩ tư vấn cho người bệnh tại phòng khám sản phụ khoa."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Sản phụ khoa và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=5 AND name='Sản phụ khoa' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Tai Mũi Họng trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực tai mũi họng. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động tai mũi họng với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/c84700e9069445ee64382f87ac4fbf40.png',
    group_type='CLINICAL',
    specialties='["Tai và thính lực", "Mũi xoang", "Họng và thanh quản"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa tai mũi họng", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực tai mũi họng", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/c84700e9069445ee64382f87ac4fbf40.png", "caption": "Bác sĩ thăm khám vùng mũi bằng dụng cụ chuyên khoa tai mũi họng."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Tai Mũi Họng và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=6 AND name='Tai Mũi Họng' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Mắt trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực mắt. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động mắt với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/36d4acc110bbe26e4c5e79f55c73c3e6.png',
    group_type='CLINICAL',
    specialties='["Nhãn khoa", "Thị lực và tật khúc xạ", "Theo dõi sức khỏe mắt"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa mắt", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực mắt", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/36d4acc110bbe26e4c5e79f55c73c3e6.png", "caption": "Bác sĩ kiểm tra mắt bằng đèn khe tại phòng khám mắt."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Mắt và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=7 AND name='Mắt' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Răng Hàm Mặt trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực răng hàm mặt. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động răng hàm mặt với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/805b59568eab391ba78c3ea6a571c27f.png',
    group_type='CLINICAL',
    specialties='["Răng và nha chu", "Sức khỏe răng miệng", "Răng hàm mặt"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa răng hàm mặt", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Ghế và thiết bị thăm khám nha khoa — nội dung minh họa", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực răng hàm mặt", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/805b59568eab391ba78c3ea6a571c27f.png", "caption": "Bác sĩ thăm khám vùng miệng và trao đổi với người bệnh tại phòng khám răng hàm mặt."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Răng Hàm Mặt và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=8 AND name='Răng Hàm Mặt' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Cơ Xương Khớp trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực cơ xương khớp. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động cơ xương khớp với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/0fd09b29e6d5e634589b0655346eaeb2.png',
    group_type='CLINICAL',
    specialties='["Cơ, xương và khớp", "Đánh giá chức năng vận động", "Theo dõi sức khỏe cơ xương khớp"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa cơ xương khớp", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Trang thiết bị phục vụ thăm khám theo nhu cầu chuyên môn", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực cơ xương khớp", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/0fd09b29e6d5e634589b0655346eaeb2.png", "caption": "Bác sĩ sử dụng mô hình cột sống khi tư vấn cho người bệnh."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Cơ Xương Khớp và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=9 AND name='Cơ Xương Khớp' AND (overview IS NULL OR trim(overview)='');

UPDATE department SET overview='Khoa Thần kinh trong mô hình NEU Medical tập trung vào khám, tư vấn và theo dõi sức khỏe trong lĩnh vực thần kinh. Đội ngũ bác sĩ phối hợp với điều dưỡng để tiếp nhận thông tin, đánh giá nhu cầu khám và hướng dẫn các bước tiếp theo.

Người bệnh có thể tìm hiểu đội ngũ chuyên môn, xem hồ sơ bác sĩ và lựa chọn lịch khám phù hợp ngay trên website. Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án.',
    mission='Phát triển hoạt động thần kinh với tinh thần tận tâm, trao đổi rõ ràng và phối hợp chuyên môn; hướng đến trải nghiệm khám thuận tiện cho người bệnh và gia đình.',
    cover_image_url='/uploads/articles/549016195c3bb4a48a0f3a608a842141.png',
    group_type='CLINICAL',
    specialties='["Thần kinh nội khoa", "Đánh giá triệu chứng thần kinh", "Theo dõi và tư vấn chuyên khoa"]'::jsonb,
    clinical_services='["Khám và tư vấn chuyên khoa thần kinh", "Trao đổi kết quả khám và thông tin cận lâm sàng theo chỉ định", "Hướng dẫn theo dõi và tái khám theo kế hoạch của bác sĩ"]'::jsonb,
    equipment='["Không gian tiếp đón và phòng khám chuyên khoa", "Hình ảnh minh họa thiết bị chẩn đoán hình ảnh", "Hệ thống hỗ trợ tra cứu thông tin và đăng ký lịch khám"]'::jsonb,
    achievements='["Xây dựng chương trình bồi dưỡng chuyên môn trong lĩnh vực thần kinh", "Phát triển sáng kiến cải thiện hướng dẫn và tiếp đón người bệnh", "Tổ chức các buổi sinh hoạt chuyên môn giữa bác sĩ và điều dưỡng"]'::jsonb,
    patient_guide='["Chuẩn bị giấy tờ và thông tin của người được khám.", "Mang theo kết quả khám trước đây và thông tin thuốc đang sử dụng nếu có.", "Kiểm tra lại bác sĩ, ngày và khung giờ trước khi xác nhận lịch khám.", "Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn."]'::jsonb,
    gallery='[{"url": "/uploads/articles/549016195c3bb4a48a0f3a608a842141.png", "caption": "Bác sĩ giải thích hình ảnh chụp não trên màn hình cho người bệnh."}, {"url": "/uploads/articles/e46b7bb59a7b5fe5063a0303e25a2038.jpg", "caption": "Dãy ghế chờ được bố trí dọc hành lang bên ngoài các phòng khám."}]'::jsonb,
    extra_sections='[{"title": "Phối hợp chăm sóc người bệnh", "content": "Bác sĩ khoa Thần kinh và điều dưỡng phối hợp tiếp nhận thông tin, hỗ trợ người đi khám và trao đổi với các chuyên khoa khác khi cần. Bạn có thể liên hệ bộ phận hỗ trợ để được hướng dẫn lựa chọn khoa."}]'::jsonb,
    content_is_demo=1,
    version=version+1,
    updated_at=CURRENT_TIMESTAMP WHERE department_id=10 AND name='Thần kinh' AND (overview IS NULL OR trim(overview)='');

-- Initial leadership only for departments with no previous appointment history.
WITH assignments(department_id,doctor_profile_id,position) AS (VALUES
 (1,1,'HEAD'),(2,2,'HEAD'),(3,3,'HEAD'),(4,4,'HEAD'),(5,5,'HEAD'),
 (6,6,'HEAD'),(7,7,'HEAD'),(8,8,'HEAD'),(9,9,'HEAD'),(10,10,'HEAD'),
 (1,11,'DEPUTY'),(2,12,'DEPUTY'),(6,13,'DEPUTY'),(9,14,'DEPUTY')
), actor AS (SELECT u.user_id FROM users u JOIN role r USING(role_id) WHERE r.role_name='ADMIN' AND u.deleted_at IS NULL AND u.account_status='ACTIVE' ORDER BY u.user_id LIMIT 1)
INSERT INTO department_leadership(department_id,doctor_profile_id,position,appointed_by_id)
SELECT a.department_id,a.doctor_profile_id,a.position,actor.user_id FROM assignments a
JOIN doctor_profile d ON d.doctor_profile_id=a.doctor_profile_id AND d.department_id=a.department_id
JOIN users u ON u.user_id=d.user_id JOIN role r ON r.role_id=u.role_id CROSS JOIN actor
WHERE d.is_active=1 AND u.deleted_at IS NULL AND u.approval_status='APPROVED' AND u.account_status='ACTIVE' AND r.role_name='DOCTOR'
AND NOT EXISTS(SELECT 1 FROM department_leadership l WHERE l.department_id=a.department_id)
ON CONFLICT DO NOTHING;

-- Đồng bộ sequence sau khi seed ID thủ công để lần INSERT tiếp theo không bị trùng khóa chính.
SELECT setval(pg_get_serial_sequence('role', 'role_id'), (SELECT MAX(role_id) FROM role), true);
SELECT setval(pg_get_serial_sequence('users', 'user_id'), (SELECT MAX(user_id) FROM users), true);
SELECT setval(pg_get_serial_sequence('auth_token', 'token_id'), (SELECT MAX(token_id) FROM auth_token), true);
SELECT setval(pg_get_serial_sequence('patient', 'patient_id'), (SELECT MAX(patient_id) FROM patient), true);
SELECT setval(pg_get_serial_sequence('department', 'department_id'), (SELECT MAX(department_id) FROM department), true);
SELECT setval(pg_get_serial_sequence('doctor_profile', 'doctor_profile_id'), (SELECT MAX(doctor_profile_id) FROM doctor_profile), true);
SELECT setval(pg_get_serial_sequence('room', 'room_id'), (SELECT MAX(room_id) FROM room), true);
SELECT setval(pg_get_serial_sequence('work_schedule', 'schedule_id'), (SELECT MAX(schedule_id) FROM work_schedule), true);
SELECT setval(pg_get_serial_sequence('encounter', 'encounter_id'), (SELECT MAX(encounter_id) FROM encounter), true);
SELECT setval(pg_get_serial_sequence('encounter_status_log', 'log_id'), (SELECT MAX(log_id) FROM encounter_status_log), true);
SELECT setval(pg_get_serial_sequence('encounter_transfer_log', 'log_id'), (SELECT MAX(log_id) FROM encounter_transfer_log), true);
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
UNION ALL SELECT 'patient_delegate', COUNT(*) FROM patient_delegate
UNION ALL SELECT 'department', COUNT(*) FROM department
UNION ALL SELECT 'department_leadership', COUNT(*) FROM department_leadership
UNION ALL SELECT 'doctor_profile', COUNT(*) FROM doctor_profile
UNION ALL SELECT 'room', COUNT(*) FROM room
UNION ALL SELECT 'work_schedule', COUNT(*) FROM work_schedule
UNION ALL SELECT 'encounter', COUNT(*) FROM encounter
UNION ALL SELECT 'encounter_status_log', COUNT(*) FROM encounter_status_log
UNION ALL SELECT 'encounter_transfer_log', COUNT(*) FROM encounter_transfer_log
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

