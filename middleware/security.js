const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const xss = require('xss');

/**
 * Security Middleware Collection
 * Provides various security measures for the Project Management System
 */

// Rate limiting middleware
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
    return rateLimit({
        windowMs, // Time window in milliseconds
        max, // Max requests per windowMs
        message: {
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).render('error', {
                title: 'Too Many Requests',
                message: 'You have exceeded the rate limit. Please try again later.',
                user: req.user || null
            });
        }
    });
};

// General rate limiter
const generalLimiter = createRateLimit(15 * 60 * 1000, 100, 'Too many requests from this IP');

// Strict rate limiter for sensitive operations
const strictLimiter = createRateLimit(15 * 60 * 1000, 5, 'Too many attempts');

// Login rate limiter
const loginLimiter = createRateLimit(15 * 60 * 1000, 10, 'Too many login attempts');

// API rate limiter
const apiLimiter = createRateLimit(15 * 60 * 1000, 1000, 'API rate limit exceeded');

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).render('error', {
            title: 'Authentication Required',
            message: 'You must be logged in to access this resource.',
            user: null
        });
    }
    
    // Check if session is expired
    if (req.session.expires && new Date() > new Date(req.session.expires)) {
        req.session.destroy();
        return res.status(401).render('error', {
            title: 'Session Expired',
            message: 'Your session has expired. Please log in again.',
            user: null
        });
    }
    
    next();
};

// Authorization middleware for different roles
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).render('error', {
                title: 'Authentication Required',
                message: 'You must be logged in to access this resource.',
                user: null
            });
        }
        
        if (!roles.includes(req.session.user.role)) {
            return res.status(403).render('error', {
                title: 'Access Forbidden',
                message: 'You do not have permission to access this resource.',
                user: req.session.user
            });
        }
        
        next();
    };
};

// Input validation and sanitization middleware
const validateAndSanitize = (validationRules) => {
    return (req, res, next) => {
        const errors = [];
        
        // Sanitize all string inputs
        const sanitizeObject = (obj) => {
            for (let key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = xss(obj[key].trim());
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        };
        
        if (req.body) sanitizeObject(req.body);
        if (req.query) sanitizeObject(req.query);
        if (req.params) sanitizeObject(req.params);
        
        // Apply validation rules
        if (validationRules && req.body) {
            for (let field in validationRules) {
                const rules = validationRules[field];
                const value = req.body[field];
                
                if (rules.required && (!value || value.trim() === '')) {
                    errors.push(`${field} is required`);
                    continue;
                }
                
                if (value) {
                    if (rules.minLength && value.length < rules.minLength) {
                        errors.push(`${field} must be at least ${rules.minLength} characters`);
                    }
                    
                    if (rules.maxLength && value.length > rules.maxLength) {
                        errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                    }
                    
                    if (rules.isEmail && !validator.isEmail(value)) {
                        errors.push(`${field} must be a valid email`);
                    }
                    
                    if (rules.isNumeric && !validator.isNumeric(value.toString())) {
                        errors.push(`${field} must be a number`);
                    }
                    
                    if (rules.pattern && !rules.pattern.test(value)) {
                        errors.push(`${field} format is invalid`);
                    }
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).render('error', {
                title: 'Validation Error',
                message: 'Please correct the following errors: ' + errors.join(', '),
                user: req.session?.user || null,
                error: { message: errors.join('\n') }
            });
        }
        
        next();
    };
};

// CSRF protection middleware (simple token-based)
const csrfProtection = (req, res, next) => {
    if (req.method === 'GET') {
        // Generate CSRF token for GET requests
        if (!req.session.csrfToken) {
            req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        }
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }
    
    // Validate CSRF token for POST/PUT/DELETE requests
    const token = req.body.csrfToken || req.headers['x-csrf-token'];
    
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).render('error', {
            title: 'Security Error',
            message: 'Invalid security token. Please refresh the page and try again.',
            user: req.session?.user || null
        });
    }
    
    next();
};

// Security headers using helmet
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// File upload security
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
        if (!req.file && !req.files) {
            return next();
        }
        
        const files = req.files || [req.file];
        
        for (let file of files) {
            if (file.size > maxSize) {
                return res.status(400).render('error', {
                    title: 'File Too Large',
                    message: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
                    user: req.session?.user || null
                });
            }
            
            if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                return res.status(400).render('error', {
                    title: 'Invalid File Type',
                    message: `Only ${allowedTypes.join(', ')} files are allowed`,
                    user: req.session?.user || null
                });
            }
        }
        
        next();
    };
};

// SQL Injection protection (basic)
const sqlInjectionProtection = (req, res, next) => {
    const checkForSQLInjection = (value) => {
        if (typeof value !== 'string') return false;
        
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
            /(UNION|OR|AND)\s+\d+\s*=\s*\d+/i,
            /['";]/g
        ];
        
        return sqlPatterns.some(pattern => pattern.test(value));
    };
    
    const checkObject = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string' && checkForSQLInjection(obj[key])) {
                return true;
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkObject(obj[key])) return true;
            }
        }
        return false;
    };
    
    if ((req.body && checkObject(req.body)) || 
        (req.query && checkObject(req.query)) || 
        (req.params && checkObject(req.params))) {
        
        return res.status(400).render('error', {
            title: 'Security Error',
            message: 'Invalid input detected. Please check your data and try again.',
            user: req.session?.user || null
        });
    }
    
    next();
};

// Logging middleware for security events
const securityLogger = (req, res, next) => {
    const originalRender = res.render;
    
    res.render = function(view, options, callback) {
        if (view === 'error' && options && options.title) {
            console.log(`[SECURITY] ${new Date().toISOString()} - ${req.ip} - ${options.title} - ${req.originalUrl}`);
        }
        return originalRender.call(this, view, options, callback);
    };
    
    next();
};

module.exports = {
    // Rate limiting
    generalLimiter,
    strictLimiter,
    loginLimiter,
    apiLimiter,
    createRateLimit,
    
    // Authentication & Authorization
    requireAuth,
    requireRole,
    
    // Input validation
    validateAndSanitize,
    
    // Security measures
    csrfProtection,
    securityHeaders,
    validateFileUpload,
    sqlInjectionProtection,
    securityLogger
};