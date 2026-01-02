import prisma from '../../../builders/database/prismaBuilder.js';

class RequestLogModel {
  /**
   * Find request logs by query
   */
  async find(query = {}) {
    const where = this._buildWhereClause(query);
    const logs = await prisma.requestLog.findMany({
      where,
      include: {
        tenant: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return logs.map(l => this._transformToMongoFormat(l));
  }

  /**
   * Find one request log
   */
  async findOne(query) {
    const where = this._buildWhereClause(query);
    const log = await prisma.requestLog.findFirst({
      where,
      include: {
        tenant: true,
      },
    });

    if (!log) return null;

    return this._transformToMongoFormat(log);
  }

  /**
   * Create request log
   */
  async create(data) {
    const normalized = this._normalizeFromMongoFormat(data);
    
    const log = await prisma.requestLog.create({
      data: normalized,
      include: {
        tenant: true,
      },
    });

    return this._transformToMongoFormat(log);
  }

  /**
   * Delete many request logs
   */
  async deleteMany(query) {
    const where = this._buildWhereClause(query);
    const result = await prisma.requestLog.deleteMany({
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

    if (query.requestId) {
      where.requestId = query.requestId;
    }

    if (query.traceId) {
      where.traceId = query.traceId;
    }

    if (query.method) {
      where.method = query.method;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    return where;
  }

  /**
   * Normalize MongoDB format to Prisma format
   */
  _normalizeFromMongoFormat(data) {
    const normalized = {
      requestId: data.requestId || null,
      method: data.method || null,
      url: data.url || null,
      body: data.body || null,
      headers: data.headers || null,
      status: data.status || null,
      responseTime: data.responseTime || null,
      response: data.response || null,
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
  _transformToMongoFormat(log) {
    return {
      _id: log.id,
      id: log.id,
      tenant: log.tenant ? {
        _id: log.tenant.id,
        id: log.tenant.id,
      } : log.tenantId,
      requestId: log.requestId,
      method: log.method,
      url: log.url,
      body: log.body,
      headers: log.headers,
      status: log.status,
      responseTime: log.responseTime,
      response: log.response,
      traceId: log.traceId,
      createdAt: log.createdAt,
    };
  }
}

// Export singleton instance
export default new RequestLogModel();

