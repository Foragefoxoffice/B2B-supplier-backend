const jwt = require('jsonwebtoken');

const prisma = require('../config/db');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user from database to ensure they exist and status is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'User not active or does not exist' });
    }

    // Check if password has been changed/regenerated since the token was issued
    if (decoded.passwordSig) {
      const dbPasswordSig = user.password.substring(0, 10);
      if (decoded.passwordSig !== dbPasswordSig) {
        return res.status(401).json({ success: false, message: 'Password has been regenerated. Please log in again.' });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'User role is not authorized to access this route' });
    }
    next();
  };
};

module.exports = { protect, authorize };
