import prisma from "../builders/database/prismaBuilder.js";

const STEP_KEYS = ["connection", "validation", "customer", "product", "order"];

const STEP_FIELD_MAP = {
    connection: "stepConnection",
    validation: "stepValidation",
    customer: "stepCustomer",
    product: "stepProduct",
    order: "stepOrder",
};

export function transformSetupToApi(setup) {
    if (!setup) {
        return {
            setupCompleted: false,
            procSetup: false,
            steps: {
                connection: false,
                validation: false,
                customer: false,
                product: false,
                order: false,
            },
        };
    }

    const steps = {
        connection: setup.stepConnection === true,
        validation: setup.stepValidation === true,
        customer: setup.stepCustomer === true,
        product: setup.stepProduct === true,
        order: setup.stepOrder === true,
    };

    return {
        setupCompleted: setup.setupCompleted === true,
        procSetup: setup.stepValidation === true,
        steps,
    };
}

export async function ensureSetupRecord(tenantId) {
    return prisma.tenantSetup.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
    });
}

export async function getSetupForTenant(tenantId) {
    const setup = await prisma.tenantSetup.findUnique({ where: { tenantId } });
    if (!setup) {
        return await ensureSetupRecord(tenantId);
    }
    return setup;
}

export async function markSetupStep(tenantId, stepKey) {
    if (!STEP_KEYS.includes(stepKey)) {
        throw new Error(`Unknown setup step: ${stepKey}`);
    }

    const field = STEP_FIELD_MAP[stepKey];
    const existing = await ensureSetupRecord(tenantId);

    const updated = {
        ...existing,
        [field]: true,
    };

    const setupCompleted =
        updated.stepConnection
        && updated.stepValidation
        && updated.stepCustomer
        && updated.stepProduct
        && updated.stepOrder;

    return prisma.tenantSetup.update({
        where: { tenantId },
        data: {
            [field]: true,
            setupCompleted,
        },
    });
}

export async function resetValidationStep(tenantId) {
    const existing = await ensureSetupRecord(tenantId);
    const setupCompleted =
        existing.stepConnection
        && false
        && existing.stepCustomer
        && existing.stepProduct
        && existing.stepOrder;

    return prisma.tenantSetup.update({
        where: { tenantId },
        data: {
            stepValidation: false,
            setupCompleted: false,
        },
    });
}

export { STEP_KEYS };
