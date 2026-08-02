const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// const cookieParser = require('cookie-parser');
const session = require('express-session'); // Add this
const passport = require('./config/passport'); // Add this
const path = require('path');
const jwt = require('jsonwebtoken');  // ← Add this line
const http = require('http');
const socketIO = require('socket.io');

require('dotenv').config();

require('./config/db_config');

const app = express();

const server = http.createServer(app);  // ← CREATE SERVER HERE


// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────

// Socket.io setup
const io = socketIO(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'https://capstone-backend-nr2u.onrender.com','https://acaps-inventory-system.vercel.app' ],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});


// Session middleware (required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  // Allow all origins in development
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
// app.use(cookieParser());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        },
    },
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use('/api/v1/admin',     require('./routes/AdminRoutes'));
app.use('/api/v1/customer',  require('./routes/CustomerRoutes'));
app.use('/api/v1/product',   require('./routes/ProductRoutes'));
app.use('/api/v1/supplies',    require('./routes/SupplyRoutes')); 
app.use('/api/v1/inventory', require('./routes/InventoryItemRoutes'));
app.use('/api/v1/order',     require('./routes/OrderRoutes')); // Added order routes
app.use('/api/v1/admin', require('./routes/DashboardRoutes')); // Added dashboard routes
app.use('/api/v1/analytics', require('./routes/AnalyticsRoutes')); // Added analytics routes
app.use('/api/v1/otp', require('./routes/OtpRoutes'));
app.use('/api/v1/alerts', require('./routes/AlertRoutes'));
app.use('/api/v1/auth', require('./routes/OAuthRoutes'));
app.use('/api/v1/designs', require('./routes/DesignRoutes')); // Added design routes
app.use('/api/v1/chat', require('./routes/ChatRoutes')); // Added chat routes
app.use('/api/v1/drivers', require('./routes/DriverRoutes'));

// ─────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
}); 

// Socket Service
const SocketService = require('./services/SocketServices');
const socketService = new SocketService(io);

// Make socket service available to routes
app.set('socketService', socketService);

// Authentication middleware for socket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted (optional)
    // const BlacklistToken = require('./models/BlacklistToken');
    // const isBlacklisted = await BlacklistToken.findOne({ token });
    // if (isBlacklisted) return next(new Error('Token invalidated'));
    
    socket.userId = decoded.customerId || decoded.adminId || decoded.id;
    socket.userType = decoded.customerId ? 'customer' : 'admin';
    socket.userInfo = {
      name: decoded.firstName ? `${decoded.firstName} ${decoded.lastName || ''}` : decoded.email,
      email: decoded.email,
      ...decoded
    };
    
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication failed'));
  }
});




// Socket connection handler
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userId} (${socket.userType})`);
  
  // Store online user
  socketService.addOnlineUser(socket.userId, socket.id, socket.userType, socket.userInfo);
  
  // Broadcast online status to all
  io.emit('users-online', socketService.getOnlineUsers());
  
  // Join user to their personal room for direct messages
  socket.join(`user_${socket.userId}`);
  
  // ─────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────
  
  // Join conversation room
  socket.on('join-conversation', async (data) => {
    const { conversationId } = data;
    if (!conversationId) {
      socket.emit('error', { message: 'Conversation ID required' });
      return;
    }
    
    socketService.joinConversation(socket, conversationId, socket.userId, socket.userType);
    
    // Mark messages as read when joining
    await socketService.markAsRead(conversationId, socket.userId, socket.userType, socket);
    
    // Send unread count
    const Conversation = require('./models/Conversation.Model');
    const conversation = await Conversation.findOne({ conversationId });
    if (conversation) {
      const unreadCount = socket.userType === 'customer' 
        ? conversation.customerUnreadCount 
        : conversation.adminUnreadCount;
      socket.emit('unread-count', { conversationId, count: unreadCount });
    }
  });
  
  // Leave conversation room
  socket.on('leave-conversation', ({ conversationId }) => {
    socketService.leaveConversation(socket, conversationId);
  });
  
  // Send message
  socket.on('send-message', async (data) => {
    const { conversationId, content, attachments, replyToMessageId } = data;
    
    if (!conversationId || (!content && (!attachments || attachments.length === 0))) {
      socket.emit('error', { message: 'Message content required' });
      return;
    }
    
    const senderName = socket.userInfo?.name || (socket.userType === 'customer' ? 'Customer' : 'Support Team');
    
    const message = await socketService.saveAndEmitMessage(
      conversationId,
      socket.userId,
      senderName,
      socket.userType,
      content,
      attachments,
      replyToMessageId,
      socket
    );
    
    if (message) {
      // Send confirmation back to sender
      socket.emit('message-sent', message);
    }
  });
  
  // Typing indicator
  socket.on('typing', ({ conversationId, isTyping }) => {
    if (!conversationId) return;
    
    socketService.handleTyping(
      conversationId,
      socket.userId,
      socket.userType,
      isTyping,
      socket
    );
  });
  
  // Mark conversation as read
  socket.on('mark-read', async ({ conversationId }) => {
    if (!conversationId) return;
    
    await socketService.markAsRead(conversationId, socket.userId, socket.userType, socket);
  });
  
  // Get online status of users
  socket.on('get-online-status', ({ userIds }) => {
    const statuses = {};
    for (const userId of userIds) {
      statuses[userId] = socketService.isUserOnline(userId);
    }
    socket.emit('online-statuses', statuses);
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.userId}`);
    socketService.removeOnlineUser(socket.userId);
    io.emit('users-online', socketService.getOnlineUsers());
  });
});

// Make io accessible in routes
app.set('io', io);

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─────────────────────────────────────────
// START SERVER - USE server.listen NOT app.listen
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.io ready for connections`);
});