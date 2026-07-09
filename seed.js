const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Create or find Role
  let superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' }
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'SUPER_ADMIN',
        description: 'Super Administrator with all privileges'
      }
    });
  }

  // Create Supplier Role
  let supplierRole = await prisma.role.findUnique({
    where: { name: 'SUPPLIER' }
  });

  if (!supplierRole) {
    supplierRole = await prisma.role.create({
      data: {
        name: 'SUPPLIER',
        description: 'Supplier role with limited access to their own products'
      }
    });
  }
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@b2bportal.com' },
    update: {},
    create: {
      email: 'admin@b2bportal.com',
      password: hashedPassword,
      first_name: 'Super',
      last_name: 'Admin',
      role_id: superAdminRole.id,
    },
  });

  console.log('Created Admin User:', admin.email);
  console.log('Password: password123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
