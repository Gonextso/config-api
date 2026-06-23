import { execSync } from "node:child_process";

const run = (command, options = {}) => {
    execSync(command, {
        stdio: "inherit",
        env: process.env,
        ...options,
    });
};

const runCapture = command => {
    try {
        return execSync(command, {
            encoding: "utf8",
            env: process.env,
        });
    } catch (error) {
        const output = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
        const wrapped = new Error(output || "Prisma command failed");
        wrapped.cause = error;
        throw wrapped;
    }
};

const deployMigrations = () => {
    const output = runCapture("npx prisma migrate deploy");
    if (output) {
        process.stdout.write(output);
    }
};

const pushSchema = () => {
    run("npx prisma db push --skip-generate");
};

const generateClient = () => {
    run("npx prisma generate");
};

const shouldFallbackToDbPush = error => {
    const output = String(error?.message ?? "");

    return /P3005/i.test(output)
        || /not empty/i.test(output)
        || /_prisma_migrations/i.test(output)
        || /migration.*failed/i.test(output);
};

try {
    deployMigrations();
} catch (error) {
    if (!shouldFallbackToDbPush(error)) {
        if (error?.message) {
            process.stderr.write(`${error.message}\n`);
        }
        throw error.cause ?? error;
    }

    console.warn("[prisma-setup] migrate deploy failed on legacy database; falling back to db push.");
    pushSchema();
}

generateClient();
