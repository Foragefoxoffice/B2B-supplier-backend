const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching soft-deleted suppliers from the database...');
  const suppliers = await prisma.supplier.findMany({
    where: { NOT: { deleted_at: null } }
  });

  if (suppliers.length === 0) {
    console.log('No soft-deleted suppliers found.');
    return;
  }

  const supplierIds = suppliers.map(s => s.id);
  console.log(`Found soft-deleted supplier IDs: ${supplierIds.join(', ')}`);

  const users = await prisma.user.findMany({
    where: { supplier_id: { in: supplierIds } }
  });
  const userIds = users.map(u => u.id);
  console.log(`Found associated user IDs: ${userIds.join(', ')}`);

  // Run cleanup in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Delete user dependent records
    console.log('Deleting notifications, activity logs, sessions, and carts...');
    await tx.notification.deleteMany({ where: { user_id: { in: userIds } } });
    await tx.activityLog.deleteMany({ where: { user_id: { in: userIds } } });
    await tx.userSession.deleteMany({ where: { user_id: { in: userIds } } });
    await tx.cartItem.deleteMany({ where: { cart: { user_id: { in: userIds } } } });
    await tx.cart.deleteMany({ where: { user_id: { in: userIds } } });

    // 2. Delete purchase orders and their dependents
    console.log('Deleting dispatches, confirmations, PO items, and POs...');
    await tx.dispatch.deleteMany({ where: { purchase_order: { supplier_id: { in: supplierIds } } } });
    await tx.orderConfirmation.deleteMany({ where: { purchase_order: { supplier_id: { in: supplierIds } } } });
    await tx.purchaseOrderItem.deleteMany({ where: { purchase_order: { supplier_id: { in: supplierIds } } } });
    await tx.purchaseOrder.deleteMany({ where: { supplier_id: { in: supplierIds } } });

    // 3. Delete products and images
    console.log('Deleting product images and products...');
    await tx.productImage.deleteMany({ where: { product: { supplier_id: { in: supplierIds } } } });
    await tx.product.deleteMany({ where: { supplier_id: { in: supplierIds } } });

    // 4. Delete supplier assets
    console.log('Deleting categories, transporters, and documents...');
    await tx.category.deleteMany({ where: { supplier_id: { in: supplierIds } } });
    await tx.transporter.deleteMany({ where: { supplier_id: { in: supplierIds } } });
    await tx.document.deleteMany({ where: { supplier_id: { in: supplierIds } } });

    // 5. Delete users
    console.log('Deleting users...');
    await tx.user.deleteMany({ where: { id: { in: userIds } } });

    // 6. Delete suppliers
    console.log('Deleting suppliers...');
    await tx.supplier.deleteMany({ where: { id: { in: supplierIds } } });
  });

  console.log('Production database cleanup completed successfully!');
}

run()
  .catch(err => {
    console.error('Error running production database cleanup:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
