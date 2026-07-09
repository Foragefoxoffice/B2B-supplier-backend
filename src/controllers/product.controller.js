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
        include: { 
          supplier: true, 
          category: true, 
          images: {
            orderBy: {
              is_primary: 'desc'
            }
          }
        },
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
        product_code: data.product_code || `PRD-${Date.now()}`,
        name: data.name,
        supplier_id,
        category_id: parseInt(data.category_id),
        sub_category_id: data.sub_category_id ? parseInt(data.sub_category_id) : null,
        description: data.description,
        specification: data.specification,
        unit: data.unit || 'pcs',
        price: parseFloat(data.price),
        moq: data.moq ? parseInt(data.moq) : 1,
        stock: data.stock ? parseInt(data.stock) : 0,
        gst: data.gst || null,
        material: data.material || null,
        status: 'PENDING'
      }
    });

    // Handle images if any
    if (req.files && req.files.length > 0) {
      let metadata = [];
      if (data.imagesMetadata) {
        try {
          metadata = JSON.parse(data.imagesMetadata);
        } catch (e) {
          console.error('Failed to parse imagesMetadata:', e);
        }
      }

      const imageRecords = req.files.map((file, index) => {
        const fileMeta = metadata.find(m => m.isNew && m.fileIndex === index) || {};
        return {
          product_id: product.id,
          url: `/uploads/${file.filename}`,
          color: fileMeta.color || null,
          quantity: fileMeta.quantity ? parseInt(fileMeta.quantity) : 0,
          is_primary: index === 0
        };
      });
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

exports.updateProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const data = { ...req.body };
    
    // 1. Fetch product to verify existence and authorization
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Check authorization: if supplier, check if they own the product
    if (req.user.role === 'SUPPLIER' && product.supplier_id !== req.user.supplier_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const supplier_id = req.user.role === 'SUPPLIER' ? req.user.supplier_id : (data.supplier_id ? parseInt(data.supplier_id) : product.supplier_id);
    
    // 2. Update basic product information
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        product_code: data.product_code || product.product_code,
        name: data.name,
        category_id: parseInt(data.category_id),
        description: data.description,
        price: parseFloat(data.price),
        moq: data.moq ? parseInt(data.moq) : 1,
        unit: data.unit || 'pcs',
        gst: data.gst || null,
        material: data.material || null,
        supplier_id,
        status: req.user.role === 'SUPPLIER' ? 'PENDING' : product.status
      }
    });
    
    // 3. Handle images updates
    let metadata = [];
    if (data.imagesMetadata) {
      try {
        metadata = JSON.parse(data.imagesMetadata);
      } catch (e) {
        console.error('Failed to parse imagesMetadata in update:', e);
      }
    }
    
    // Separate existing images from new uploads in metadata
    const keptImages = metadata.filter(img => !img.isNew);
    const keptIds = keptImages.map(img => img.id);
    
    // Find images to delete (those that are not in keptIds)
    const imagesToDelete = product.images.filter(img => !keptIds.includes(img.id));
    for (const img of imagesToDelete) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../', img.url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting image file:', err);
        }
      }
    }
    
    if (imagesToDelete.length > 0) {
      await prisma.productImage.deleteMany({
        where: {
          id: { in: imagesToDelete.map(img => img.id) }
        }
      });
    }
    
    // Update kept images colors & quantities
    for (let i = 0; i < keptImages.length; i++) {
      const imgMeta = keptImages[i];
      await prisma.productImage.update({
        where: { id: imgMeta.id },
        data: {
          color: imgMeta.color || null,
          quantity: imgMeta.quantity ? parseInt(imgMeta.quantity) : 0,
          is_primary: false // We will set primary later
        }
      });
    }
    
    // Create new uploaded images
    if (req.files && req.files.length > 0) {
      const newImagesMeta = metadata.filter(img => img.isNew);
      const imageRecords = [];
      
      for (let i = 0; i < newImagesMeta.length; i++) {
        const meta = newImagesMeta[i];
        const file = req.files[meta.fileIndex];
        if (file) {
          imageRecords.push({
            product_id: productId,
            url: `/uploads/${file.filename}`,
            color: meta.color || null,
            quantity: meta.quantity ? parseInt(meta.quantity) : 0,
            is_primary: false
          });
        }
      }
      
      if (imageRecords.length > 0) {
        await prisma.productImage.createMany({ data: imageRecords });
      }
    }
    
    // Enforce the first image is primary
    const allImages = await prisma.productImage.findMany({
      where: { product_id: productId },
      orderBy: { id: 'asc' }
    });
    
    for (let i = 0; i < allImages.length; i++) {
      await prisma.productImage.update({
        where: { id: allImages[i].id },
        data: { is_primary: i === 0 }
      });
    }
    
    res.status(200).json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
};
