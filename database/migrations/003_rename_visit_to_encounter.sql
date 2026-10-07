-- Đổi tên schema cũ, giữ nguyên ID, dữ liệu và liên kết khóa ngoại.
-- Chạy sau 001 và 002 trên database cũ. Database mới không cần migration.
BEGIN;
SELECT pg_advisory_xact_lock(78124001);
DO $$
DECLARE
    item RECORD;
    old_name text;
    new_name text;
BEGIN
    -- Không trộn hai bảng cùng tồn tại: dừng thay vì làm mất dữ liệu.
    FOREACH old_name IN ARRAY ARRAY['visit','visit_status_log','visit_transfer_log'] LOOP
        new_name := replace(old_name, 'visit', 'encounter');
        IF to_regclass(format('%I.%I', current_schema(), old_name)) IS NOT NULL THEN
            IF to_regclass(format('%I.%I', current_schema(), new_name)) IS NOT NULL THEN
                RAISE EXCEPTION 'Both % and % exist; resolve before migration', old_name, new_name;
            END IF;
            EXECUTE format('ALTER TABLE %I.%I RENAME TO %I', current_schema(), old_name, new_name);
        END IF;
    END LOOP;

    FOR item IN
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('encounter','encounter_status_log','encounter_transfer_log','payment','medical_record')
          AND column_name IN ('visit_id','visit_type','visit_status')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I', current_schema(), item.table_name,
                       item.column_name, replace(item.column_name, 'visit', 'encounter'));
    END LOOP;

    -- PRIMARY KEY/UNIQUE constraints rename their owned indexes automatically.
    FOR item IN
        SELECT c.conname, t.relname FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname IN ('encounter','encounter_status_log','encounter_transfer_log','payment','medical_record')
          AND position('visit' in c.conname) > 0
    LOOP
        EXECUTE format('ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I', current_schema(), item.relname,
                       item.conname, replace(item.conname, 'visit', 'encounter'));
    END LOOP;

    FOR item IN
        SELECT c.relname, c.relkind FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind IN ('i','S')
          AND position('visit' in c.relname) > 0
    LOOP
        EXECUTE format('ALTER %s %I.%I RENAME TO %I',
                       CASE WHEN item.relkind = 'S' THEN 'SEQUENCE' ELSE 'INDEX' END,
                       current_schema(), item.relname, replace(item.relname, 'visit', 'encounter'));
    END LOOP;

    FOR item IN
        SELECT g.tgname, t.relname FROM pg_trigger g
        JOIN pg_class t ON t.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND NOT g.tgisinternal
          AND t.relname IN ('encounter','encounter_status_log','encounter_transfer_log')
          AND position('visit' in g.tgname) > 0
    LOOP
        EXECUTE format('ALTER TRIGGER %I ON %I.%I RENAME TO %I', item.tgname, current_schema(),
                       item.relname, replace(item.tgname, 'visit', 'encounter'));
    END LOOP;
END;
$$;
UPDATE notification SET reference_type = 'ENCOUNTER' WHERE reference_type = 'VISIT';
-- qr_code là mã định danh đã cấp: giữ nguyên để mã QR cũ tiếp tục sử dụng được.
COMMIT;
