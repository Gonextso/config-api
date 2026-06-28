import prisma from '../../../builders/database/prismaBuilder.js';

class NotificationModel {
  /**
   * List all notifications, newest first
   */
  async findAll() {
    const notifications = await prisma.systemNotification.findMany({
      include: {
        tenants: { select: { tenantId: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notifications.map(n => this._transform(n));
  }

  /**
   * Find notification by ID
   */
  async findById(id) {
    const notification = await prisma.systemNotification.findUnique({
      where: { id },
      include: {
        tenants: { select: { tenantId: true } },
      },
    });

    if (!notification) return null;

    return this._transform(notification);
  }

  /**
   * Create a notification.
   * Only one notification can be active globally: activating this one
   * deactivates any other active notification in the same transaction.
   */
  async create(data) {
    const tenantIds = data.showToAll ? [] : (data.tenantIds ?? []);

    const notification = await prisma.$transaction(async (tx) => {
      if (data.isActive === true) {
        await tx.systemNotification.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      return tx.systemNotification.create({
        data: {
          title: data.title,
          message: data.message,
          tone: data.tone ?? 'info',
          isActive: data.isActive === true,
          showToAll: data.showToAll === true,
          tenants: {
            create: tenantIds.map((tenantId) => ({ tenantId })),
          },
        },
        include: {
          tenants: { select: { tenantId: true } },
        },
      });
    });

    return this._transform(notification);
  }

  /**
   * Update a notification (partial patch).
   * Enforces the single-active rule; replaces tenant targets when
   * tenantIds is provided or showToAll is switched on.
   */
  async update(id, patch) {
    const data = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.message !== undefined) data.message = patch.message;
    if (patch.tone !== undefined) data.tone = patch.tone;
    if (patch.isActive !== undefined) data.isActive = patch.isActive === true;
    if (patch.showToAll !== undefined) data.showToAll = patch.showToAll === true;

    const replaceTargets = Array.isArray(patch.tenantIds) || patch.showToAll === true;
    const tenantIds = patch.showToAll === true ? [] : (patch.tenantIds ?? []);

    const notification = await prisma.$transaction(async (tx) => {
      if (patch.isActive === true) {
        await tx.systemNotification.updateMany({
          where: { isActive: true, NOT: { id } },
          data: { isActive: false },
        });
      }

      if (replaceTargets) {
        await tx.systemNotificationTenant.deleteMany({
          where: { notificationId: id },
        });
        data.tenants = {
          create: tenantIds.map((tenantId) => ({ tenantId })),
        };
      }

      return tx.systemNotification.update({
        where: { id },
        data,
        include: {
          tenants: { select: { tenantId: true } },
        },
      });
    });

    return this._transform(notification);
  }

  /**
   * Delete a notification (join rows cascade)
   */
  async deleteOne(id) {
    await prisma.systemNotification.delete({ where: { id } });
    return { acknowledged: true };
  }

  /**
   * Active notification visible to a tenant (show_to_all or targeted)
   */
  async findActiveForTenant(tenantId) {
    const notification = await prisma.systemNotification.findFirst({
      where: {
        isActive: true,
        OR: [
          { showToAll: true },
          { tenants: { some: { tenantId } } },
        ],
      },
      select: {
        id: true,
        title: true,
        message: true,
        tone: true,
      },
    });

    return notification ?? null;
  }

  _transform(notification) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      tone: notification.tone,
      isActive: notification.isActive,
      showToAll: notification.showToAll,
      tenantIds: (notification.tenants ?? []).map((t) => t.tenantId),
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}

// Export singleton instance
export default new NotificationModel();
