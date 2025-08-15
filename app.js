// app.js - Main application file
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config({ path: './database/.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Import database connection function
const db = require('./database/connection');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Rate limiting - more specific limits
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true
});

app.use(generalLimiter);

// Session configuration - improved security
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-for-development-only',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    httpOnly: true,
    maxAge: 1800000, // 30 minutes
    sameSite: 'strict' // CSRF protection
  },
  name: 'sessionId' // Don't use default session name
}));

// Body parsing middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// CSRF protection - exclude certain routes
const csrfProtection = csrf({ 
  cookie: false,
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
});

// User context middleware - adds user info to all responses
app.use((req, res, next) => {
  // Make session user available to all views
  res.locals.user = req.session.user || null;
  res.locals.title = 'Project Manager';
  next();
});

// Database middleware
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Import route modules
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const publicRoutes = require('./routes/public');

// Use route modules
app.use('/', publicRoutes);
app.use('/', authRoutes.router);
app.use('/', projectRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Page Not Found',
    message: 'The page you are looking for could not be found.',
    error: {}
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  
  // Handle CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Security Error',
      message: 'Invalid security token. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).render('error', {
      title: 'Validation Error',
      message: 'Please check your input and try again.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Default error
  res.status(500).render('error', { 
    title: 'Internal Server Error',
    message: 'Something went wrong. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server with database initialization
async function startServer() {
  try {
    // Test database connection
    await db.testConnection();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${process.env.DB_NAME}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('\nDevelopment Mode:');
        console.log('   Run "node setup.js" to create/reset the database');
        console.log('   Check your route files for test credentials');
        console.log('   Visit http://localhost:' + PORT + ' to get started\n');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;