const prisma = require('../config/db');

// Get all transporters for a supplier
exports.getTransporters = async (req, res, next) => {
  try {
    const isSupplier = req.user.role === 'SUPPLIER';
    const supplierId = isSupplier ? req.user.supplier_id : parseInt(req.query.supplier_id);

    const whereClause = {};
    if (supplierId) {
      whereClause.supplier_id = supplierId;
    } else if (isSupplier) {
      return res.status(403).json({ success: false, message: 'Supplier ID is required' });
    }

    const transporters = await prisma.transporter.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ success: true, data: transporters });
  } catch (error) {
    next(error);
  }
};

// Create a new transporter
exports.createTransporter = async (req, res, next) => {
  try {
    const { name, contact, address, supplier_id } = req.body;
    const isSupplier = req.user.role === 'SUPPLIER';
    
    const finalSupplierId = isSupplier ? req.user.supplier_id : parseInt(supplier_id);

    if (!finalSupplierId) {
      return res.status(400).json({ success: false, message: 'Supplier ID is required' });
    }

    const transporter = await prisma.transporter.create({
      data: {
        name,
        contact,
        address,
        supplier_id: finalSupplierId
      }
    });

    res.status(201).json({ success: true, data: transporter });
  } catch (error) {
    next(error);
  }
};

// Update a transporter
exports.updateTransporter = async (req, res, next) => {
  try {
    const { name, contact, address } = req.body;
    const transporterId = parseInt(req.params.id);

    const isSupplier = req.user.role === 'SUPPLIER';
    
    // check ownership if supplier
    if (isSupplier) {
      const existing = await prisma.transporter.findUnique({ where: { id: transporterId } });
      if (!existing || existing.supplier_id !== req.user.supplier_id) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this transporter' });
      }
    }

    const transporter = await prisma.transporter.update({
      where: { id: transporterId },
      data: {
        name,
        contact,
        address
      }
    });

    res.status(200).json({ success: true, data: transporter });
  } catch (error) {
    next(error);
  }
};

// Delete a transporter
exports.deleteTransporter = async (req, res, next) => {
  try {
    const transporterId = parseInt(req.params.id);
    const isSupplier = req.user.role === 'SUPPLIER';
    
    // check ownership if supplier
    if (isSupplier) {
      const existing = await prisma.transporter.findUnique({ where: { id: transporterId } });
      if (!existing || existing.supplier_id !== req.user.supplier_id) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this transporter' });
      }
    }

    await prisma.transporter.delete({
      where: { id: transporterId }
    });

    res.status(200).json({ success: true, message: 'Transporter deleted successfully' });
  } catch (error) {
    next(error);
  }
};
