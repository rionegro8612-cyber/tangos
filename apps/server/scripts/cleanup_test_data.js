const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // TODO: 실제 정리 쿼리들 추가
  // await client.query("DELETE FROM users WHERE ...");

  await client.end();
  console.log("cleanup_test_data done");
})();
