import prisma from '../../../builders/database/prismaBuilder.js';
import SystemCodes from '../../../enums/SystemCodes.js';

class FailedOrderModel {
  /**
   * Find failed orders by query
   */
  async find(query = {}) {
    const where = this._buildWhereClause(query);
    const orders = await prisma.syncFailedOrder.findMany({
      where,
      include: {
        tenant: true,
        syncBatch: true,
      },
    });

    return orders.map(o => this._transformToMongoFormat(o));
  }

  /**
   * Find one failed order
   */
  async findOne(query) {
    const where = this._buildWhereClause(query);
    const order = await prisma.syncFailedOrder.findFirst({
      where,
      include: {
        tenant: true,
        syncBatch: true,
      },
    });

    if (!order) return null;

    return this._transformToMongoFormat(order);
  }

  /**
   * Create failed order
   */
  async create(data) {
    const normalized = this._normalizeFromMongoFormat(data);
    
    const order = await prisma.syncFailedOrder.create({
      data: normalized,
      include: {
        tenant: true,
        syncBatch: true,
      },
    });

    return this._transformToMongoFormat(order);
  }

  /**
   * Delete many failed orders
   */
  async deleteMany(query) {
    const where = this._buildWhereClause(query);
    const result = await prisma.syncFailedOrder.deleteMany({
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

    if (query.syncBatchId) {
      where.syncBatchId = typeof query.syncBatchId === 'object' ? query.syncBatchId._id || query.syncBatchId.id : query.syncBatchId;
    }

    if (query.shopifyOrderId || query.ecommerceId) {
      where.shopifyOrderId = query.shopifyOrderId || query.ecommerceId;
    }

    if (query.process) {
      where.process = query.process;
    }

    if (query.isCancelled !== undefined) {
      where.isCancelled = query.isCancelled;
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
      shopifyOrderId: data.ecommerceId || data.shopifyOrderId,
      orderData: data.orderData || null,
      reason: data.reason || null,
      process: data.process,
      isCancelled: data.isCancelled ?? false,
      traceId: data.traceId,
    };

    if (data.tenant) {
      normalized.tenantId = typeof data.tenant === 'object' ? data.tenant._id || data.tenant.id : data.tenant;
    }

    if (data.syncBatchId) {
      normalized.syncBatchId = typeof data.syncBatchId === 'object' ? data.syncBatchId._id || data.syncBatchId.id : data.syncBatchId;
    }

    return normalized;
  }

  /**
   * Transform Prisma format to MongoDB-like format
   */
  _transformToMongoFormat(order) {
    return {
      _id: order.id,
      id: order.id,
      shopifyOrderId: order.shopifyOrderId,
      ecommerceId: order.shopifyOrderId, // For backward compatibility
      orderData: order.orderData,
      reason: order.reason,
      process: order.process,
      isCancelled: order.isCancelled,
      tenant: order.tenant ? {
        _id: order.tenant.id,
        id: order.tenant.id,
      } : order.tenantId,
      syncBatchId: order.syncBatch ? {
        _id: order.syncBatch.id,
        id: order.syncBatch.id,
      } : order.syncBatchId,
      traceId: order.traceId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

// Export singleton instance
export default new FailedOrderModel();

