DO $do$
DECLARE
  has_age boolean;
  has_birth boolean;
  has_birth_date boolean;
  has_dob boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='age'
  ) INTO has_age;

  IF NOT has_age THEN
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='birth'
    ) INTO has_birth;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='birth_date'
    ) INTO has_birth_date;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='dob'
    ) INTO has_dob;

    IF has_birth THEN
      EXECUTE $sql$
        ALTER TABLE users
        ADD COLUMN age integer GENERATED ALWAYS AS (
          CASE
            WHEN birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              THEN date_part('year', age(to_date(birth,'YYYY-MM-DD')))::int
            ELSE NULL
          END
        ) STORED
      $sql$;
    ELSIF has_birth_date THEN
      EXECUTE $sql$
        ALTER TABLE users
        ADD COLUMN age integer GENERATED ALWAYS AS (
          date_part('year', age(birth_date))::int
        ) STORED
      $sql$;
    ELSIF has_dob THEN
      EXECUTE $sql$
        ALTER TABLE users
        ADD COLUMN age integer GENERATED ALWAYS AS (
          CASE
            WHEN dob ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              THEN date_part('year', age(to_date(dob,'YYYY-MM-DD')))::int
            ELSE NULL
          END
        ) STORED
      $sql$;
    ELSE
      -- birth 관련 컬럼이 없으면, 우선 NULL 허용 정수 컬럼만 추가(서버 SELECT 호환 목적)
      EXECUTE 'ALTER TABLE users ADD COLUMN age integer';
    END IF;
  END IF;
END
$do$;
