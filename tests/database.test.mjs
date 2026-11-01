import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("instant signup, ratings, parking fees and access policies", async () => {
  const db = new PGlite();
  const admin = "10000000-0000-0000-0000-000000000001";
  const employee = "10000000-0000-0000-0000-000000000002";
  const pending = "10000000-0000-0000-0000-000000000003";
  const place = "20000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/002_instant_signup_ratings.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/003_optional_address.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/004_account_login.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/005_likes.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/007_kpi.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/008_place_photo.sql", import.meta.url),
        "utf8",
      ),
    );
    const accounts = [
      [admin, "Admin", "Seoul office"],
      [employee, "employee1", "Ulsan Plant"],
      [pending, "pending1", "Yosu Plant"],
    ];
    for (const [id, account, department] of accounts) {
      await db.query("insert into auth.users values ($1, $2, $3)", [
        id,
        `${account.toLowerCase()}@accounts.test`,
        JSON.stringify({
          account,
          name: account,
          department,
          role: "admin",
          approved: false,
        }),
      ]);
    }
    assert.deepEqual(
      (
        await db.query(
          "select role, approved from profiles where id = any($1::uuid[])",
          [[admin, employee]],
        )
      ).rows.map((row) => row.role),
      ["admin", "member"],
    );
    await assert.rejects(
      db.query(
        "insert into auth.users values (gen_random_uuid(), 'x@accounts.test', $1)",
        [JSON.stringify({ account: "ADMIN", name: "Copy" })],
      ),
      /profiles_account_key/,
    );
    await assert.rejects(
      db.query(
        "insert into auth.users values (gen_random_uuid(), 'y@accounts.test', $1)",
        [JSON.stringify({ account: "a", name: "Short" })],
      ),
      /Invalid account/,
    );
    await assert.rejects(
      db.query(
        "insert into auth.users values (gen_random_uuid(), 'z@accounts.test', $1)",
        [
          JSON.stringify({
            account: "valid1",
            name: "Office",
            department: "Other",
          }),
        ],
      ),
      /profiles_office_valid/,
    );
    async function asUser(id, callback) {
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        id,
      ]);
      try {
        return await callback();
      } finally {
        await db.exec("reset role");
      }
    }
    await asUser(admin, () =>
      db.query("select set_employee_approval($1, false)", [pending]),
    );
    await asUser(employee, async () => {
      await assert.rejects(
        db.query("select set_employee_approval($1, true)", [pending]),
        /Administrator access required/,
      );
      await assert.rejects(
        db.query("update profiles set role='admin' where id=$1", [employee]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into places (author_id,name,category,address,note,lat,lng) values ($1,'Forged','restaurant','Address','Note',37,127)",
          [admin],
        ),
        /row-level security/,
      );
      await db.query(
        "insert into places (id,author_id,name,category,address,note,lat,lng) values ($1,$2,'Lunch','restaurant','Address','Note',37,127)",
        [place, employee],
      );
      await db.query("update places set note='Updated' where id=$1", [place]);
      await assert.rejects(
        db.query("update places set author_id=$1 where id=$2", [admin, place]),
        /permission denied/,
      );
      await db.query(
        "insert into comments (place_id,author_id,body) values ($1,$2,'Good food')",
        [place, employee],
      );
      await db.query(
        "insert into places (author_id,name,category,address,note,lat,lng) values ($1,'No address','restaurant','','Note',37,127)",
        [employee],
      );
      await assert.rejects(
        db.query("update places set address=$1 where id=$2", [
          "x".repeat(201),
          place,
        ]),
        /check constraint/,
      );
      assert.equal(
        (
          await db.query(
            "insert into comments (place_id,author_id,body) values ($1,$2,'Delete me') returning id",
            [place, employee],
          )
        ).rows.length,
        1,
      );
      await assert.rejects(
        db.query("update places set hourly_rate=3000 where id=$1", [place]),
        /check constraint/,
      );
      await db.query(
        "update places set category='parking', hourly_rate=3000 where id=$1",
        [place],
      );
      assert.equal(
        (await db.query("select hourly_rate from places where id=$1", [place]))
          .rows[0].hourly_rate,
        3000,
      );
      await assert.rejects(
        db.query("update places set hourly_rate=-1 where id=$1", [place]),
        /check constraint/,
      );
      await assert.rejects(
        db.query("insert into ratings values ($1,$2,6)", [place, employee]),
        /check constraint/,
      );
      await assert.rejects(
        db.query("insert into ratings values ($1,$2,5)", [place, admin]),
        /row-level security/,
      );
      await db.query("insert into ratings values ($1,$2,4)", [place, employee]);
      await assert.rejects(
        db.query("insert into ratings values ($1,$2,5)", [place, employee]),
        /duplicate key/,
      );
      await db.query(
        "insert into ratings values ($1,$2,5) on conflict (place_id,author_id) do update set score=excluded.score",
        [place, employee],
      );
      assert.deepEqual((await db.query("select score from ratings")).rows, [
        { score: 5 },
      ]);
      await assert.rejects(
        db.query("insert into likes (place_id,author_id) values ($1,$2)", [
          place,
          admin,
        ]),
        /row-level security/,
      );
      await db.query("insert into likes (place_id,author_id) values ($1,$2)", [
        place,
        employee,
      ]);
      await assert.rejects(
        db.query("insert into likes (place_id,author_id) values ($1,$2)", [
          place,
          employee,
        ]),
        /duplicate key/,
      );
    });
    await asUser(pending, async () => {
      assert.equal((await db.query("select * from places")).rows.length, 0);
      assert.equal((await db.query("select * from comments")).rows.length, 0);
      assert.equal((await db.query("select * from ratings")).rows.length, 0);
      assert.equal((await db.query("select * from likes")).rows.length, 0);
      assert.equal((await db.query("select * from profiles")).rows.length, 1);
      await assert.rejects(
        db.query(
          "insert into places (author_id,name,category,address,note,lat,lng) values ($1,'Blocked','parking','Address','Note',37,127)",
          [pending],
        ),
        /row-level security/,
      );
    });
    await asUser(admin, () =>
      db.query("select set_employee_approval($1, true)", [pending]),
    );
    await asUser(pending, async () => {
      assert.equal(
        (
          await db.query(
            "delete from comments where author_id=$1 returning id",
            [employee],
          )
        ).rows.length,
        0,
      );
      assert.equal((await db.query("select * from places")).rows.length, 2);
      assert.equal(
        (
          await db.query(
            "update ratings set score=1 where author_id=$1 returning score",
            [employee],
          )
        ).rows.length,
        0,
      );
      await db.query("insert into ratings values ($1,$2,3)", [place, pending]);
      assert.equal(
        (await db.query("select count(*)::integer as count from ratings"))
          .rows[0].count,
        2,
      );
      assert.equal(
        (
          await db.query(
            "delete from likes where author_id=$1 returning place_id",
            [employee],
          )
        ).rows.length,
        0,
      );
      await db.query("insert into likes (place_id,author_id) values ($1,$2)", [
        place,
        pending,
      ]);
      assert.equal(
        (await db.query("select count(*)::integer as count from likes")).rows[0]
          .count,
        2,
      );
      await db.query("delete from likes where author_id=$1", [pending]);
      assert.equal(
        (
          await db.query(
            "update places set note='Unauthorized' where id=$1 returning id",
            [place],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await db.query("delete from places where id=$1 returning id", [place]))
          .rows.length,
        0,
      );
    });
    await asUser(employee, async () => {
      await db.query(
        "insert into usage_logs (place_id, author_id, actual_fee, usual_fee) values ($1,$2,0,6000)",
        [place, employee],
      );
      await assert.rejects(
        db.query(
          "insert into usage_logs (place_id, author_id) values ($1,$2)",
          [place, admin],
        ),
        /row-level security/,
      );
      assert.equal((await db.query("select * from usage_logs")).rows.length, 1);
      await db.query(
        "insert into parking_surveys (author_id, phase, monthly_fee) values ($1,'baseline',100000)",
        [employee],
      );
      assert.equal(
        (await db.query("select * from survey_summary()")).rows[0].avg_fee,
        null,
      );
      await assert.rejects(
        db.query(
          "insert into kpi_targets (key, value) values ('monthly_usage', 10)",
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query("update places set fee_per_30min = -1 where id=$1", [place]),
        /places_fee_valid/,
      );
      await assert.rejects(
        db.query(
          "update places set photo_path = 'http://x/y.jpg' where id=$1",
          [place],
        ),
        /places_photo_path_valid/,
      );
      const photo = `${employee}/${place}.jpg`;
      await db.query("update places set photo_path = $2 where id=$1", [
        place,
        photo,
      ]);
      await db.query("update profiles set avatar_path = $2 where id=$1", [
        employee,
        photo,
      ]);
      const others = await db.query(
        "update profiles set avatar_path = $2 where id=$1",
        [admin, photo],
      );
      assert.equal(others.affectedRows, 0);
    });
    await asUser(admin, () =>
      db.query(
        "insert into kpi_targets (key, value) values ('monthly_usage', 10)",
      ),
    );
    await asUser(admin, () =>
      db.query("select set_employee_approval($1, false)", [employee]),
    );
    await asUser(employee, async () => {
      assert.equal((await db.query("select * from places")).rows.length, 0);
    });
    await asUser(admin, async () => {
      await db.query("delete from places where id=$1", [place]);
      assert.equal((await db.query("select * from comments")).rows.length, 0);
      assert.equal((await db.query("select * from ratings")).rows.length, 0);
    });
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from places"), /permission denied/);
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
