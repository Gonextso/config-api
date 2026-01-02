import prisma from '../../../builders/database/prismaBuilder.js';

class SuccessOrderModel {
  /**
   * Find success orders by query
   */
  async find(query = {}) {
    const where = this._buildWhereClause(query);
    const orders = await prisma.syncSuccessOrder.findMany({
      where,
      include: {
        tenant: true,
        syncBatch: true,
      },
    });

    return orders.map(o => this._transformToMongoFormat(o));
  }

  /**
   * Find one success order
   */
  async findOne(query) {
    const where = this._buildWhereClause(query);
    const order = await prisma.syncSuccessOrder.findFirst({
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
   * Create success order
   */
  async create(data) {
    const normalized = this._normalizeFromMongoFormat(data);
    
    const order = await prisma.syncSuccessOrder.create({
      data: normalized,
      include: {
        tenant: true,
        syncBatch: true,
      },
    });

    return this._transformToMongoFormat(order);
  }

  /**
   * Delete many success orders
   */
  async deleteMany(query) {
    const where = this._buildWhereClause(query);
    const result = await prisma.syncSuccessOrder.deleteMany({
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

    if (query.nebimOrderId || query.erpId) {
      where.nebimOrderId = query.nebimOrderId || query.erpId;
    }

    if (query.shopifyOrderId || query.ecommerceId) {
      where.shopifyOrderId = query.shopifyOrderId || query.ecommerceId;
    }

    if (query.isCancelled !== undefined) {
      where.isCancelled = query.isCancelled;
    }

    if (query.isShipped !== undefined) {
      where.isShipped = query.isShipped;
    }

    if (query.isPartiallyCancelled !== undefined) {
      where.isPartiallyCancelled = query.isPartiallyCancelled;
    }

    if (query.cleared !== undefined) {
      where.cleared = query.cleared;
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
      nebimOrderId: data.erpId || data.nebimOrderId || null,
      shopifyOrderId: data.ecommerceId || data.shopifyOrderId || null,
      lines: data.lines || null,
      partiallyCancelledLines: data.partiallyCancelledLines || null,
      isCancelled: data.isCancelled ?? false,
      isShipped: data.isShipped ?? false,
      isPartiallyCancelled: data.isPartiallyCancelled ?? false,
      traceId: data.traceId,
      cleared: data.cleared ?? false,
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
      erpId: order.nebimOrderId, // For backward compatibility
      nebimOrderId: order.nebimOrderId,
      ecommerceId: order.shopifyOrderId, // For backward compatibility
      shopifyOrderId: order.shopifyOrderId,
      lines: order.lines,
      partiallyCancelledLines: order.partiallyCancelledLines,
      isCancelled: order.isCancelled,
      isShipped: order.isShipped,
      isPartiallyCancelled: order.isPartiallyCancelled,
      tenant: order.tenant ? {
        _id: order.tenant.id,
        id: order.tenant.id,
      } : order.tenantId,
      syncBatchId: order.syncBatch ? {
        _id: order.syncBatch.id,
        id: order.syncBatch.id,
      } : order.syncBatchId,
      traceId: order.traceId,
      cleared: order.cleared,
      createdAt: order.createdAt,
    };
  }
}

// Export singleton instance
export default new SuccessOrderModel();

