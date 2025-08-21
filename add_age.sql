DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='users' AND column_name='age'
  ) THEN
    ALTER TABLE users
    ADD COLUMN age integer GENERATED ALWAYS AS (
      CASE
        WHEN birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN date_part('year', age(to_date(birth,'YYYY-MM-DD')))::int
        ELSE NULL
      END
    ) STORED;
  END IF;
END
$do$;
