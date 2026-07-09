const prisma = require('../config/db');

exports.getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category_id = req.query.category_id;
    let supplier_id = req.query.supplier_id;
    const status = req.query.status || '';

    // RBAC: If user is a SUPPLIER, force supplier_id to their own
    if (req.user && req.user.role === 'SUPPLIER') {
      supplier_id = req.user.supplier_id;
    }

    const skip = (page - 1) * limit;

    const where = {
      deleted_at: null,
      ...(status && { status }),
      ...(category_id && { category_id: parseInt(category_id) }),
      ...(supplier_id && { supplier_id: parseInt(supplier_id) }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { product_code: { contains: search } }
        ]
      })
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { supplier: true, category: true, images: true },
        orderBy: { created_at: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page, limit, totalPages: Math.ceil(total / limit)
      },
      data: products
    });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    const supplier_id = req.user.role === 'SUPPLIER' ? req.user.supplier_id : parseInt(data.supplier_id);
    
    // Convert to proper types
    const product = await prisma.product.create({
      data: {
        product_code: `PRD-${Date.now()}`,
        name: data.name,
        supplier_id,
        category_id: parseInt(data.category_id),
        sub_category_id: data.sub_category_id ? parseInt(data.sub_category_id) : null,
        description: data.description,
        specification: data.specification,
        unit: data.unit,
        price: parseFloat(data.price),
        moq: parseInt(data.moq),
        stock: data.stock ? parseInt(data.stock) : 0,
        status: 'PENDING'
      }
    });

    // Handle images if any
    if (req.files && req.files.length > 0) {
      const imageRecords = req.files.map((file, index) => ({
        product_id: product.id,
        url: `/uploads/${file.filename}`,
        is_primary: index === 0
      }));
      await prisma.productImage.createMany({ data: imageRecords });
    }

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

exports.approveProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status || 'APPROVED' } // APPROVED or REJECTED
    });
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { deleted_at: new Date() },
    });
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};
