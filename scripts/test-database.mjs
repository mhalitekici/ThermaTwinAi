// Real PostgreSQL semantics in an embedded PGlite instance. No external account required.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202610160001_initial.sql", import.meta.url),
    "utf8",
  ),
);
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
await db.query(
  `insert into auth.users values($1,'alice@example.test',now()),($2,'bob@example.test',now())`,
  [alice, bob],
);
await db.exec(`grant select on auth.users to service_role`);
async function asUser(user, sql, args = []) {
  await db.exec("set role authenticated");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
await asUser(
  alice,
  `insert into public.subscriptions(user_id,region_id) values($1,'akkuyu')`,
  [alice],
);
await asUser(
  bob,
  `insert into public.subscriptions(user_id,region_id) values($1,'akkuyu')`,
  [bob],
);
assert.equal(
  (await asUser(alice, "select * from public.subscriptions")).rows.length,
  1,
);
assert.equal(
  (await asUser(alice, "select * from public.subscriptions")).rows[0].user_id,
  alice,
);
await assert.rejects(
  () =>
    asUser(
      alice,
      `insert into public.subscriptions(user_id,region_id) values($1,'akkuyu')`,
      [bob],
    ),
  /row-level security/,
);
assert.equal(
  (
    await asUser(
      alice,
      "update public.subscriptions set active=false where user_id=$1 returning *",
      [bob],
    )
  ).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      alice,
      `insert into public.observations values('akkuyu','2024-01-01',20,'fake',now())`,
    ),
  /permission denied/,
);
await assert.rejects(
  () => asUser(alice, `select public.register_alert('{}'::jsonb)`),
  /permission denied/,
);

