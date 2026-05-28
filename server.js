const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// const cookieParser = require('cookie-parser');
const session = require('express-session'); // Add this
const passport = require('./config/passport'); // Add this
const path = require('path');


require('dotenv').config();

require('./config/db_config');

const app = express();

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────

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


// ─────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
}); 

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});