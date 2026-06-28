import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

const run = (command, options = {}) => {
    execSync(command, {
        stdio: "inherit",
        env: process.env,
        ...options,
    });
};

const runCapture = command => {
    try {
        return { ok: true, output: execSync(command, { encoding: "utf8", env: process.env }) };
    } catch (error) {
        return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}`, error };
    }
};

const listMigrationNames = () =>
    readdirSync("prisma/migrations", { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();

/**
 * P3005 means the target database already has a schema but no migration history
 * (e.g. it was originally provisioned via `db push` rather than `migrate deploy`).
 * Baselining only records each migration as applied — it runs no SQL and never
 * touches the schema, so it's safe to do unattended. Any other failure (real
 * drift, a migration that errors mid-run, etc.) is left to fail loudly.
 */
const baselineExistingDatabase = () => {
    console.warn(
        "[prisma-setup] Existing database schema with no migration history detected (P3005). " +
        "Baselining: marking all known migrations as already applied. This only writes " +
        "tracking metadata — it does not execute any SQL or modify the schema.",
    );
    for (const name of listMigrationNames()) {
        run(`npx prisma migrate resolve --applied "${name}"`);
    }
};

const extractFailedMigrationName = output => {
    const match = output.match(/The `([^`]+)` migration started at .+ failed/);
    return match?.[1];
};

/**
 * P3009 means a previous deploy left a migration marked as failed (e.g. the
 * process was killed mid-run, or two services raced to apply the same DDL
 * against a shared database), so Prisma refuses to apply anything further.
 * Since every migration in this project is written with IF NOT EXISTS / IF
 * EXISTS guards, it's safe to mark the failed one as rolled back and retry:
 * the retry is a no-op against whatever already landed and simply continues
 * from there. If the underlying SQL has a real bug, the retry fails again
 * and that error surfaces normally.
 */
const recoverFailedMigration = output => {
    const name = extractFailedMigrationName(output);
    if (!name) {
        return false;
    }

    console.warn(
        `[prisma-setup] Migration "${name}" is marked as failed (P3009). Marking it ` +
        "rolled back and retrying — migrations are written to be idempotent, so a clean " +
        "retry is expected to succeed.",
    );
    run(`npx prisma migrate resolve --rolled-back "${name}"`);
    return true;
};

const deployMigrations = () => {
    let attempt = runCapture("npx prisma migrate deploy");
    if (attempt.ok) {
        process.stdout.write(attempt.output);
        return;
    }

    if (/P3005/.test(attempt.output)) {
        baselineExistingDatabase();
        run("npx prisma migrate deploy");
        return;
    }

    if (/P3009/.test(attempt.output) && recoverFailedMigration(attempt.output)) {
        attempt = runCapture("npx prisma migrate deploy");
        if (attempt.ok) {
            process.stdout.write(attempt.output);
            return;
        }
    }

    process.stderr.write(attempt.output);
    throw attempt.error;
};

const generateClient = () => {
    run("npx prisma generate");
};

deployMigrations();
generateClient();