const event = {
  region_id: "akkuyu",
  mode: "live",
  kind: "observed",
  event_date: "2024-06-06",
  dataset_id: "TEST_FIXTURE_ONLY",
  risk: "high",
  report: { text: "frozen test report" },
};
async function register(day) {
  return (
    await db.query("select (public.register_alert($1::jsonb)).*", [
      JSON.stringify({ ...event, event_date: day }),
    ])
  ).rows[0];
}
await db.exec("set role service_role");
const a = await register("2024-06-06");
const same = await register("2024-06-07");
assert.equal(a.id, same.id, "Continuous episode deduplicates");
const later = await register("2024-06-12");
assert.notEqual(a.id, later.id, "A new episode follows quiet days");
const claims = await db.query(
  `select * from public.claim_delivery($1,$2,$3::jsonb)`,
  [
    a.id,
    alice,
    JSON.stringify({ to: ["alice@example.test"], text: "original" }),
  ],
);
assert.equal(claims.rows.length, 1);
assert.equal(
  (
    await db.query(`select * from public.claim_delivery($1,$2,'{}')`, [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
  "Lease blocks concurrent sender",
);
const d = claims.rows[0];
await db.query(
  `update public.deliveries set status='failed',lease_until=null where id=$1`,
  [d.id],
);
const retried = (
  await db.query(
    `select * from public.claim_delivery($1,$2,'{"text":"changed"}')`,
    [a.id, alice],
  )
).rows[0];
assert.deepEqual(
  retried.payload,
  d.payload,
  "Retries retain exact provider request body",
);
await db.query(
  `update public.deliveries set status='failed',lease_until=null,first_attempt_at=now()-interval '24 hours' where id=$1`,
  [d.id],
);
assert.equal(
  (
    await db.query(`select * from public.claim_delivery($1,$2,'{}')`, [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
);
assert.equal(
  (await db.query(`select status from public.deliveries where id=$1`, [d.id]))
    .rows[0].status,
  "uncertain",
);
await db.exec("reset role");
assert.equal(
  (await asUser(bob, "select * from public.deliveries")).rows.length,
  0,
);
assert.equal((await asUser(bob, "select * from public.alerts")).rows.length, 0);
assert.equal(
  (await asUser(alice, "select * from public.alerts")).rows.length,
  1,
);
await asUser(
  alice,
  `update public.subscriptions set active=false where user_id=$1`,
  [alice],
);
await db.exec("set role service_role");
assert.equal(
  (
    await db.query(`select * from public.claim_delivery($1,$2,'{}')`, [
      later.id,
      alice,
    ])
  ).rows.length,
  0,
  "Unsubscribed account cannot receive",
);
await db.exec("reset role");
// Preserve the original tests above, then exercise the upgrade as deployed.
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202610160002_consent_shadow.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
assert.equal(
  (await asUser(alice, "select email_enabled from public.subscriptions"))
    .rows[0].email_enabled,
  false,
  "Old active status is not consent",
);
await assert.rejects(
  () => asUser(alice, "update public.subscriptions set email_enabled=true"),
  /permission denied/,
);
await assert.rejects(
  () =>
    asUser(alice, "select * from public.manage_subscription('email_on',null)"),
  /Explicit consent/,
);
await asUser(
  alice,
  "select * from public.manage_subscription('subscribe',false)",
);
await asUser(
  alice,
  "select * from public.manage_subscription('subscribe',false)",
);
assert.equal(
  (await asUser(alice, "select * from public.subscriptions")).rows.length,
  1,
  "Re-subscribe is an upsert",
);
await db.exec("set role service_role");
assert.equal(
  (
    await db.query("select * from public.claim_delivery($1,$2,'{}','test')", [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
  "Active without consent cannot receive",
);
await db.exec("reset role");
await asUser(
  alice,
  "select * from public.manage_subscription('email_on',true)",
);
assert.equal(
  (await asUser(alice, "select * from public.subscription_events")).rows.every(
    (r) => r.user_id === alice,
  ),
  true,
);
assert.equal(
  (await asUser(bob, "select * from public.subscription_events")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(alice, "select * from public.claim_delivery($1,$2,'{}','test')", [
      a.id,
      alice,
    ]),
  /permission denied/,
);
await db.exec("set role service_role");
const shadow = (
  await db.query("select * from public.claim_delivery($1,$2,'{}','shadow')", [
    a.id,
    alice,
  ])
).rows;
assert.equal(shadow[0].status, "shadow");
assert.equal(shadow[0].attempts, 0);
assert.equal(
  (
    await db.query("select * from public.claim_delivery($1,$2,'{}','shadow')", [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
);
const testClaim = (
  await db.query(
    "select * from public.claim_delivery($1,$2,'{\"text\":\"frozen-v2\"}','test')",
    [a.id, alice],
  )
).rows[0];
assert.equal(
  testClaim.status,
  "sending",
  "Test is distinct from shadow; no shadow promotion",
);
assert.equal(
  (
    await db.query("select * from public.claim_delivery($1,$2,'{}','test')", [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
  "New lease also blocks duplicates",
);
await db.query(
  "update public.deliveries set status='failed',lease_until=null where id=$1",
  [testClaim.id],
);
const upgradeRetry = (
  await db.query(
    "select * from public.claim_delivery($1,$2,'{\"text\":\"changed-v2\"}','test')",
    [a.id, alice],
  )
).rows[0];
assert.deepEqual(
  upgradeRetry.payload,
  testClaim.payload,
  "Upgraded outbox preserves frozen provider body too",
);
await db.exec("reset role");
await asUser(
  alice,
  "select * from public.manage_subscription('email_off',false)",
);
await db.exec("set role service_role");
await db.query(
  "update public.deliveries set status='failed',lease_until=null where id=$1",
  [testClaim.id],
);
assert.equal(
  (
    await db.query("select * from public.claim_delivery($1,$2,'{}','test')", [
      a.id,
      alice,
    ])
  ).rows.length,
  0,
);
assert.equal(
  (
    await db.query("select status from public.deliveries where id=$1", [
      testClaim.id,
    ])
  ).rows[0].status,
  "skipped",
  "Revocation cancels retries",
);
await db.exec("reset role");
assert.equal(
  (await asUser(bob, "select * from public.deliveries")).rows.length,
  0,
);
assert.equal((await asUser(bob, "select * from public.alerts")).rows.length, 0);
await assert.rejects(
  () => asUser(alice, "select * from public.monitor_runs"),
  /permission denied/,
);
await asUser(alice, "select * from public.manage_subscription('cancel',false)");
const canceled = (await asUser(alice, "select * from public.subscriptions"))
  .rows[0];
assert.equal(canceled.active, false);
assert.equal(canceled.email_enabled, false);
await db.exec("set role anon");
await assert.rejects(
  () => db.query("select * from public.manage_subscription('subscribe',true)"),
  /permission denied/,
);
await db.exec("reset role");
await db.close();
console.log(
  "Database checks passed: RLS isolation, privileged RPC, event deduplication, lease, frozen retries, quarantine, unsubscribe.",
);
