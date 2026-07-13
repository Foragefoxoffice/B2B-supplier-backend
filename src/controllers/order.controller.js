const prisma = require('../config/db');

exports.getOrders = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const supplierId = req.user.supplier_id;
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const skip = (page - 1) * limit;

    const whereClause = {
      deleted_at: null,
      ...(isSupplier && { supplier_id: supplierId }),
    };

    if (status && status !== 'All Status') {
      if (status === 'Pending') {
        whereClause.status = 'SENT';
      } else if (status === 'Approved') {
        whereClause.status = 'ACCEPTED';
      } else if (status === 'Dispatched') {
        whereClause.status = 'DISPATCHED';
      } else if (status === 'Delivered') {
        whereClause.status = 'COMPLETED';
      } else if (status === 'Cancelled') {
        whereClause.status = 'REJECTED';
      }
    }

    if (search) {
      whereClause.OR = [
        { po_number: { contains: search } },
        { items: { some: { product: { name: { contains: search } } } } }
      ];
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        whereClause.date.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          supplier: { select: { id: true, name: true, supplier_code: true } },
          items: { include: { product: { select: { id: true, name: true, product_code: true, unit: true, images: { select: { url: true, color: true, is_primary: true } } } } } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where: whereClause })
    ]);

    const allOrdersStats = await prisma.purchaseOrder.findMany({
      where: {
        deleted_at: null,
        ...(isSupplier && { supplier_id: supplierId }),
      },
      select: { status: true }
    });

    const stats = {
      total: allOrdersStats.length,
      inProgress: allOrdersStats.filter(o => ['SENT', 'ACCEPTED'].includes(o.status)).length,
      shipped: allOrdersStats.filter(o => o.status === 'DISPATCHED').length,
      delivered: allOrdersStats.filter(o => o.status === 'COMPLETED').length,
      cancelled: allOrdersStats.filter(o => o.status === 'REJECTED').length,
    };

    res.status(200).json({ success: true, data: orders, total, page, limit, stats });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { supplier_id, transporter_id, items, order_given_by, phone_number, remarks } = req.body;
    
    // Support legacy single item payload
    const orderItems = items || [req.body];
    const targetSupplierId = supplier_id || req.body.supplier_id || (orderItems.length > 0 ? (await prisma.product.findUnique({ where: { id: parseInt(orderItems[0].product_id) } }))?.supplier_id : null);

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    let totalAmount = 0;
    const itemsData = [];
    
    // Validate stock and prepare items data
    for (const item of orderItems) {
      const product = await prisma.product.findUnique({ where: { id: parseInt(item.product_id) } });
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.product_id} not found` });
      
      const qty = parseInt(item.quantity);
      if (product.stock < qty) return res.status(400).json({ success: false, message: `Insufficient stock for product ${product.name}` });
      
      const amount = parseFloat(item.rate) * qty;
      totalAmount += amount;
      
      itemsData.push({
        product_id: product.id,
        variant_id: item.variant_id ? parseInt(item.variant_id) : null,
        quantity: qty,
        rate: parseFloat(item.rate),
        amount: amount,
        remarks: item.remarks || ''
      });
    }

    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const operations = [
      prisma.purchaseOrder.create({
        data: {
          po_number: poNumber,
          supplier_id: parseInt(targetSupplierId),
          date: new Date(),
          status: 'SENT',
          total_amount: totalAmount,
          remarks: remarks || (orderItems.length === 1 ? (orderItems[0].remarks || '') : 'Multiple items order'),
          order_given_by: order_given_by || null,
          phone_number: phone_number || null,
          ...(transporter_id && { transporter_id: parseInt(transporter_id) }),
          items: {
            create: itemsData
          }
        },
        include: {
          items: true
        }
      })
    ];

    // Decrement stock for products and variants
    for (const item of itemsData) {
      operations.push(
        prisma.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } }
        })
      );
      if (item.variant_id) {
        operations.push(
          prisma.productImage.update({
            where: { id: item.variant_id },
            data: { quantity: { decrement: item.quantity } }
          })
        );
      }
    }

    const results = await prisma.$transaction(operations);
    const order = results[0];

    const notificationService = require('../services/notification.service');
    notificationService.sendNotificationToSupplier(
      parseInt(targetSupplierId),
      'New Purchase Order',
      `You have received a new Purchase Order (${poNumber}).`,
      'NEW_PO'
    ).catch(err => console.error('Failed to notify supplier of new PO:', err));

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const isSupplier = req.user.role === 'SUPPLIER';
    
    // Determine who can do what.
    const allowedSupplierStatuses = ['ACCEPTED', 'REJECTED', 'DISPATCHED', 'COMPLETED'];
    if (isSupplier && !allowedSupplierStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: 'Supplier cannot transition to this status.' });
    }

    const order = await prisma.purchaseOrder.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status,
        ...(remarks && { remarks })
      }
    });

    if (isSupplier) {
      const notificationService = require('../services/notification.service');
      const supplier = await prisma.supplier.findUnique({ where: { id: req.user.supplier_id } });
      const supplierName = supplier ? supplier.name : 'A supplier';
      
      let title = '';
      let message = '';
      
      if (status === 'ACCEPTED') {
          title = 'Order Approved';
          message = `${supplierName} has approved Order #${order.po_number}`;
      } else if (status === 'REJECTED') {
          title = 'Order Rejected';
          message = `${supplierName} has rejected Order #${order.po_number}`;
      } else if (status === 'DISPATCHED') {
          title = 'Order Dispatched';
          message = `${supplierName} has dispatched Order #${order.po_number}`;
      }

      if (title) {
          notificationService.sendNotificationToAdmins(
              title,
              message,
              'ORDER_UPDATE'
          ).catch(err => console.error('Failed to notify admins of order update:', err));
      }
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const orderId = parseInt(req.params.id);

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (isSupplier && order.supplier_id !== req.user.supplier_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this order' });
    }

    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { deleted_at: new Date() }
    });

    res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};
