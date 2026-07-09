const prisma = require('../config/db');

exports.getOrders = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const supplierId = req.user.supplier_id;

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        deleted_at: null,
        ...(isSupplier && { supplier_id: supplierId }),
      },
      include: {
        supplier: {
          select: { id: true, name: true, supplier_code: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, product_code: true, unit: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    // Only SUPER_ADMIN or ADMIN will create an order
    const { product_id, quantity, rate, remarks } = req.body;

    // Fetch product to ensure it exists and get supplier
    const product = await prisma.product.findUnique({
      where: { id: parseInt(product_id) }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const totalAmount = parseFloat(rate) * parseInt(quantity);
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        po_number: poNumber,
        supplier_id: product.supplier_id,
        date: new Date(),
        status: 'SENT',
        total_amount: totalAmount,
        remarks: remarks || '',
        items: {
          create: [
            {
              product_id: product.id,
              quantity: parseInt(quantity),
              rate: parseFloat(rate),
              amount: totalAmount
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

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
    // Superadmin can set to COMPLETED. Supplier can set to ACCEPTED or REJECTED.
    const allowedSupplierStatuses = ['ACCEPTED', 'REJECTED'];
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

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
