import prisma from '../../../builders/database/prismaBuilder.js';

class SyncBatchLogModel {
  /**
   * Find all logs for a batch
   */
  async findByBatchId(syncBatchId) {
    return prisma.syncBatchLog.findMany({
      where: { syncBatchId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export default new SyncBatchLogModel();
