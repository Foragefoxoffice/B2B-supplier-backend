const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id;
        let cart = await prisma.cart.findUnique({
            where: { user_id: userId },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        },
                        variant: true
                    }
                }
            }
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { user_id: userId },
                include: { items: true }
            });
        }
        res.json({ success: true, data: cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.addBatchToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemsToAdd, remarks } = req.body;

        let cart = await prisma.cart.findUnique({
            where: { user_id: userId }
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { user_id: userId }
            });
        }

        // Process items
        for (const item of itemsToAdd) {
            const { product, variant, quantity } = item;
            
            const variantId = variant?.id || null;
            const productId = product.id;
            
            const existingItem = await prisma.cartItem.findFirst({
                where: {
                    cart_id: cart.id,
                    product_id: productId,
                    variant_id: variantId
                }
            });

            if (existingItem) {
                await prisma.cartItem.update({
                    where: { id: existingItem.id },
                    data: { quantity: existingItem.quantity + quantity, remarks: remarks || existingItem.remarks }
                });
            } else {
                await prisma.cartItem.create({
                    data: {
                        cart_id: cart.id,
                        product_id: productId,
                        variant_id: variantId,
                        quantity: quantity,
                        remarks: remarks || ''
                    }
                });
            }
        }

        const updatedCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        },
                        variant: true
                    }
                }
            }
        });

        res.json({ success: true, data: updatedCart });
    } catch (error) {
        console.error('Error adding batch to cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { variantId } = req.params;
        const { quantity, remarks } = req.body;
        
        let cart = await prisma.cart.findUnique({
            where: { user_id: userId }
        });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = await prisma.cartItem.findFirst({
            where: { 
                cart_id: cart.id,
                variant_id: parseInt(variantId)
            }
        });

        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        const data = {};
        if (quantity !== undefined) data.quantity = quantity;
        if (remarks !== undefined) data.remarks = remarks;

        await prisma.cartItem.update({
            where: { id: cartItem.id },
            data
        });

        const updatedCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        },
                        variant: true
                    }
                }
            }
        });

        res.json({ success: true, data: updatedCart });
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.removeCartItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { variantId } = req.params;

        let cart = await prisma.cart.findUnique({
            where: { user_id: userId }
        });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = await prisma.cartItem.findFirst({
            where: { 
                cart_id: cart.id,
                variant_id: parseInt(variantId)
            }
        });

        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        await prisma.cartItem.delete({
            where: { id: cartItem.id }
        });

        const updatedCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        },
                        variant: true
                    }
                }
            }
        });

        res.json({ success: true, data: updatedCart });
    } catch (error) {
        console.error('Error removing cart item:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.clearCart = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const cart = await prisma.cart.findUnique({
            where: { user_id: userId }
        });

        if (cart) {
            await prisma.cartItem.deleteMany({
                where: { cart_id: cart.id }
            });
        }

        const updatedCart = await prisma.cart.findUnique({
            where: { user_id: userId },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        },
                        variant: true
                    }
                }
            }
        });

        res.json({ success: true, data: updatedCart });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
