const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); // Map user_id to socket_id

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend URL
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Attach user info to socket
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id} (Socket ID: ${socket.id})`);
    
    // Store socket mapping
    userSockets.set(socket.user.id, socket.id);

    // Join a room specific to this user for targeted messages
    socket.join(`user_${socket.user.id}`);
    
    // If user is a supplier, join a supplier-specific room
    if (socket.user.supplier_id) {
       socket.join(`supplier_${socket.user.supplier_id}`);
    }
    
    // If user is an admin (role_id 1 or 2 typically, let's assume all admins join 'admins' room)
    if (socket.user.role === 'SUPER_ADMIN' || socket.user.role === 'ADMIN') {
        socket.join('admins');
    }

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id} (Socket ID: ${socket.id})`);
      userSockets.delete(socket.user.id);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIo
};
