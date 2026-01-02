import prisma from '../../../builders/database/prismaBuilder.js';
import SystemCodes from '../../../enums/SystemCodes.js';

class OrderSyncBatchModel {
  /**
   * Find sync batches by query
   */
  async find(query = {}) {
    const where = this._buildWhereClause(query);
    const batches = await prisma.syncBatch.findMany({
      where,
      include: {
        tenant: true,
        failedOrders: true,
        successOrders: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return batches.map(b => this._transformToMongoFormat(b));
  }

  /**
   * Find one sync batch
   */
  async findOne(query) {
    const where = this._buildWhereClause(query);
    const batch = await prisma.syncBatch.findFirst({
      where,
      include: {
        tenant: true,
        failedOrders: true,
        successOrders: true,
      },
    });

    if (!batch) return null;

    return this._transformToMongoFormat(batch);
  }

  /**
   * Create sync batch
   */
  async create(data) {
    const normalized = this._normalizeFromMongoFormat(data);
    
    const batch = await prisma.syncBatch.create({
      data: normalized,
      include: {
        tenant: true,
        failedOrders: true,
        successOrders: true,
      },
    });

    return this._transformToMongoFormat(batch);
  }

  /**
   * Delete many sync batches
   */
  async deleteMany(query) {
    const where = this._buildWhereClause(query);
    const result = await prisma.syncBatch.deleteMany({
      where,
    });

    return { acknowledged: true, deletedCount: result.count };
  }

  /**
   * Build where clause from MongoDB-style query
   */
  _buildWhereClause(query) {
    const where = {};

    if (query._id || query.id) {
      where.id = query._id || query.id;
    }

    if (query.tenant) {
      where.tenantId = typeof query.tenant === 'object' ? query.tenant._id || query.tenant.id : query.tenant;
    }

    if (query.process) {
      where.process = query.process;
    }

    if (query.traceId) {
      where.traceId = query.traceId;
    }

    return where;
  }

  /**
   * Normalize MongoDB format to Prisma format
   */
  _normalizeFromMongoFormat(data) {
    const normalized = {
      process: data.process,
      requestStartDate: data.request?.startDate || null,
      requestEndDate: data.request?.endDate || null,
      requestOrderNumberList: data.request?.orderNumberList || [],
      total: data.numbers?.total || null,
      createOrderTotal: data.numbers?.createOrderTotal || null,
      createOrderSuccess: data.numbers?.createOrderSuccess || null,
      createOrderError: data.numbers?.createOrderError || null,
      createOrderSkippedTotal: data.numbers?.createOrderSkippedTotal || null,
      createOrderSkippedAlreadySynced: data.numbers?.createOrderSkippedAlreadySynced || null,
      createOrderSkippedFailed: data.numbers?.createOrderSkippedFailed || null,
      cancelOrderTotal: data.numbers?.cancelOrderTotal || null,
      cancelOrderSuccess: data.numbers?.cancelOrderSuccess || null,
      cancelOrderError: data.numbers?.cancelOrderError || null,
      cancelOrderSkippedTotal: data.numbers?.cancelOrderSkippedTotal || null,
      cancelOrderSkippedAlreadySynced: data.numbers?.cancelOrderSkippedAlreadySynced || null,
      cancelOrderSkippedFailed: data.numbers?.cancelOrderSkippedFailed || null,
      cancelOrderSkippedNotFound: data.numbers?.cancelOrderSkippedNotFound || null,
      isErrorLogExistsForBatch: data.isErrorLogExistsForThisBatch || null,
      traceId: data.traceId,
    };

    if (data.tenant) {
      normalized.tenantId = typeof data.tenant === 'object' ? data.tenant._id || data.tenant.id : data.tenant;
    }

    return normalized;
  }

  /**
   * Transform Prisma format to MongoDB-like format
   */
  _transformToMongoFormat(batch) {
    return {
      _id: batch.id,
      id: batch.id,
      request: {
        startDate: batch.requestStartDate,
        endDate: batch.requestEndDate,
        orderNumberList: batch.requestOrderNumberList,
      },
      numbers: {
        total: batch.total,
        createOrderTotal: batch.createOrderTotal,
        createOrderSuccess: batch.createOrderSuccess,
        createOrderError: batch.createOrderError,
        createOrderSkippedTotal: batch.createOrderSkippedTotal,
        createOrderSkippedAlreadySynced: batch.createOrderSkippedAlreadySynced,
        createOrderSkippedFailed: batch.createOrderSkippedFailed,
        cancelOrderTotal: batch.cancelOrderTotal,
        cancelOrderSuccess: batch.cancelOrderSuccess,
        cancelOrderError: batch.cancelOrderError,
        cancelOrderSkippedTotal: batch.cancelOrderSkippedTotal,
        cancelOrderSkippedAlreadySynced: batch.cancelOrderSkippedAlreadySynced,
        cancelOrderSkippedFailed: batch.cancelOrderSkippedFailed,
        cancelOrderSkippedNotFound: batch.cancelOrderSkippedNotFound,
      },
      isErrorLogExistsForThisBatch: batch.isErrorLogExistsForBatch,
      process: batch.process,
      tenant: batch.tenant ? {
        _id: batch.tenant.id,
        id: batch.tenant.id,
      } : batch.tenantId,
      traceId: batch.traceId,
      createdAt: batch.createdAt,
    };
  }
}

// Export singleton instance
export default new OrderSyncBatchModel();

