const prisma = require('../config/db');

exports.getStats = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const supplierId = req.user.supplier_id;

    // Build independent queries based on role
    const [totalSuppliers, totalProducts, totalOrders, pendingProducts, recentMessages] = await Promise.all([
      // Only Superadmin cares about total suppliers
      !isSupplier ? prisma.supplier.count({ where: { deleted_at: null } }) : Promise.resolve(0),
      
      // Products count (scoped for supplier)
      prisma.product.count({
        where: {
          deleted_at: null,
          ...(isSupplier && { supplier_id: supplierId }),
        }
      }),

      // Orders count
      prisma.purchaseOrder.count({
        where: {
          deleted_at: null,
          ...(isSupplier && { supplier_id: supplierId }),
        }
      }),

      // Pending Products
      prisma.product.count({
        where: {
          deleted_at: null,
          status: 'PENDING',
          ...(isSupplier && { supplier_id: supplierId }),
        }
      }),

      // Recent Messages
      prisma.message.findMany({
        take: 4,
        orderBy: { created_at: 'desc' },
        where: { receiver_id: req.user.id },
        include: {
          sender: {
            include: { supplier: true }
          }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSuppliers,
        totalProducts,
        totalOrders,
        pendingProducts,
        recentMessages
      }
    });
  } catch (error) {
    next(error);
  }
};
