const prisma = require('../config/db');
const bcrypt = require('bcrypt');

exports.getSuppliers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const city = req.query.city || '';

    const skip = (page - 1) * limit;

    const where = {
      deleted_at: null,
      ...(status && { status }),
      ...(city && { city }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { supplier_code: { contains: search } },
          { email: { contains: search } },
        ],
      }),
    };

    // Compute stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      suppliers, 
      total,
      totalSuppliersCount,
      activeSuppliersCount,
      newThisMonthCount,
      purchaseAgg
    ] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.supplier.count({ where }),
      prisma.supplier.count({ where: { deleted_at: null } }),
      prisma.supplier.count({ where: { deleted_at: null, status: 'ACTIVE' } }),
      prisma.supplier.count({ where: { deleted_at: null, created_at: { gte: startOfMonth } } }),
      prisma.purchaseOrder.aggregate({
        _sum: { total_amount: true },
        where: { deleted_at: null }
      })
    ]);

    const totalPurchaseAmount = purchaseAgg._sum.total_amount ? Number(purchaseAgg._sum.total_amount) : 0;

    res.status(200).json({
      success: true,
      count: suppliers.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSuppliers: totalSuppliersCount,
        activeSuppliers: activeSuppliersCount,
        newThisMonth: newThisMonthCount,
        totalPurchase: totalPurchaseAmount
      },
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        products: true,
        documents: true,
      },
    });

    if (!supplier || supplier.deleted_at) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const data = req.body;
    
    // Generate simple supplier code
    const count = await prisma.supplier.count();
    data.supplier_code = `SUP-${String(count + 1).padStart(4, '0')}`;

    // Fetch the SUPPLIER role id
    const supplierRole = await prisma.role.findUnique({ where: { name: 'SUPPLIER' } });
    if (!supplierRole) {
      return res.status(400).json({ success: false, message: 'Supplier role not configured in DB' });
    }

    // Check if email already exists in users or suppliers
    const existingSupplier = await prisma.supplier.findUnique({ where: { email: data.email } });
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

    if (existingSupplier || existingUser) {
      return res.status(400).json({ success: false, message: 'A user or supplier with this email already exists.' });
    }

    // Hash default password
    const hashedPassword = await bcrypt.hash('Supplier@123', 10);

    // Use a transaction to ensure both Supplier and User are created atomically
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data,
      });

      // Split name for first and last name (basic fallback logic)
      const nameParts = data.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Supplier';

      const user = await tx.user.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          email: data.email, // Supplier login email
          password: hashedPassword,
          phone: data.phone,
          role_id: supplierRole.id,
          supplier_id: supplier.id,
        }
      });

      return supplier;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    let supplier = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });

    if (!supplier || supplier.deleted_at) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });

    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });

    if (!supplier || supplier.deleted_at) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
};
