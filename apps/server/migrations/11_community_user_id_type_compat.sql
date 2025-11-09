-- 커뮤니티 MVP: user_id 타입 호환성 도메인 생성
-- 2025-01-XX

-- users.id의 실제 타입을 읽어서 user_id_t 도메인 생성
DO $$
DECLARE
  typ text;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'users'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF typ IS NULL THEN
    RAISE EXCEPTION 'users.id column not found';
  END IF;

  IF typ NOT IN ('uuid','bigint','integer') THEN
    RAISE EXCEPTION 'Unsupported users.id type: %', typ;
  END IF;

  EXECUTE 'DROP DOMAIN IF EXISTS user_id_t';
  EXECUTE format('CREATE DOMAIN user_id_t AS %s', typ);
  
  RAISE NOTICE 'user_id_t 도메인 생성 완료: %', typ;
END $$;

























