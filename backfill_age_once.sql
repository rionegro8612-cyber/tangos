DO $do$
DECLARE
  has_birth boolean;
  has_birth_date boolean;
  has_dob boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='birth')
    INTO has_birth;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='birth_date')
    INTO has_birth_date;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='dob')
    INTO has_dob;

  IF has_birth THEN
    EXECUTE $sql$
      UPDATE users
      SET age = CASE
        WHEN birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN date_part('year', age(to_date(birth,'YYYY-MM-DD')))::int
        ELSE NULL
      END
      WHERE age IS NULL
    $sql$;
  ELSIF has_birth_date THEN
    EXECUTE $sql$
      UPDATE users
      SET age = date_part('year', age(birth_date))::int
      WHERE age IS NULL
    $sql$;
  ELSIF has_dob THEN
    EXECUTE $sql$
      UPDATE users
      SET age = CASE
        WHEN dob ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN date_part('year', age(to_date(dob,'YYYY-MM-DD')))::int
        ELSE NULL
      END
      WHERE age IS NULL
    $sql$;
  END IF;
END
$do$;
