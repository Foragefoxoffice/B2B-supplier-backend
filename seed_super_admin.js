const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  try {
    const password = 'testkannansilks@#2k26';
    const email = 'testkannansilks@gmail.com';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Ensure SUPER_ADMIN role exists
    let superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: 'SUPER_ADMIN',
          description: 'Super Administrator with all privileges',
        },
      });
      console.log('Created SUPER_ADMIN role.');
    } else {
      console.log('Found SUPER_ADMIN role ID:', superAdminRole.id);
    }

    // 2. Upsert Super Admin demo user
    const superAdmin = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        role_id: superAdminRole.id,
        status: 'ACTIVE',
      },
      create: {
        email,
        password: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        phone: '9787738094',
        role_id: superAdminRole.id,
        status: 'ACTIVE',
      },
      include: {
        role: true,
      },
    });

    console.log('\n=========================================');
    console.log('Super Admin Account Created / Updated Successfully!');
    console.log(`Email: ${superAdmin.email}`);
    console.log(`Role: ${superAdmin.role.name}`);
    console.log(`Status: ${superAdmin.status}`);
    console.log('=========================================\n');
  } catch (error) {
    console.error('Error seeding super admin account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();
