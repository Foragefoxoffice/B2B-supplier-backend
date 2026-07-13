const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.saveFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcm_token: token }
    });

    res.status(200).json({
      success: true,
      message: 'FCM token saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });
    
    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await prisma.notification.updateMany({
      where: { id: parseInt(id), user_id: userId },
      data: { is_read: true }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await prisma.notification.deleteMany({
      where: { id: parseInt(id), user_id: userId }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
