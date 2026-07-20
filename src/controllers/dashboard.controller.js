const prisma = require('../config/db');

exports.getStats = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const supplierId = req.user.supplier_id;

    // Build independent queries based on role
    const [totalSuppliers, totalProducts, totalOrders, pendingProducts, pendingOrders, recentMessages] = await Promise.all([
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

      // Pending Orders
      prisma.purchaseOrder.count({
        where: {
          deleted_at: null,
          status: 'SENT',
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

    const supplierBreakdown = !isSupplier ? await prisma.supplier.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        products: {
          where: { deleted_at: null },
          select: {
            id: true
          }
        },
        purchase_orders: {
          where: { deleted_at: null },
          select: {
            status: true
          }
        }
      }
    }).then(sups => sups.map(s => {
      const orders = s.purchase_orders || [];
      const completed = orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
      const pending = orders.filter(o => ['SENT', 'ACCEPTED', 'PENDING', 'IN_PRODUCTION', 'DISPATCHED'].includes(o.status)).length;
      const rejected = orders.filter(o => ['REJECTED', 'CANCELLED'].includes(o.status)).length;
      return {
        id: s.id,
        name: s.name,
        productsCount: s.products ? s.products.length : 0,
        completedCount: completed,
        pendingCount: pending,
        rejectedCount: rejected,
        totalOrders: orders.length
      };
    })) : [];

    res.status(200).json({
      success: true,
      data: {
        totalSuppliers,
        totalProducts,
        totalOrders,
        pendingProducts,
        pendingOrders,
        recentMessages,
        supplierBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};
