// Run with: node --test scripts/schedule-regression.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

// Never load application dependencies, credentials, or real network clients.
function loadModule(path, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const exports = {};
  const requireMock = (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unmocked import: ${name}`);
    return imports[name];
  };
  new Function("exports", "require", transpile(source, path))(exports, requireMock);
  return exports;
}

const { formatDate } = loadModule("src/lib/admin/format.ts");
const timeZones = ["UTC", "America/Los_Angeles", "Asia/Makassar", "Pacific/Kiritimati"];

for (const timeZone of timeZones) {
  test(`formatDate preserves calendar dates in ${timeZone}`, (t) => {
    const previous = process.env.TZ;
    t.after(() => {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    });
    process.env.TZ = timeZone;
    assert.equal(formatDate("2026-11-04"), "04 Nov 2026");
    assert.equal(formatDate("2026-11-07"), "07 Nov 2026");
  });

  test(`formatDate keeps timestamps and Date objects local in ${timeZone}`, (t) => {
    const previous = process.env.TZ;
    t.after(() => {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    });
    process.env.TZ = timeZone;
    const local = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric", timeZone,
    });
    // Exercise both backward and forward date rollover, plus Date-only objects.
    for (const value of ["2026-11-04T00:30:00Z", "2026-11-07T23:30:00Z"]) {
      const date = new Date(value);
      assert.equal(formatDate(value), local.format(date));
      assert.equal(formatDate(date), local.format(date));
    }
    const date = new Date("2026-11-04");
    assert.equal(formatDate(date), local.format(date));
  });
}

test("formatDate preserves empty-value behavior", () => {
  for (const value of [null, undefined, ""]) assert.equal(formatDate(value), "-");
});

// Extract the actual closure without rendering React or running component effects.
const clientPath = "src/app/admin/(panel)/schedule/ScheduleClient.tsx";
const clientSource = ts.createSourceFile(
  clientPath,
  readFileSync(new URL(`../${clientPath}`, import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const component = clientSource.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "ScheduleClient",
);
const saveNode = component?.body?.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "save",
);
assert.ok(saveNode, "ScheduleClient.save must exist");
const saveCode = transpile(saveNode.getText(clientSource), "save.ts");

for (const editingId of ["existing-task", null]) {
  test(`ScheduleClient.save ${editingId ? "PATCHes an edit with its id" : "POSTs a create without an id"}`, async (t) => {
    const fetchMock = t.mock.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, id: editingId ?? "new-task" }),
    }));
    const dependencies = {
      editingId,
      form: {
        title: "  Regression task  ", description: "  Updated details  ",
        due_date: "2026-11-07", priority: "high", project_id: "",
        assigned_to: "42", recurrence_rule: "",
      },
      fetch: fetchMock,
      setError: t.mock.fn(), setSaving: t.mock.fn(), setShowForm: t.mock.fn(),
      showError: (message) => assert.fail(message), showSuccess: t.mock.fn(),
      googleConnected: false,
      syncToGoogle: () => assert.fail("Unexpected Google sync"),
      router: { refresh: t.mock.fn() },
    };
    const save = new Function(
      ...Object.keys(dependencies), `${saveCode}\nreturn save;`,
    )(...Object.values(dependencies));
    const preventDefault = t.mock.fn();
    await save({ preventDefault });

    assert.equal(preventDefault.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, "/api/admin/tasks");
    assert.equal(options.method, editingId ? "PATCH" : "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), {
      ...(editingId ? { id: editingId } : {}),
      title: "Regression task", description: "Updated details", due_date: "2026-11-07",
      priority: "high", project_id: null, assigned_to: 42, recurrence_rule: null,
    });
    assert.deepEqual(dependencies.setSaving.mock.calls.map(({ arguments: args }) => args[0]), [true, false]);
    assert.deepEqual(dependencies.setShowForm.mock.calls[0].arguments, [false]);
    assert.equal(dependencies.router.refresh.mock.callCount(), 1);
  });
}

test("tasks API PATCH updates only the existing task and never inserts", async (t) => {
  const original = {
    id: "existing-task", title: "Original", due_date: "2026-11-04",
    status: "active", gcal_event_id: null,
  };
  const untouched = { id: "other-task", title: "Leave alone", due_date: "2026-11-04" };
  const rows = [{ ...original }, { ...untouched }];
  const update = t.mock.fn((changes) => ({
    eq: async (column, id) => {
      assert.equal(column, "id");
      assert.equal(id, original.id);
      Object.assign(rows.find((row) => row.id === id), changes);
      return { error: null };
    },
  }));
  const database = {
    from(table) {
      assert.equal(table, "tasks");
      return {
        select: () => ({
          eq: (column, id) => {
            assert.equal(column, "id");
            return { single: async () => ({ data: { ...rows.find((row) => row.id === id) } }) };
          },
        }),
        update,
        insert: () => assert.fail("PATCH must not insert a task"),
      };
    },
  };
  const auditMutation = t.mock.fn(async () => true);
  const { PATCH } = loadModule("src/app/api/admin/tasks/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/utils/admin": { requireAdmin: async () => ({ id: "mock-admin" }) },
    "@/utils/supabase/admin": { createAdminClient: () => database },
    "@/lib/admin/gcal": {
      getAuthorizedClient: async () => null,
      createGcalEvent: () => assert.fail("Unexpected Google event creation"),
      updateGcalEvent: () => assert.fail("Unexpected Google event update"),
    },
    "@/lib/admin/audit": {
      auditMutation,
      createNotification: () => assert.fail("Unexpected notification"),
    },
  });
  const response = await PATCH(new Request("https://example.invalid/api/admin/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: original.id, title: "  Updated  ", due_date: "2026-11-07" }),
  }));

  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(update.mock.callCount(), 1);
  assert.deepEqual(rows, [{ ...original, title: "Updated", due_date: "2026-11-07" }, untouched]);
  assert.equal(auditMutation.mock.callCount(), 1);
  const [audit] = auditMutation.mock.calls[0].arguments;
  assert.equal(audit.action, "update");
  assert.equal(audit.entityId, original.id);
  assert.deepEqual(audit.before, original);
  assert.deepEqual(audit.after, { title: "Updated", due_date: "2026-11-07" });
});
