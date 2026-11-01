-- Additive upgrade for databases created before the current profile/booking schema.
-- Run in one transaction; no data reset, column removal or record replacement.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dob date CHECK (dob BETWEEN DATE '1900-01-01' AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Saigon')::date),
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Nam','Nữ','Khác')),
  ADD COLUMN IF NOT EXISTS id_card text UNIQUE CHECK (id_card ~ '^[0-9]{12}$'),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text CHECK (emergency_contact_phone ~ '^\+?[0-9]{9,15}$'),
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;
ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text CHECK (emergency_contact_phone ~ '^\+?[0-9]{9,15}$'),
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;
ALTER TABLE encounter ADD COLUMN IF NOT EXISTS registration_details jsonb
  CHECK (registration_details IS NULL OR jsonb_typeof(registration_details) = 'object');

ALTER TABLE role ADD COLUMN IF NOT EXISTS role_code text GENERATED ALWAYS AS (business_code('VT', role_id)) STORED UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_code text GENERATED ALWAYS AS (business_code('TK', user_id)) STORED UNIQUE;
ALTER TABLE patient ADD COLUMN IF NOT EXISTS patient_code text GENERATED ALWAYS AS (business_code('BN', patient_id)) STORED UNIQUE;
ALTER TABLE department ADD COLUMN IF NOT EXISTS department_code text GENERATED ALWAYS AS (business_code('CK', department_id)) STORED UNIQUE;
ALTER TABLE doctor_profile ADD COLUMN IF NOT EXISTS doctor_code text GENERATED ALWAYS AS (business_code('BS', doctor_profile_id)) STORED UNIQUE;
ALTER TABLE room ADD COLUMN IF NOT EXISTS room_code text GENERATED ALWAYS AS (business_code('PH', room_id)) STORED UNIQUE;
ALTER TABLE work_schedule ADD COLUMN IF NOT EXISTS schedule_code text GENERATED ALWAYS AS (business_code('CA', schedule_id)) STORED UNIQUE;
ALTER TABLE encounter ADD COLUMN IF NOT EXISTS encounter_code text GENERATED ALWAYS AS (business_code('LK', encounter_id)) STORED UNIQUE;
ALTER TABLE encounter_status_log ADD COLUMN IF NOT EXISTS log_code text GENERATED ALWAYS AS (business_code('NKTT', log_id)) STORED UNIQUE;
ALTER TABLE encounter_transfer_log ADD COLUMN IF NOT EXISTS log_code text GENERATED ALWAYS AS (business_code('NKCD', log_id)) STORED UNIQUE;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS payment_code text GENERATED ALWAYS AS (business_code('TT', payment_id)) STORED UNIQUE;
ALTER TABLE medical_record ADD COLUMN IF NOT EXISTS record_code text GENERATED ALWAYS AS (business_code('BA', record_id)) STORED UNIQUE;
ALTER TABLE prescription_item ADD COLUMN IF NOT EXISTS item_code text GENERATED ALWAYS AS (business_code('DT', item_id)) STORED UNIQUE;
ALTER TABLE review ADD COLUMN IF NOT EXISTS review_code text GENERATED ALWAYS AS (business_code('DG', review_id)) STORED UNIQUE;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS notification_code text GENERATED ALWAYS AS (business_code('TB', notification_id)) STORED UNIQUE;
ALTER TABLE article ADD COLUMN IF NOT EXISTS article_code text GENERATED ALWAYS AS (business_code('BV', article_id)) STORED UNIQUE;
ALTER TABLE role_request ADD COLUMN IF NOT EXISTS request_code text GENERATED ALWAYS AS (business_code('YCVT', request_id)) STORED UNIQUE;
ALTER TABLE nurse_assignment ADD COLUMN IF NOT EXISTS assignment_code text GENERATED ALWAYS AS (business_code('PC', assignment_id)) STORED UNIQUE;
ALTER TABLE department_leadership ADD COLUMN IF NOT EXISTS leadership_code text GENERATED ALWAYS AS (business_code('LDK', leadership_id)) STORED UNIQUE;
ALTER TABLE staff_leave_request ADD COLUMN IF NOT EXISTS request_code text GENERATED ALWAYS AS (business_code('NP', request_id)) STORED UNIQUE;
