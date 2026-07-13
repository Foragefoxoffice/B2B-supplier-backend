const prisma = require('../config/db');

exports.getCategories = async (req, res, next) => {
  try {
    let where = { deleted_at: null };
    
    if (req.user && req.user.role === 'SUPPLIER') {
      where.supplier_id = req.user.supplier_id;
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        children: {
          where
        }
      }
    });

    // To return a tree, we just return the root level categories
    const rootCategories = categories.filter(c => c.parent_id === null);

    res.status(200).json({ success: true, data: rootCategories });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, category_code, parent_id, status } = req.body;
    
    let supplier_id = null;
    if (req.user && req.user.role === 'SUPPLIER') {
      supplier_id = req.user.supplier_id;
    }

    const category = await prisma.category.create({
      data: {
        name,
        category_code: category_code || '',
        parent_id: parent_id ? parseInt(parent_id) : null,
        status: status || 'ACTIVE',
        supplier_id,
      }
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    
    if (!category || category.deleted_at) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (req.user && req.user.role === 'SUPPLIER' && category.supplier_id !== req.user.supplier_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this category' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: req.body,
    });
    res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    
    if (!category || category.deleted_at) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (req.user && req.user.role === 'SUPPLIER' && category.supplier_id !== req.user.supplier_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this category' });
    }

    await prisma.category.update({
      where: { id: categoryId },
      data: { deleted_at: new Date() },
    });
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};
