const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const activityLogs = await prisma.activityLog.findMany({
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: {
        created_at: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const total = await prisma.activityLog.count();

    res.json({
      success: true,
      data: activityLogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Activity Logs Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteActivityLog = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await prisma.activityLog.findUnique({
      where: { id: parseInt(id) }
    });

    if (!log) {
      return res.status(404).json({ success: false, message: 'Activity log not found' });
    }

    await prisma.activityLog.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Activity log deleted successfully' });
  } catch (error) {
    console.error('Delete Activity Log Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getActivityLogs,
  deleteActivityLog
};
