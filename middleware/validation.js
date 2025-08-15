/**
 * Form Validation Middleware
 * Provides validation rules and error handling for forms
 */

const { body, query, param, validationResult } = require('express-validator');

// Custom validation functions
const isValidDate = (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
};

const isValidPhase = (value) => {
    const validPhases = ['design', 'development', 'testing', 'deployment', 'complete'];
    return validPhases.includes(value);
};

const isStrongPassword = (value) => {
    // At least 6 characters, containing at least one letter and one number
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/.test(value);
};

const sanitizeInput = (value) => {
    if (typeof value !== 'string') return value;
    return value.trim().replace(/[<>]/g, '');
};

// Registration validation rules
const registerValidation = [
    body('username')
        .customSanitizer(sanitizeInput)
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores')
        .custom(async (value, { req }) => {
            // Check if username exists
            if (req.db) {
                const [users] = await req.db.execute(
                    'SELECT uid FROM users WHERE username = ?', 
                    [value]
                );
                if (users.length > 0) {
                    throw new Error('Username is already taken');
                }
            }
            return true;
        }),
    
    body('email')
        .customSanitizer(sanitizeInput)
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 100 })
        .withMessage('Email is too long')
        .custom(async (value, { req }) => {
            // Check if email exists
            if (req.db) {
                const [users] = await req.db.execute(
                    'SELECT uid FROM users WHERE email = ?', 
                    [value]
                );
                if (users.length > 0) {
                    throw new Error('Email is already registered');
                }
            }
            return true;
        }),
    
    body('password')
        .isLength({ min: 6, max: 128 })
        .withMessage('Password must be between 6 and 128 characters')
        .custom((value) => {
            if (!isStrongPassword(value)) {
                throw new Error('Password must contain at least one letter and one number');
            }
            return true;
        }),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

// Login validation rules
const loginValidation = [
    body('username')
        .customSanitizer(sanitizeInput)
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ max: 30 })
        .withMessage('Username is too long'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ max: 128 })
        .withMessage('Password is too long')
];

// Project validation rules
const projectValidation = [
    body('title')
        .customSanitizer(sanitizeInput)
        .isLength({ min: 3, max: 100 })
        .withMessage('Project title must be between 3 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_.()]+$/)
        .withMessage('Project title contains invalid characters'),
    
    body('short_description')
        .customSanitizer(sanitizeInput)
        .isLength({ min: 10, max: 500 })
        .withMessage('Short description must be between 10 and 500 characters'),
    
    body('start_date')
        .isISO8601({ strict: false })
        .withMessage('Please provide a valid start date (YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            const maxDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now
            
            if (date > maxDate) {
                throw new Error('Start date cannot be more than 1 year in the future');
            }
            return true;
        }),
    
    body('end_date')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601({ strict: false })
        .withMessage('Please provide a valid end date (YYYY-MM-DD)')
        .custom((value, { req }) => {
            if (value && req.body.start_date) {
                const startDate = new Date(req.body.start_date);
                const endDate = new Date(value);
                
                if (endDate <= startDate) {
                    throw new Error('End date must be after start date');
                }
                
                // Check if end date is reasonable (not more than 10 years from start)
                const maxEndDate = new Date(startDate.getTime() + (10 * 365 * 24 * 60 * 60 * 1000));
                if (endDate > maxEndDate) {
                    throw new Error('End date cannot be more than 10 years after start date');
                }
            }
            return true;
        }),
    
    body('phase')
        .custom((value) => {
            if (!isValidPhase(value)) {
                throw new Error('Please select a valid phase');
            }
            return true;
        })
];

// Search validation rules
const searchValidation = [
    query('query')
        .optional()
        .customSanitizer(sanitizeInput)
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
    
    query('type')
        .optional()
        .isIn(['title', 'date', 'description'])
        .withMessage('Search type must be title, date, or description'),

    query('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be in valid format'),
    
    query('phase')
        .optional()
        .custom((value) => {
            if (value && !isValidPhase(value)) {
                throw new Error('Invalid phase filter');
            }
            return true;
        }),
    
    query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be a valid number'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
];

// Parameter validation
const idValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid ID parameter')
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array();
        
        // For API requests, return JSON
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(400).json({
                success: false,
                errors: errorMessages
            });
        }
        
        // For form submissions, store errors in session and redirect back
        req.session.validationErrors = errorMessages;
        req.session.formData = req.body;
        
        // Determine redirect URL based on request path
        let redirectUrl = req.get('Referer') || '/';
        
        // Clean up the URL to prevent redirect loops
        if (redirectUrl.includes('?error=') || redirectUrl.includes('#')) {
            redirectUrl = redirectUrl.split('?')[0].split('#')[0];
        }
        
        return res.redirect(`${redirectUrl}?error=validation`);
    }
    
    next();
};

// Sanitization middleware for all requests
const sanitizeRequest = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeInput(req.query[key]);
            }
        }
    }
    
    // Sanitize body parameters (for non-password fields)
    if (req.body) {
        for (const key in req.body) {
            if (key !== 'password' && key !== 'confirmPassword' && typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    
    next();
};

// File upload validation (for future file upload features)
const fileUploadValidation = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
        if (!req.file) {
            return next();
        }
        
        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
            });
        }
        
        // Check file size
        if (req.file.size > maxSize) {
            return res.status(400).json({
                error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`
            });
        }
        
        next();
    };
};

// Custom validation for specific business rules
const customValidations = {
    // Ensure user can only have a limited number of projects
    maxProjectsPerUser: async (req, res, next) => {
        const maxProjects = 50; // Configurable limit
        
        if (req.session.user) {
            try {
                const [projects] = await req.db.execute(
                    'SELECT COUNT(*) as count FROM projects WHERE uid = ?',
                    [req.session.user.uid]
                );
                
                if (projects[0].count >= maxProjects) {
                    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                        return res.status(400).json({
                            error: `Maximum number of projects (${maxProjects}) reached`
                        });
                    }
                    
                    req.session.errorMessage = `You have reached the maximum number of projects (${maxProjects}).`;
                    return res.redirect('/dashboard');
                }
            } catch (error) {
                console.error('Project count check error:', error);
            }
        }
        
        next();
    },
    
    // Prevent duplicate project titles for the same user
    uniqueProjectTitle: async (req, res, next) => {
        if (req.session.user && req.body.title) {
            try {
                let query = 'SELECT pid FROM projects WHERE uid = ? AND title = ?';
                let params = [req.session.user.uid, req.body.title];
                
                // If editing, exclude current project
                if (req.params.id) {
                    query += ' AND pid != ?';
                    params.push(req.params.id);
                }
                
                const [projects] = await req.db.execute(query, params);
                
                if (projects.length > 0) {
                    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                        return res.status(400).json({
                            error: 'You already have a project with this title'
                        });
                    }
                    
                    req.session.validationErrors = [{
                        msg: 'You already have a project with this title',
                        param: 'title'
                    }];
                    req.session.formData = req.body;
                    
                    const redirectUrl = req.get('Referer') || '/dashboard';
                    return res.redirect(`${redirectUrl}?error=validation`);
                }
            } catch (error) {
                console.error('Title uniqueness check error:', error);
            }
        }
        
        next();
    }
};

module.exports = {
    registerValidation,
    loginValidation,
    projectValidation,
    searchValidation,
    idValidation,
    handleValidationErrors,
    sanitizeRequest,
    fileUploadValidation,
    customValidations
};