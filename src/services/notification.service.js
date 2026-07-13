const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIo } = require('./socket.service');
const { admin, isInitialized } = require('../config/firebase');

/**
 * Sends a notification to a specific user via WebSocket and FCM.
 * Also logs it in the Notifications table.
 */
const sendNotificationToUser = async (userId, title, message, type) => {
  try {
    // 1. Save to DB
    const notification = await prisma.notification.create({
      data: {
        user_id: userId,
        title,
        message,
        type,
        is_read: false
      }
    });

    // 2. Send via WebSocket (if user is online)
    try {
      const io = getIo();
      io.to(`user_${userId}`).emit('new_notification', notification);
    } catch (e) {
      console.warn('Socket emit failed (socket not initialized or other error):', e.message);
    }

    // 3. Send via FCM (if configured and user has token)
    if (isInitialized) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcm_token: true }
      });

      if (user && user.fcm_token) {
        const payload = {
          notification: {
            title,
            body: message,
          },
          webpush: {
            notification: {
              icon: '/images/kannan_silks_logo.png'
            }
          },
          data: {
            type,
            notificationId: String(notification.id)
          },
          token: user.fcm_token
        };

        admin.messaging().send(payload)
          .then((response) => {
            console.log('Successfully sent FCM message:', response);
          })
          .catch((error) => {
            console.error('Error sending FCM message:', error);
          });
      }
    }

    return notification;
  } catch (error) {
    console.error('Error sending notification to user:', error);
    throw error;
  }
};

/**
 * Sends a notification to all users belonging to a specific supplier.
 */
const sendNotificationToSupplier = async (supplierId, title, message, type) => {
  try {
    const supplierUsers = await prisma.user.findMany({
      where: {
        supplier_id: supplierId,
        status: 'ACTIVE'
      }
    });

    const notifications = await Promise.all(
      supplierUsers.map(user => 
        sendNotificationToUser(user.id, title, message, type)
      )
    );

    return notifications;
  } catch (error) {
    console.error('Error sending notification to supplier:', error);
    throw error;
  }
};

/**
 * Sends a notification to all admins.
 */
const sendNotificationToAdmins = async (title, message, type) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          name: { in: ['SUPER_ADMIN', 'ADMIN'] }
        },
        status: 'ACTIVE'
      }
    });

    const notifications = await Promise.all(
      admins.map(adminUser => 
        sendNotificationToUser(adminUser.id, title, message, type)
      )
    );

    return notifications;
  } catch (error) {
    console.error('Error sending notification to admins:', error);
    throw error;
  }
};

module.exports = {
  sendNotificationToUser,
  sendNotificationToAdmins,
  sendNotificationToSupplier
};
