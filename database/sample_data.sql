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
(1, 6, 1, 'Thạc sĩ', 'Nội khoa', 12, 'Bác sĩ chuyên khám nội tổng quát.', 250000, '/uploads/avatars/966fa3079f664b08b1c977ccb6915d3a.jpg', 1, '2026-09-04 08:00:00+07', '2026-09-04 08:00:00+07'),
(2, 7, 2, 'Tiến sĩ', 'Tim mạch', 15, 'Bác sĩ chuyên khoa tim mạch.', 350000, '/uploads/avatars/260d30cd4d96400f9023e7fd71af8382.jpg', 1, '2026-09-04 08:10:00+07', '2026-09-04 08:10:00+07'),
(3, 8, 3, 'Chuyên khoa I', 'Da liễu', 9, 'Bác sĩ chuyên điều trị bệnh da.', 280000, '/uploads/avatars/8de4ec4fc6554aa3bddb589395ab2e1b.jpg', 1, '2026-09-04 08:20:00+07', '2026-09-04 08:20:00+07'),
(4, 9, 4, 'Thạc sĩ', 'Nhi khoa', 11, 'Bác sĩ chuyên khám và điều trị trẻ em.', 300000, '/uploads/avatars/6b172a558f0648a5b9786daed64bcec4.jpg', 1, '2026-09-04 08:30:00+07', '2026-09-04 08:30:00+07'),
(5, 10, 5, 'Chuyên khoa II', 'Sản phụ khoa', 14, 'Bác sĩ chuyên sản phụ khoa.', 380000, '/uploads/avatars/a93fef9e21064a9ba42a14f147b181dd.jpg', 1, '2026-09-04 08:40:00+07', '2026-09-04 08:40:00+07'),
(6, 11, 6, 'Thạc sĩ', 'Tai Mũi Họng', 10, 'Bác sĩ chuyên tai mũi họng.', 270000, '/uploads/avatars/f234bc8cf1aa43cfb57cac0978fb6905.jpg', 1, '2026-09-04 08:50:00+07', '2026-09-04 08:50:00+07'),
(7, 12, 7, 'Chuyên khoa I', 'Nhãn khoa', 8, 'Bác sĩ chuyên khám và điều trị mắt.', 260000, '/uploads/avatars/932e24ee2e0949ccbf1247748057a403.jpg', 1, '2026-09-04 09:00:00+07', '2026-09-04 09:00:00+07'),
(8, 13, 8, 'Thạc sĩ', 'Răng Hàm Mặt', 13, 'Bác sĩ chuyên răng hàm mặt.', 320000, '/uploads/avatars/5ea9f58dc38049afa23aeddf8251adce.jpg', 1, '2026-09-04 09:10:00+07', '2026-09-04 09:10:00+07'),
(9, 14, 9, 'Tiến sĩ', 'Cơ Xương Khớp', 16, 'Bác sĩ chuyên cơ xương khớp.', 360000, '/uploads/avatars/36ea98ff447b4c7ea4e242a3df829f41.jpg', 1, '2026-09-04 09:20:00+07', '2026-09-04 09:20:00+07'),
(10, 15, 10, 'Chuyên khoa II', 'Thần kinh', 17, 'Bác sĩ chuyên thần kinh.', 400000, '/uploads/avatars/eeffdcdd8a30437fbb64e429d83aa1ad.jpg', 1, '2026-09-04 09:30:00+07', '2026-09-04 09:30:00+07');

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
-- 10 bài biên soạn từ nguồn Bệnh viện Bạch Mai; ảnh demo lưu tại backend/uploads.
-- Tài khoản ADMIN #1 đăng các bài; nguồn gốc nội dung ghi ở cuối từng bài.
INSERT INTO article
(article_id, author_id, title, slug, category, thumbnail_url, content, is_active, published_at, created_at, updated_at)
VALUES
(1, 1, 'RSV và cúm mùa ở trẻ: Quan sát hô hấp để nhận biết diễn biến bất thường', 'benh-ho-hap-o-tre-rsv-va-cum-mua', 'Y học thường thức', '/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg', $article$*Trẻ mắc bệnh hô hấp có thể bắt đầu bằng triệu chứng nhẹ nhưng cần được theo dõi diễn biến. Chuyên gia nhi khoa Bạch Mai lưu ý rằng cách thở, khả năng bú hoặc uống và mức độ tỉnh táo có ý nghĩa quan trọng bên cạnh nhiệt độ cơ thể.*

## Vì sao trẻ nhỏ cần được quan sát sát hơn

Đường thở của trẻ nhỏ có kích thước hẹp. Phù nề và tăng tiết dịch có thể ảnh hưởng rõ đến việc lưu thông không khí, đặc biệt khi trẻ có viêm ở những đường thở nhỏ.

Nguồn tin lưu ý trẻ sơ sinh, trẻ nhỏ, trẻ sinh non và trẻ có bệnh nền là những nhóm cần thận trọng. Những biểu hiện ban đầu có thể chưa phản ánh đầy đủ mức độ nặng, nên việc theo dõi phải tiếp tục khi tình trạng thay đổi.

Đi khám đúng thời điểm giúp bác sĩ đánh giá cả dấu hiệu hô hấp lẫn tình trạng toàn thân. Phụ huynh nên ghi nhận những thay đổi quan sát được để trao đổi rõ trong quá trình chăm sóc.

![Không gian khám bệnh](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Không gian phục vụ khám và tư vấn — ảnh minh họa demo")

## RSV và cúm có những biểu hiện khác nhau

RSV có thể gây biểu hiện giống cảm lạnh, sau đó một số trẻ xuất hiện khò khè, thở nhanh hoặc khó bú. Bài nguồn nhắc vai trò của RSV trong viêm tiểu phế quản và viêm phổi ở trẻ nhỏ.

Cúm mùa thường có khởi phát đột ngột hơn với sốt, ho và mệt mỏi; trẻ nhỏ cũng có thể có những biểu hiện tiêu hóa hoặc giảm ăn, giảm bú. Cả hai tác nhân đều có thể đi kèm biến chứng hô hấp.

Không thể xác định tác nhân chỉ từ một triệu chứng. Điều cần làm là quan sát diễn biến và tìm đánh giá y tế phù hợp, tránh coi sốt ít đồng nghĩa bệnh nhẹ hoặc tự chọn thuốc theo tên virus phỏng đoán.

## Những dấu hiệu cần đưa trẻ đi đánh giá ngay

Cách thở là một dấu hiệu quan trọng. Thở nhanh, rút lõm lồng ngực, cánh mũi phập phồng hoặc mức gắng sức tăng cần được chú ý, đặc biệt khi thay đổi so với trạng thái thường ngày.

Những biểu hiện được nguồn tin lưu ý gồm:

- Khó thở rõ hoặc cách thở tăng gắng sức.
- Môi, lưỡi hoặc da chuyển màu tím.
- Li bì, khó đánh thức hay đáp ứng kém.
- Bỏ bú, không uống được hoặc có biểu hiện mất nước.
- Khoảng ngừng thở, co giật hoặc tình trạng xấu đi nhanh.

Đây là những tình huống cần được đánh giá trực tiếp tại cơ sở y tế. Bác sĩ sẽ kết hợp nhiều thông tin, bao gồm hô hấp, oxy máu, khả năng ăn uống và mức độ tỉnh táo, thay vì dựa vào một chỉ số đơn lẻ.

![Khu vực tiếp đón gia đình](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Khu vực tiếp đón và hướng dẫn gia đình người bệnh — ảnh minh họa demo")

## Phòng bệnh theo tuổi và nguy cơ

Bài nguồn đề cập tiêm phòng cúm theo khuyến cáo cùng các biện pháp dự phòng RSV dành cho những nhóm có chỉ định. Việc lựa chọn biện pháp cần trao đổi với bác sĩ, căn cứ tuổi, sức khỏe và khả năng tiếp cận phù hợp.

Rửa tay, hạn chế tiếp xúc với người đang mắc bệnh hô hấp, giữ môi trường thông thoáng và tránh khói thuốc là những thực hành cần duy trì trong sinh hoạt. Chúng cần đi cùng việc quan sát và tìm chăm sóc khi có biểu hiện bất thường.

Kháng sinh không điều trị được virus RSV hay cúm. Phụ huynh không nên tự cho trẻ dùng thuốc này; quyết định sử dụng phải do bác sĩ cân nhắc khi có tình huống cần điều trị nhiễm khuẩn.

Thông điệp của bài là theo dõi trẻ bằng nhiều dấu hiệu và chủ động phòng ngừa. Khi có thay đổi về cách thở hoặc tình trạng toàn thân, việc đưa trẻ đi đánh giá quan trọng hơn việc tiếp tục chờ xem nhiệt độ có tăng hay không.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/canh-bao-benh-ho-hap-giao-mua-o-tre-nhan-biet-som-rsv-cum-mua-va-dau-hieu-nguy-hiem?id=6c0af8f9-86ae-4ca7-acf8-f7598fc504b0). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07'),
(2, 1, 'Theo dõi ung thư gan: Vì sao cần phối hợp nhiều thông tin?', 'theo-doi-nguy-co-ung-thu-gan', 'Y học thường thức', '/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg', $article$*Bài viết của Bạch Mai đề cập giới hạn của từng công cụ theo dõi ung thư gan và vai trò của việc kết hợp thông tin. Với người có bệnh gan mạn tính, một kết quả kiểm tra riêng lẻ cần được hiểu trong bối cảnh nguy cơ và kế hoạch theo dõi của bác sĩ.*

## Kết quả thông thường vẫn có giới hạn

Siêu âm và xét nghiệm AFP là những phương pháp quen thuộc khi kiểm tra gan. Tuy nhiên, nguồn tin lưu ý rằng ở giai đoạn sớm, một số tổn thương có thể chưa được nhận diện bằng cách đánh giá đơn lẻ.

AFP bình thường cũng không đủ để khẳng định chắc chắn không có ung thư gan. Cách diễn giải phải đi cùng tình trạng người bệnh, tiền sử và những kết quả khác.

Điều này không có nghĩa các công cụ quen thuộc mất giá trị. Ý nghĩa của thông tin là hiểu giới hạn và tiếp tục theo dõi phù hợp, tránh coi một kết quả trước đây như bảo đảm cho mọi thời điểm sau đó.

![Không gian khám bệnh](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Không gian phục vụ đánh giá sức khỏe — ảnh minh họa demo")

## Các xét nghiệm bổ sung cung cấp thêm thông tin

Bài nguồn đề cập PIVKA-II như một xét nghiệm có thể bổ sung thông tin cho đánh giá. Nguồn cũng giới thiệu GAAD, phương pháp kết hợp tuổi, giới tính cùng kết quả AFP và PIVKA-II để ước tính mức nguy cơ.

Đây là những dữ kiện hỗ trợ quyết định chuyên môn, không phải cách tự kết luận chẩn đoán từ một con số. Việc có sử dụng xét nghiệm nào và sử dụng khi nào phải gắn với tình trạng cụ thể.

Các công cụ bổ sung không thay thế hoàn toàn siêu âm hay chẩn đoán hình ảnh. Nếu có bất thường hoặc mức nguy cơ cần xem xét thêm, bác sĩ có thể lựa chọn CT, MRI hoặc những đánh giá phù hợp khác.

## Ai cần có kế hoạch theo dõi riêng

Những nhóm được nguồn tin lưu ý gồm người viêm gan B hoặc C mạn tính, người xơ gan và một số người có bệnh gan nhiễm mỡ kèm yếu tố nguy cơ. Không phải mọi người có cùng nhu cầu xét nghiệm và khoảng cách giữa các lần kiểm tra.

Người có nguy cơ cao cần tuân thủ lịch đã được hướng dẫn. Thời điểm đánh giá lại có thể thay đổi theo tình trạng bệnh, các bất thường đã phát hiện và kế hoạch điều trị.

Theo dõi đều đặn không chỉ là thực hiện xét nghiệm, mà còn là mang kết quả đến bác sĩ để so sánh và quyết định các bước tiếp theo. Các kết quả từ nhiều lần khám có thể cung cấp bối cảnh quan trọng.

![Khu vực tiếp đón](/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg "Khu vực tiếp đón người bệnh — ảnh minh họa demo")

## Chuẩn bị thông tin cho lần tái khám

- Mang kết quả siêu âm, xét nghiệm và chẩn đoán hình ảnh trước đó.
- Thông báo bệnh gan đã được chẩn đoán và việc điều trị đang thực hiện.
- Ghi nhận những thay đổi sức khỏe từ lần khám gần nhất.
- Hỏi rõ lịch theo dõi và mục đích của từng xét nghiệm được đề xuất.
- Báo cho bác sĩ khi chưa thể thực hiện đúng kế hoạch để được hướng dẫn.

Bài nguồn nhắc rằng bệnh gan có thể diễn tiến mà không có triệu chứng rõ. Người có bệnh mạn tính nên theo dõi theo kế hoạch, không chờ đến lúc xuất hiện vàng da, sụt cân hay đau mới tìm đến chăm sóc.

Mục tiêu là phối hợp thông tin để nhận diện nguy cơ và lựa chọn bước đánh giá phù hợp. Không nên suy diễn độ chính xác của một phương pháp thành bảo đảm tuyệt đối cho mỗi người bệnh.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/lam-sao-de-khong-bo-sot-ung-thu-gan-khi-benh-con-am-tham?id=4febab14-1abb-4e05-8e15-3fcdc168dbb6). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07'),
(3, 1, 'Men vi sinh trong bệnh tiêu hóa: Lợi ích cần được đánh giá theo từng chủng', 'su-dung-men-vi-sinh-theo-bang-chung', 'Y học thường thức', '/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg', $article$*Tại một hội thảo của Viện Tiêu hóa Bạch Mai, các chuyên gia lưu ý rằng probiotics không phải lựa chọn chung cho mọi triệu chứng đường ruột. Bệnh lý, chủng vi sinh vật và tình trạng người bệnh cần được xem xét trước khi quyết định sử dụng.*

## Hiệu quả không thể suy rộng từ một chủng sang mọi sản phẩm

Probiotics là các vi sinh vật sống được sử dụng trong những tình huống phù hợp. Điểm quan trọng được bài báo nhấn mạnh là tính đặc hiệu: bằng chứng về một chủng trong một bệnh cảnh không đồng nghĩa tất cả chế phẩm có tác dụng tương tự.

Người có đau bụng, tiêu chảy hoặc táo bón cần tìm nguyên nhân, thay vì mặc nhiên chọn men vi sinh. Dùng không phù hợp có thể làm tăng chi phí mà không đem lại lợi ích dự kiến.

Khi trao đổi về một sản phẩm, cần quan tâm thành phần cụ thể, dữ liệu khoa học và mục đích sử dụng. Giá cao hoặc số lượng chủng lớn không phải cách đủ tin cậy để so sánh hiệu quả.

![Không gian thăm khám](/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg "Không gian phục vụ thăm khám tiêu hóa — ảnh minh họa demo")

## Trong điều trị H. pylori, vai trò là hỗ trợ

Phác đồ tiệt trừ *Helicobacter pylori* thường phối hợp nhiều thuốc. Bài nguồn đề cập một số nghiên cứu về probiotics trong hỗ trợ giảm tác dụng không mong muốn hoặc cải thiện việc tuân thủ, nhưng đồng thời lưu ý bằng chứng và hiệu quả khác nhau giữa các chủng.

Men vi sinh không thể thay thế phác đồ điều trị H. pylori. Khi đã được kê thuốc, người bệnh không nên tự bỏ kháng sinh hoặc dùng probiotics như một phương án tiệt trừ độc lập.

Nếu bác sĩ chỉ định bổ sung, cách chọn chế phẩm, thời điểm dùng và khoảng thời gian cần được hướng dẫn cụ thể. Những thông tin này có ý nghĩa hơn việc lựa chọn theo lời quảng cáo chung.

## Hội chứng ruột kích thích cần đánh giá từng trường hợp

IBS là rối loạn tương tác não và ruột, có thể biểu hiện bằng đau bụng tái diễn cùng thay đổi việc đi ngoài. Các thể tiêu chảy, táo bón hay hỗn hợp không có cùng nhu cầu chăm sóc.

Bài báo ghi nhận nghiên cứu về một số chủng ở các nhóm người bệnh, nhưng không khẳng định một chế phẩm dùng được cho tất cả. Những yếu tố tâm lý, căng thẳng và tình trạng dinh dưỡng cũng cần được cân nhắc trong kế hoạch điều trị.

Việc lựa chọn biện pháp hỗ trợ nên căn cứ vào triệu chứng và đánh giá chuyên môn, không chỉ vào nhãn sản phẩm. Khi triệu chứng kéo dài hoặc thay đổi, người bệnh cần được đánh giá lại nguyên nhân.

![Khu vực tư vấn](/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg "Khu vực tiếp đón và tư vấn người bệnh — ảnh minh họa demo")

## Những nhóm cần hỏi ý kiến bác sĩ

Trẻ nhỏ, người suy giảm miễn dịch, người bệnh nặng hoặc đang hồi sức cần được xem xét riêng trước khi dùng probiotics. Dù một số biến cố ít gặp, việc sử dụng vi sinh vật sống vẫn đòi hỏi cân nhắc tình trạng toàn thân.

Những câu hỏi có thể đặt ra trong buổi tư vấn:

- Sản phẩm có cần thiết đối với bệnh đang được điều trị hay không.
- Chủng cụ thể nào có dữ liệu phù hợp.
- Lợi ích dự kiến và những điểm cần theo dõi.
- Thời gian sử dụng và khi nào cần đánh giá lại.
- Có những lựa chọn chăm sóc khác phù hợp hơn hay không.

Thông điệp của nguồn là lựa chọn dựa trên bằng chứng và đối tượng sử dụng. Men vi sinh có thể hữu ích ở một số tình huống, nhưng không phải cách mặc định xử trí mọi rối loạn tiêu hóa.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/chuyen-gia-bach-mai-chi-cach-dung-men-vi-sinh-dung-benh-dung-nguoi?id=f18e2bb0-46cf-44aa-981b-0de94a01d565). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07', '2026-10-02 00:00:00+07'),
(4, 1, 'Vệ sinh tay và sức khỏe mắt: Bài học từ một ca viêm loét giác mạc', 'bao-ve-mat-bang-ve-sinh-tay', 'Y học thường thức', '/uploads/articles/aa415242679740d7b2684416036beb63.jpg', $article$*Một người bệnh nữ 63 tuổi được Bạch Mai cơ sở Ninh Bình tiếp nhận vì đau mắt và suy giảm thị lực. Khi tìm hiểu công việc và thói quen sinh hoạt, bác sĩ lưu ý khả năng đưa tác nhân gây bệnh từ bàn tay lên mắt, đặc biệt khi móng tay và kẽ móng chưa được vệ sinh kỹ.*

## Không bỏ qua thói quen khi tìm nguyên nhân

Người bệnh được chẩn đoán viêm loét giác mạc do nấm sau những đợt điều trị trước đó chưa cải thiện tình trạng. Khi khai thác thêm thông tin, nhóm chuyên môn ghi nhận công việc ở một cơ sở chế biến mắm thủ công và thói quen dụi mắt bằng tay.

Bàn tay thường xuyên tiếp xúc chất hữu cơ, bụi bẩn hoặc nhiều bề mặt có thể mang các vi sinh vật. Móng tay dài và phần bẩn còn lưu ở kẽ móng là những yếu tố cần chú ý trong vệ sinh cá nhân.

Những chi tiết sinh hoạt tưởng nhỏ lại có giá trị khi bác sĩ đánh giá nguồn tiếp xúc. Điều này cũng cho thấy đi khám cần trao đổi về công việc và thói quen hằng ngày, không chỉ mô tả triệu chứng hiện tại.

![Không gian khám bệnh](/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg "Không gian phục vụ thăm khám — ảnh minh họa demo")

## Vì sao dụi mắt có thể làm tăng nguy cơ

Khi tay chưa sạch chạm vào vùng mắt, tác nhân gây bệnh có cơ hội tiếp xúc với bề mặt nhãn cầu. Động tác dụi mạnh hoặc móng tay dài cũng có thể tạo ra tổn thương trên những cấu trúc nhạy cảm.

Các tổn thương ở giác mạc cần được đánh giá chuyên khoa. Nhiễm trùng tại đây có thể ảnh hưởng đến thị lực và để lại hậu quả, nên việc điều trị không nên chỉ dựa vào kinh nghiệm từ một lần đau mắt trước đó.

Bài nguồn nhắc rằng vi sinh vật còn có thể được đưa lên mắt khi lau mồ hôi, nhỏ thuốc hoặc xử lý kính áp tròng bằng tay chưa được vệ sinh. Những thao tác này cần được thực hiện với bàn tay sạch.

## Những thay đổi ở mắt cần được thăm khám

Đau, đỏ mắt, cộm, chảy nước mắt, khó chịu với ánh sáng hoặc giảm khả năng nhìn là những thông tin cần cung cấp khi đi khám. Đặc biệt, thị lực thay đổi hoặc đau tăng là lý do không nên trì hoãn đánh giá.

Không nên tự kéo dài việc dùng thuốc nhỏ mắt khi chưa xác định nguyên nhân. Việc nhiều thuốc đã được thử nhưng tình trạng tiếp tục nặng lên cần được báo rõ cho bác sĩ, kèm tên thuốc và thời gian sử dụng nếu nhớ được.

Khám chuyên khoa giúp phân biệt các nguyên nhân và lựa chọn điều trị phù hợp. Một thói quen vệ sinh tốt có giá trị phòng ngừa, nhưng không thay thế việc xử trí một tổn thương đã xảy ra.

![Khu vực tiếp đón](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Khu vực tiếp đón và hướng dẫn khám — ảnh minh họa demo")

## Bắt đầu từ những việc hằng ngày

- Rửa tay với xà phòng và làm sạch kẽ ngón, đầu ngón, quanh móng.
- Giữ móng tay ngắn và sạch, nhất là sau công việc tiếp xúc đất, bụi hoặc chất hữu cơ.
- Tránh đưa tay chưa sạch lên mắt.
- Vệ sinh và lau khô tay trước khi nhỏ thuốc hay xử lý kính áp tròng.
- Đi khám khi có biểu hiện bất thường thay vì liên tục tự đổi thuốc.

Ca bệnh không nhằm quy mọi tình trạng đau mắt về một nguyên nhân duy nhất. Thông điệp là chú ý đường tiếp xúc và tìm đánh giá chuyên môn khi triệu chứng xuất hiện, đặc biệt lúc khả năng nhìn bị ảnh hưởng.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/dui-mat-bang-tay-ban-nguoi-phu-nu-63-tuoi-suyt-mat-thi-luc?id=aa3652dd-b552-448a-9d0a-2d7611ea6408). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-05 00:00:00+07', '2026-10-05 00:00:00+07', '2026-10-05 00:00:00+07'),
(5, 1, 'Chăm sóc trẻ sơ sinh khi tắm: An toàn nằm trong từng thao tác', 'cham-soc-tre-so-sinh-khi-tam', 'Y học thường thức', '/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg', $article$*Bài viết từ Khoa Phụ sản Bạch Mai nhìn việc tắm trẻ sơ sinh như một quy trình chăm sóc có nhiều bước liên kết. Chuẩn bị, nhận diện đúng trẻ, nâng đỡ an toàn, giữ ấm và bàn giao đều quan trọng đối với sức khỏe trong những ngày đầu đời.*

## Chuẩn bị trước khi bắt đầu chăm sóc

Trong môi trường bệnh viện, bước nhận diện mẹ và con cần được thực hiện trước khi đưa trẻ đi tắm. Vòng định danh và những thông tin bàn giao giúp nhân viên y tế xác nhận đúng trẻ cần được chăm sóc.

Khăn, quần áo, tã và dụng cụ nên được chuẩn bị đầy đủ để quá trình chăm sóc diễn ra liên tục. Nhiệt độ nước cần được kiểm tra, còn phòng tắm phải bảo đảm điều kiện ấm và hạn chế gió lùa.

Ý nghĩa của việc chuẩn bị không chỉ là thuận tiện cho người thực hiện. Khi mọi dụng cụ đã ở vị trí cần thiết, nhân viên có thể tập trung theo dõi trẻ thay vì gián đoạn thao tác để tìm đồ dùng.

![Không gian chăm sóc người bệnh](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Không gian tại cơ sở khám bệnh — ảnh minh họa demo")

## Nâng đỡ và quan sát trong suốt quá trình tắm

Nguồn tin mô tả những bước chăm sóc theo trình tự, từ vệ sinh tay, làm sạch mặt, tóc và cơ thể đến lau khô. Trong từng bước, đầu và cổ của trẻ cần được giữ chắc bằng thao tác phù hợp.

Không được để trẻ một mình trong lúc tắm. Người chăm sóc cần quan sát màu da, cách thở và phản ứng của trẻ, đồng thời duy trì những động tác nhẹ nhàng.

Trình tự và cách thực hiện nên được nhân viên y tế hướng dẫn trực tiếp. Với trẻ có tình trạng sức khỏe đặc biệt, việc chăm sóc phải theo đánh giá riêng, không nên dùng một quy trình chung để tự áp dụng cho mọi trường hợp.

## Sau tắm: Lau khô, giữ ấm và kiểm tra lại

Trẻ cần được lau khô, chú ý những vị trí nếp gấp, rồi mặc quần áo và tã sạch. Việc giữ ấm tiếp tục sau khi rời nước, cùng với theo dõi tình trạng của trẻ.

Tại bệnh viện, bàn giao trẻ về với mẹ là một bước cần kiểm tra lại thông tin định danh. Gia đình được hướng dẫn những điểm cần theo dõi sau chăm sóc và cách phối hợp với nhân viên y tế.

Quy trình an toàn vì vậy bao gồm cả thời điểm trước và sau tắm. Hoàn thành thao tác làm sạch chưa phải là kết thúc chăm sóc nếu chưa kiểm tra và bàn giao phù hợp.

![Khu vực tiếp đón và hướng dẫn](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Khu vực tiếp đón và hướng dẫn gia đình người bệnh — ảnh minh họa demo")

## Hỗ trợ mẹ trong những ngày đầu nuôi con

Bài nguồn nhắc vai trò của việc hướng dẫn cho bú, tư thế và khớp ngậm phù hợp. Khi người mẹ gặp khó khăn, trao đổi với nhân viên y tế giúp tìm cách hỗ trợ đúng với tình trạng của mẹ và bé.

Những biểu hiện cần được báo ngay trong quá trình chăm sóc gồm:

- Da hoặc môi tím, khó thở hay cách thở bất thường.
- Trẻ lừ đừ, phản ứng khác thường hoặc có cơn co giật.
- Bỏ bú hay thay đổi rõ về khả năng bú.
- Thân nhiệt có biểu hiện bất thường.

Sự phối hợp giữa gia đình và nhân viên chăm sóc giúp các thay đổi được nhận diện sớm hơn. Đối với trẻ sơ sinh, những thao tác nhỏ cần được thực hiện trong một kế hoạch chăm sóc nhất quán, an toàn và có theo dõi.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/tam-be-mot-khoanh-khac-nho-mot-su-cham-soc-lon?id=da2e8874-21ac-408d-b842-137cc72a4ba8). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-07 00:00:00+07', '2026-10-07 00:00:00+07', '2026-10-07 00:00:00+07'),
(6, 1, 'Tăng huyết áp khó kiểm soát: Khi nào cần đánh giá tuyến thượng thận?', 'tang-huyet-ap-va-cuong-aldosterone', 'Y học thường thức', '/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg', $article$*Huyết áp cao dù đã dùng nhiều thuốc có thể cần được đánh giá thêm về nguyên nhân. Chuyên gia nội tiết tại Bạch Mai đề cập cường aldosterone tiên phát như một tình trạng cần cân nhắc, nhất là khi người bệnh đồng thời có hạ kali, yếu cơ hoặc chuột rút.*

## Vai trò của hormone aldosterone

Tuyến thượng thận nằm phía trên mỗi thận và sản xuất nhiều hormone. Aldosterone tham gia điều hòa cân bằng muối, nước và kali, qua đó có vai trò đối với huyết áp.

Khi lượng aldosterone được tiết ra quá mức, thận có thể giữ muối và nước nhiều hơn, trong khi kali bị thải ra tăng. Bệnh cảnh vì vậy có thể bao gồm cả tăng huyết áp và hạ kali máu.

Bài nguồn phân biệt những nguyên nhân như một khối u lành ở một bên tuyến hoặc tình trạng tăng sản ở hai bên. Việc xác định đúng nguồn gốc giúp lựa chọn hướng xử trí, chứ không chỉ nhằm điều chỉnh một chỉ số huyết áp.

![Không gian thăm khám](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Không gian khám và đánh giá sức khỏe — ảnh minh họa demo")

## Những thông tin gợi ý cần kiểm tra thêm

TS.BS Nguyễn Quang Bảy, chuyên gia được bài báo dẫn, lưu ý các trường hợp huyết áp vẫn cao khi phải phối hợp nhiều thuốc. Những biểu hiện như yếu cơ, chuột rút hay hạ kali chưa rõ nguyên nhân cũng cần được xem xét.

Phát hiện khối u tuyến thượng thận trên hình ảnh học là một thông tin khác cần cung cấp cho bác sĩ. Ngoài ra, tuổi khởi phát tăng huyết áp, tiền sử gia đình và các bất thường tim mạch có thể ảnh hưởng đến kế hoạch đánh giá.

Các dấu hiệu này không đủ để tự kết luận mắc cường aldosterone. Không phải mọi trường hợp tăng huyết áp đều bắt nguồn từ tuyến thượng thận; cần có các xét nghiệm và thăm dò theo chỉ định chuyên khoa.

## Điều trị phụ thuộc vị trí và đặc điểm tổn thương

Nếu nguồn tăng tiết được xác định ở một bên tuyến, một số người bệnh có thể được cân nhắc phẫu thuật. Kết quả điều trị khác nhau giữa các trường hợp, nên không thể cam kết tất cả đều ngừng được thuốc hạ huyết áp sau can thiệp.

Khi tổn thương liên quan cả hai bên hoặc người bệnh không có chỉ định phẫu thuật, bác sĩ có thể lựa chọn thuốc đối kháng thụ thể mineralocorticoid. Mục tiêu là hạn chế tác động của aldosterone và kiểm soát những rối loạn đi kèm.

Hướng điều trị cần căn cứ vào chẩn đoán, tình trạng toàn thân và đánh giá của bác sĩ. Người bệnh không nên tự tăng liều, đổi thuốc hay ngừng điều trị chỉ vì nghi ngờ một nguyên nhân nội tiết.

![Khu vực phục vụ người bệnh](/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg "Khu vực phục vụ người bệnh — ảnh minh họa demo")

## Chuẩn bị thông tin khi đi khám

- Mang danh sách thuốc hạ huyết áp đang dùng và cách sử dụng thực tế.
- Ghi nhận các kết quả đo huyết áp đã có.
- Thông báo những đợt chuột rút, yếu cơ hoặc kết quả kali bất thường.
- Mang kết quả siêu âm, CT và các xét nghiệm trước đó nếu có.
- Cung cấp tiền sử bản thân và gia đình liên quan đến bệnh tim mạch.

Bài nguồn nhấn mạnh rằng việc kiểm soát huyết áp đôi khi cần đi cùng tìm kiếm nguyên nhân phía sau. Đánh giá đúng có thể mở ra hướng điều trị phù hợp hơn cho từng người, đồng thời tránh việc chỉ liên tục bổ sung thuốc mà thiếu một kế hoạch xem xét toàn diện.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/tang-huyet-ap-kho-kiem-soat-coi-chung-benh-tu-tuyen-thuong-than?id=acd55e47-7dd9-4205-bed0-c1cc3de7be11). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-09 00:00:00+07', '2026-10-09 00:00:00+07', '2026-10-09 00:00:00+07'),
(7, 1, 'An toàn thực phẩm: Kiểm soát nguy cơ từ nguyên liệu đến bữa ăn', 'nguyen-tac-an-toan-thuc-pham-phong-ngo-doc', 'Y học thường thức', '/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg', $article$*Phòng ngừa ngộ độc thực phẩm là một chuỗi công việc liên tục, bắt đầu từ chọn nguyên liệu và kết thúc ở khâu phục vụ. Bạch Mai lưu ý rằng vệ sinh tay, phân tách thực phẩm và kiểm soát bảo quản cần được thực hiện cùng nhau, đặc biệt tại bếp ăn tập thể.*

## Nguy cơ có thể xuất hiện ở nhiều công đoạn

Một món ăn có thể bị nhiễm bẩn khi vận chuyển, sơ chế, chế biến hoặc bảo quản. Tác nhân gây hại không chỉ đến từ nguyên liệu mà còn có thể truyền qua bàn tay, dao thớt, khăn lau và các bề mặt trong bếp.

Nhiễm khuẩn chéo xảy ra khi nguồn bẩn từ thực phẩm sống tiếp xúc với món đã chín hoặc thực phẩm được ăn ngay. Để hạn chế nguy cơ, cần tổ chức luồng làm việc và dụng cụ phù hợp, thay vì chỉ chú ý đến bước nấu.

Nguyên liệu nên có nguồn gốc rõ ràng, hạn sử dụng còn phù hợp và bao bì nguyên vẹn. Đối với bếp ăn tập thể, việc kiểm tra điều kiện giao nhận và bảo quản là một phần quan trọng của quy trình.

![Không gian cơ sở khám bệnh](/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg "Không gian tại cơ sở khám bệnh — ảnh minh họa demo")

## Vệ sinh tay và phân tách dụng cụ

Người tham gia chế biến cần giữ tay, móng tay và trang phục sạch. Rửa tay với xà phòng là bước cần thực hiện trước khi làm thức ăn, sau khi đi vệ sinh, xử lý nguyên liệu sống hoặc tiếp xúc với rác và bề mặt bẩn.

Thớt, dao, khay và hộp dùng cho thực phẩm sống cần được tách khỏi nhóm dùng cho món chín. Nếu dùng lại dụng cụ, phải làm sạch và xử lý phù hợp trước khi tiếp xúc với thực phẩm ăn ngay.

Khu vực bồn rửa, bàn chế biến và các vật dụng cần được vệ sinh thường xuyên. Khăn lau và miếng bọt biển cũng cần được làm sạch, làm khô và thay khi không còn phù hợp, vì chúng có thể trở thành nguồn truyền vi sinh vật.

## Bảo quản phải gắn với thời gian và nhiệt độ

Bài nguồn nhắc việc nấu chín kỹ, phục vụ kịp thời và bảo quản đúng yêu cầu từng món. Với thức ăn nóng, cơ sở cần duy trì điều kiện giữ nóng phù hợp; với món lạnh, cần hạn chế thời gian ở nhiệt độ phòng.

Một số việc cần chú ý trong tổ chức bữa ăn:

- Kiểm soát đồng thời thời gian và nhiệt độ khi bày món.
- Dùng dụng cụ sạch, có nắp khi bảo quản phần thức ăn còn lại.
- Không trộn thức ăn mới vào một khay cũ nếu chưa bảo đảm vệ sinh.
- Không sử dụng nguyên liệu có dấu hiệu biến đổi bất thường.
- Ghi chép các thông tin cần thiết tại bếp ăn tập thể.

Mùi vị bình thường không bảo đảm một thực phẩm không mang tác nhân gây bệnh. Vì vậy, đánh giá an toàn cần dựa cả vào nguồn gốc, thao tác chế biến và điều kiện bảo quản.

![Khu vực tiếp đón cơ sở y tế](/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg "Khu vực tiếp đón tại cơ sở y tế — ảnh minh họa demo")

## Khi nghi ngờ xảy ra ngộ độc

Nôn nhiều, tiêu chảy kéo dài, đau bụng dữ dội hoặc những biểu hiện toàn thân bất thường là lý do cần đưa người bệnh đi khám. Cơ sở phục vụ bữa ăn cần đồng thời báo cho người phụ trách và phối hợp với cơ quan y tế.

Món ăn hoặc lô nguyên liệu nghi ngờ cần được ngừng phục vụ và bảo quản riêng để hỗ trợ xác minh. Mẫu lưu, thức ăn còn lại và thông tin giao nhận, chế biến đều có thể hữu ích khi truy tìm nguyên nhân.

Việc phòng ngừa hiệu quả không nằm ở một thao tác riêng lẻ. Một quy trình được duy trì đều đặn, có người chịu trách nhiệm và có thông tin truy xuất sẽ giúp cơ sở phản ứng phù hợp khi có sự cố.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/kiem-soat-an-toan-thuc-pham-nhung-nguyen-tac-can-nho-de-phong-ngua-ngo-doc?id=e74eabd5-2bfa-4acf-bbf3-724341aa8820). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-12 00:00:00+07', '2026-10-12 00:00:00+07', '2026-10-12 00:00:00+07'),
(8, 1, 'Rối loạn ăn uống ở người trẻ: Cần quan tâm cả sức khỏe thể chất và tinh thần', 'roi-loan-an-uong-va-ha-kali-mau', 'Y học thường thức', '/uploads/articles/aa415242679740d7b2684416036beb63.jpg', $article$*Một ca bệnh được Viện Sức khỏe Tâm thần báo cáo cho thấy nỗi lo cân nặng có thể gắn với rối loạn ăn uống và những biến chứng toàn thân. Đánh giá cần quan tâm đến hành vi, cảm xúc và sức khỏe, thay vì chỉ nhìn vào vóc dáng hoặc quy kết người bệnh thiếu ý chí.*

## Một vòng lặp khó thoát ra nếu thiếu hỗ trợ

Nữ sinh 21 tuổi được đề cập trong bài nguồn đã trải qua những đợt ăn mất kiểm soát rồi tự gây nôn trong khoảng một năm. Áp lực học tập, những lời bình luận về ngoại hình và căng thẳng gia đình là những yếu tố được ghi nhận khi khai thác tình trạng của người bệnh.

Khi đến khám, người bệnh có BMI 17,6, mất kinh trong ba tháng và kết quả kali máu 2,9 mmol/L. Đây là những dữ kiện của một ca lâm sàng cụ thể, không phải các ngưỡng để người đọc tự chẩn đoán rối loạn ăn uống tại nhà.

Người bệnh được điều trị phối hợp nhiều phương pháp theo đánh giá của nhóm chuyên môn. Bài nguồn mô tả sự cải thiện từng bước, cho thấy việc hồi phục cần một kế hoạch chăm sóc phù hợp chứ không chỉ là yêu cầu thay đổi thói quen ăn uống.

![Không gian tư vấn](/uploads/articles/f295b0a7a359495a8f6caf1e417b1f04.jpg "Không gian phục vụ khám và tư vấn — ảnh minh họa demo")

## Cân nặng không phản ánh đầy đủ tình trạng bệnh

Ăn vô độ tâm thần, hay *Bulimia nervosa*, có thể liên quan đến các đợt ăn mất kiểm soát và hành vi bù trừ sau ăn. Những suy nghĩ về hình thể, cảm giác tội lỗi và sợ tăng cân có thể khiến người bệnh bị cuốn vào vòng lặp kéo dài.

Không phải mọi người mắc tình trạng này đều gầy. Bài nguồn nhấn mạnh rằng người bệnh có thể có cân nặng trong khoảng thông thường hoặc thừa cân, nên việc quan sát vóc dáng đơn thuần dễ bỏ sót vấn đề.

Những biến đổi về hành vi cần được đặt trong bối cảnh: ăn uống kín đáo bất thường, lo lắng nhiều về cân nặng, thường xuyên rời bữa ăn để vào nhà vệ sinh hoặc tập luyện quá mức. Khi các biểu hiện lặp lại, gia đình nên khuyến khích đánh giá chuyên khoa.

## Vì sao việc thăm khám cần bao quát nhiều mặt

Rối loạn ăn uống có thể đi kèm mất nước, thay đổi điện giải và những vấn đề tiêu hóa, răng miệng hoặc kinh nguyệt. Các vấn đề tâm lý cũng có thể cùng tồn tại. Vì vậy, kế hoạch chăm sóc cần xem xét cả tình trạng cơ thể và sức khỏe tinh thần.

Theo bài nguồn, bác sĩ có thể phối hợp điều trị chuyên khoa tâm thần, liệu pháp tâm lý và tư vấn dinh dưỡng. Phương pháp cụ thể được lựa chọn theo từng người bệnh; không nên lấy một ca điều trị làm công thức áp dụng cho tất cả.

Các biểu hiện nặng như ngất, khó thở, đau ngực, co giật, lú lẫn hoặc yếu cơ rõ rệt cần được đưa đến cơ sở y tế để đánh giá kịp thời. Đây là những tình huống cần hỗ trợ trực tiếp, không nên chờ một lịch tư vấn thông thường.

![Khu vực tiếp đón](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Khu vực tiếp đón người bệnh — ảnh minh họa demo")

## Đồng hành bằng cách lắng nghe

- Tránh bình luận gây áp lực về cân nặng hay ngoại hình.
- Lắng nghe trải nghiệm của người bệnh và những khó khăn trong sinh hoạt.
- Khuyến khích tìm đến chuyên gia tâm thần, tâm lý và dinh dưỡng.
- Đồng hành với kế hoạch theo dõi, không yêu cầu người bệnh phải tự giải quyết bằng ý chí.
- Quan tâm các thay đổi về sức khỏe và báo cho nhóm điều trị khi cần.

Sự hỗ trợ của gia đình có thể giúp việc tìm kiếm chăm sóc bớt khó khăn. Bài báo nhắc rằng rối loạn ăn uống là một vấn đề sức khỏe cần được nhận diện và điều trị, cùng với sự tôn trọng và đồng hành.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/nu-sinh-21-tuoi-ha-kali-mau-vi-am-anh-can-nang-lien-tuc-an-roi-tu-gay-non?id=8383a596-959a-49e8-b635-bddf07c63483). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07'),
(9, 1, 'Thuốc tránh thai nội tiết và huyết khối: Những dấu hiệu không nên bỏ qua', 'nguy-co-huyet-khoi-khi-dung-thuoc-tranh-thai', 'Y học thường thức', '/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg', $article$*Từ một ca huyết khối ở người phụ nữ 36 tuổi, Bạch Mai lưu ý việc sử dụng thuốc tránh thai cần gắn với tư vấn cá nhân. Thuốc đang dùng, tiền sử bệnh, cân nặng và mức vận động đều là những thông tin quan trọng khi đánh giá nguy cơ hình thành cục máu đông.*

## Từ sưng đau ở chân đến tình trạng cấp cứu

Người bệnh trong báo cáo đã tự sử dụng thuốc tránh thai trong khoảng 10 tháng. Trước khi nhập viện, chân phải xuất hiện sưng đau; việc đi lại gây khó chịu. Người bệnh xử trí tại nhà bằng xoa dầu và mát-xa, sau đó mới đến cấp cứu khi có khó thở, đau ngực và nhịp tim nhanh.

Qua thăm khám, bác sĩ xác định huyết khối tĩnh mạch sâu ở chi dưới kèm thuyên tắc phổi. Người bệnh làm công việc văn phòng, ít vận động và có BMI 26. Tình trạng dần ổn định sau những ngày đầu điều trị tại bệnh viện.

Ca bệnh được nguồn tin dùng để nhấn mạnh việc xem xét nhiều yếu tố nguy cơ cùng lúc. Không thể từ một trường hợp riêng lẻ suy ra rằng mọi người sử dụng thuốc tránh thai đều sẽ gặp biến chứng.

![Không gian thăm khám](/uploads/articles/aa415242679740d7b2684416036beb63.jpg "Không gian phục vụ thăm khám — ảnh minh họa demo")

## Vì sao cần được tư vấn trước khi lựa chọn thuốc

Một số thuốc tránh thai phối hợp chứa estrogen và progestin có liên quan đến tăng nguy cơ huyết khối. Với phần lớn phụ nữ khỏe mạnh, nguy cơ nhìn chung vẫn thấp, nhưng cách lựa chọn thuốc cần cân nhắc các yếu tố đi kèm.

Những thông tin nên cung cấp trong buổi tư vấn gồm tiền sử bản thân hoặc gia đình từng có huyết khối, việc hút thuốc, các bệnh tim mạch, đau nửa đầu có tiền triệu và tình trạng sau sinh. Bác sĩ cũng cần biết người bệnh có sắp phẫu thuật hoặc phải nằm bất động lâu hay không.

Thừa cân và ngồi lâu là những yếu tố cần được xem xét trong bối cảnh sức khỏe tổng thể. Không nên chọn sản phẩm chỉ dựa trên quảng cáo, lời giới thiệu của người quen hoặc đơn thuốc của một người khác.

## Dấu hiệu ở chân và dấu hiệu ở phổi khác nhau

Huyết khối ở tĩnh mạch sâu có thể gây sưng một bên chân, đau, căng tức, nóng hoặc thay đổi màu da. Khi cục máu đông di chuyển đến phổi, biểu hiện có thể chuyển thành khó thở đột ngột, đau ngực, tim đập nhanh hoặc choáng.

Các dấu hiệu đột ngột như khó thở và đau ngực cần được đánh giá cấp cứu. Người có chân sưng đau nghi do huyết khối cũng cần đi khám; nguồn tin khuyến cáo tránh xoa bóp, mát-xa hoặc chườm nóng tại vùng đó.

Nhận biết sớm không thay thế cho chẩn đoán. Điều quan trọng là cung cấp đầy đủ thời điểm xuất hiện triệu chứng và những thuốc đang dùng để nhân viên y tế đánh giá.

![Khu vực tiếp đón người bệnh](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Khu vực tiếp đón và hướng dẫn người bệnh — ảnh minh họa demo")

## Những việc cần trao đổi để sử dụng thuốc phù hợp

- Báo tiền sử huyết khối của bản thân và gia đình khi được tư vấn.
- Thông tin rõ về hút thuốc, bệnh nền và những thuốc đang sử dụng.
- Hỏi phương án tránh thai phù hợp với tình trạng sức khỏe hiện tại.
- Cho bác sĩ biết thuốc tránh thai đang dùng trước phẫu thuật hoặc khi cần bất động dài ngày.
- Trao đổi khi lo ngại tác dụng phụ, thay vì tự đổi hoặc dùng chung thuốc.

Trong sinh hoạt, người phải ngồi lâu có thể chủ động vận động chân và dành những khoảng nghỉ phù hợp. Khi đi khám vì bất cứ vấn đề nào, danh sách thuốc là thông tin hữu ích để bác sĩ nhận diện những nguy cơ liên quan.

Thông điệp của bài nguồn là lựa chọn biện pháp tránh thai có tư vấn, đồng thời chú ý những thay đổi bất thường của cơ thể. Hiệu quả và sự an toàn cần được xem xét cùng nhau ở từng người.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/bac-si-canh-bao-nguy-co-huyet-khoi-o-phu-nu-thua-can-it-van-dong-dung-thuoc-tranh-thai?id=391dd160-dc48-48d6-8d32-56958155f80c). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07'),
(10, 1, 'Nội soi đại tràng khi khám sức khỏe, phát hiện sán dây bò dài 70cm', 'noi-soi-dai-trang-phat-hien-san-day-bo', 'Y học thường thức', '/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg', $article$*Một trường hợp khám sức khỏe tại Bạch Mai cho thấy nhiễm ký sinh trùng đường ruột có thể diễn ra rất kín đáo. Người bệnh nữ 48 tuổi hầu như không có biểu hiện tiêu hóa đáng chú ý, nhưng nội soi phát hiện một dải sán và lấy ra đoạn thân dài khoảng 70 cm. Kết quả định danh bệnh phẩm phù hợp với sán dây bò.*

## Phát hiện trong một lần kiểm tra sức khỏe

Người bệnh H.T.H., sống tại Lai Châu, đến Bệnh viện Bạch Mai để khám tổng quát. Điểm đáng chú ý của trường hợp này là trước đó người bệnh không nhận thấy những rối loạn tiêu hóa rõ rệt, nên không chủ động tìm đến cơ sở chuyên khoa vì nghi ngờ nhiễm sán.

Ngày 30/9/2026, trong lúc thực hiện nội soi đại trực tràng có gây mê, ThS.BSNT Vũ Thị Ngọc Bích cùng ê-kíp của Viện Tiêu hóa phát hiện một cấu trúc trắng, dẹt ở đoạn cuối hồi tràng. Dải ký sinh trùng kéo dài sang đại tràng ngang. Bác sĩ dùng dụng cụ nội soi lấy ra một phần thân sán với chiều dài khoảng 70 cm.

![Không gian khám bệnh](/uploads/articles/d2bbf80bf5e6474f9040d5510946261e.jpg "Không gian khám bệnh — ảnh minh họa demo")

Bệnh phẩm được chuyển đến đơn vị vi sinh của Viện Xét nghiệm Y học để kiểm tra. Kết quả phù hợp với *Taenia saginata*, tên khoa học của sán dây bò. Sau thủ thuật, người bệnh tiếp tục được đánh giá tại phòng khám bệnh nhiệt đới và viêm gan để lập kế hoạch điều trị bằng thuốc.

## Lấy được thân sán chưa có nghĩa đã điều trị khỏi

Theo thông tin được bác sĩ chia sẻ trong bài gốc, người nhiễm sán dây bò có thể có rất ít biểu hiện, thậm chí không nhận ra điều gì khác thường. Việc nội soi lấy được bệnh phẩm tạo điều kiện cho xét nghiệm định danh, nhưng không thể dùng riêng kết quả đó để kết luận ký sinh trùng đã được loại bỏ hoàn toàn.

Phần được lấy ra trong ca bệnh chỉ là một đoạn thân. Nếu đầu sán còn bám vào ruột non, ký sinh trùng có thể tiếp tục phát triển. Vì vậy, người bệnh vẫn cần được bác sĩ đánh giá và chỉ định điều trị đặc hiệu; việc theo dõi sau thủ thuật là một phần của quá trình xử trí.

## Đường lây và những dấu hiệu cần chú ý

Con người có thể nhiễm sán dây bò khi ăn thịt bò sống hoặc chưa được nấu chín kỹ có chứa ấu trùng. Sau khi vào cơ thể, ấu trùng phát triển thành sán trưởng thành trong ruột non. Các món bò tái hoặc gỏi bò có thể mang nguy cơ nếu nguyên liệu bị nhiễm.

Cần phân biệt sán dây bò với sán dây lợn, *Taenia solium*. Đây là hai loài khác nhau về đường lây và những vấn đề sức khỏe liên quan. Việc nhận diện loài và đánh giá bệnh phẩm cần được thực hiện tại cơ sở chuyên môn, tránh tự suy đoán chỉ từ hình dạng quan sát được.

Những biểu hiện có thể gặp bao gồm:

- Khó chịu hoặc đau bụng, đầy hơi, buồn nôn hay tiêu chảy.
- Chán ăn hoặc giảm cân mà chưa xác định được nguyên nhân.
- Nhìn thấy các đốt màu trắng trong phân hoặc quanh vùng hậu môn.

Một số người không có đủ các biểu hiện trên. Ngược lại, các triệu chứng tiêu hóa cũng có thể xuất phát từ nhiều nguyên nhân khác, nên người bệnh cần được thăm khám để xác định chẩn đoán.

![Khu vực tiếp đón](/uploads/articles/da5271a8499c44d9bd5e65a306704e03.jpg "Khu vực tiếp đón người bệnh — ảnh minh họa demo")

## Chẩn đoán, điều trị và phòng ngừa

Xét nghiệm phân để tìm trứng hoặc đốt sán là một hướng đánh giá thường được sử dụng. Trong những tình huống cần thiết, mẫu đốt sán có thể giúp xác định loài. Lựa chọn xét nghiệm và diễn giải kết quả thuộc về bác sĩ chuyên khoa.

Bài nguồn đề cập praziquantel trong điều trị sán dây bò. Người bệnh cần dùng thuốc theo chỉ định và tái khám khi được yêu cầu, thay vì tự mua thuốc hoặc coi việc lấy được thân sán qua nội soi là đủ để kết thúc theo dõi.

Các thực hành giúp hạn chế nguy cơ gồm nấu chín thịt bò, chọn nguyên liệu có nguồn gốc được kiểm soát, tách dụng cụ chế biến thực phẩm sống và chín, vệ sinh tay và giữ môi trường chăn nuôi, sinh hoạt sạch sẽ.

Ca bệnh nhấn mạnh vai trò của đánh giá chuyên môn: có bệnh ký sinh trùng tồn tại âm thầm, trong khi xét nghiệm và điều trị phù hợp vẫn cần thiết ngay cả sau khi đã lấy được một phần ký sinh trùng.

Nguồn: [Bệnh viện Bạch Mai — bài viết gốc](https://bachmai.gov.vn/bai-viet/noi-soi-dai-trang-khi-kham-suc-khoe-phat-hien-san-day-bo-dai-70cm?id=e5652f8d-2b4f-4ae9-8ba2-5f742d87ce0d). Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện.$article$, 1, '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07', '2026-10-13 00:00:00+07');

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
('SUPPORT_EMAIL', '', 'Email hỗ trợ công khai, để trống khi chưa có thông tin', '2026-10-01 08:00:00+07'),
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

