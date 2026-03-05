import pg from "pg";

export default async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const client = new pg.Client({ connectionString });
  await client.connect();

  await client.query(
    `DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'e2e-test-%')`
  );
  await client.query(`DELETE FROM "User" WHERE email LIKE 'e2e-test-%'`);

  await client.end();
}
