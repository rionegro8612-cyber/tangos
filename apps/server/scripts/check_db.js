const { Client } = require("pg");

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL missing");
    const c = new Client({ connectionString: url });
    await c.connect();

    const u = await c.query("select to_regclass('public.users') as t");
    const s = await c.query("select to_regclass('public.auth_sms_codes') as t");
    const r = await c.query("select to_regclass('public.auth_refresh_tokens') as t");
    const f = await c.query("select exists(select 1 from pg_proc where proname='gen_random_uuid') as f");

    console.log("users table:               ", u.rows[0].t);
    console.log("auth_sms_codes table:      ", s.rows[0].t);
    console.log("auth_refresh_tokens table: ", r.rows[0].t);
    console.log("gen_random_uuid function:  ", f.rows[0].f);

    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
