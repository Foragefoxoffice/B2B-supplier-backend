const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// Get all non-supplier users (Admins, Staff, etc.)
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        supplier_id: null,
        deleted_at: null
      },
      include: {
        role: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create a new user (Staff/Admin)
const createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone, role_id } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        first_name,
        last_name,
        email,
        password: hashedPassword,
        phone,
        role_id: parseInt(role_id)
      },
      include: {
        role: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_USER',
        module: 'Users',
        details: `Created user ${email}`,
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    });
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, role_id, status } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        first_name,
        last_name,
        phone,
        role_id: role_id ? parseInt(role_id) : undefined,
        status
      },
      include: {
        role: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'UPDATE_USER',
        module: 'Users',
        details: `Updated user ${updatedUser.email}`,
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete (soft delete) a user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
        status: 'INACTIVE'
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'DELETE_USER',
        module: 'Users',
        details: `Deleted user ${user.email}`,
      }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all roles
const getRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        name: {
          not: 'SUPPLIER'
        }
      }
    });

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Get Roles Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles
};
