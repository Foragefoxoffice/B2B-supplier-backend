const prisma = require('../config/db');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { deleted_at: null },
      include: {
        children: {
          where: { deleted_at: null }
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
    const { name, parent_id, status } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        parent_id: parent_id ? parseInt(parent_id) : null,
        status: status || 'ACTIVE',
      }
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { deleted_at: new Date() },
    });
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};
