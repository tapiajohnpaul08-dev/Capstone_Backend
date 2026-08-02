const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('./config/passport');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIO = require('socket.io');

require('dotenv').config();
require('./config/db_config');

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────
// CORS CONFIGURATION - PRODUCTION READY
// ─────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'https://acaps-inventory-system.vercel.app',
      'https://capstone-backend-nr2u.onrender.com'
    ];
    
    // Log for debugging
    console.log('CORS Request from origin:', origin);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-HTTP-Method-Override'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// ─────────────────────────────────────────
// SOCKET.IO SETUP
// ─────────────────────────────────────────
const io = socketIO(server, {
  cors: {
    origin: [
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://127.0.0.1:5173', 
      'https://acaps-inventory-system.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// ─────────────────────────────────────────
// SESSION MIDDLEWARE
// ─────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ─────────────────────────────────────────
// PASSPORT MIDDLEWARE
// ─────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─────────────────────────────────────────
// OTHER MIDDLEWARE
// ─────────────────────────────────────────
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
app.use('/api/v1/admin', require('./routes/AdminRoutes'));
app.use('/api/v1/customer', require('./routes/CustomerRoutes'));
app.use('/api/v1/product', require('./routes/ProductRoutes'));
app.use('/api/v1/supplies', require('./routes/SupplyRoutes'));
app.use('/api/v1/inventory', require('./routes/InventoryItemRoutes'));
app.use('/api/v1/order', require('./routes/OrderRoutes'));
app.use('/api/v1/admin', require('./routes/DashboardRoutes'));
app.use('/api/v1/analytics', require('./routes/AnalyticsRoutes'));
app.use('/api/v1/otp', require('./routes/OtpRoutes'));
app.use('/api/v1/alerts', require('./routes/AlertRoutes'));
app.use('/api/v1/auth', require('./routes/OAuthRoutes'));
app.use('/api/v1/designs', require('./routes/DesignRoutes'));
app.use('/api/v1/chat', require('./routes/ChatRoutes'));
app.use('/api/v1/drivers', require('./routes/DriverRoutes'));

// ─────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

// ─────────────────────────────────────────
// SOCKET SERVICE
// ─────────────────────────────────────────
const SocketService = require('./services/SocketServices');
const socketService = new SocketService(io);
app.set('socketService', socketService);

// ─────────────────────────────────────────
// SOCKET AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-in-production');
    
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

// ─────────────────────────────────────────
// SOCKET CONNECTION HANDLER
// ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userId} (${socket.userType})`);
  
  // Store online user
  socketService.addOnlineUser(socket.userId, socket.id, socket.userType, socket.userInfo);
  
  // Broadcast online status to all
  io.emit('users-online', socketService.getOnlineUsers());
  
  // Join user to their personal room for direct messages
  socket.join(`user_${socket.userId}`);
  
  // ─────────────────────────────────────────
  // EVENT HANDLERS
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
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready for connections`);
  console.log(`✅ CORS enabled for: localhost, Vercel, and Render`);
});