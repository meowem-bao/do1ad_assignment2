const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Validation middleware
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

const loginValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).redirect('/login');
    }
    next();
};

const requireGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

// Registration form
router.get('/register', requireGuest, (req, res) => {
    res.render('register', {
        title: 'Register',
        currentPage: 'register',
        errors: [],
        formData: {}
    });
});

// Handle registration
router.post('/register', requireGuest, registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        const { username, email, password } = req.body;
        const formData = { username, email };
        
        if (!errors.isEmpty()) {
            return res.render('register', {
                title: 'Register',
                currentPage: 'register',
                errors: errors.array(),
                formData: formData
            });
        }
        
        // Check if username or email already exists
        const checkQuery = 'SELECT uid FROM users WHERE username = ? OR email = ?';
        const [existingUsers] = await req.db.execute(checkQuery, [username.trim(), email.trim()]);
        
        if (existingUsers.length > 0) {
            return res.render('register', {
                title: 'Register',
                currentPage: 'register',
                errors: [{ msg: 'Username or email already exists' }],
                formData: formData
            });
        }
        
        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Insert new user
        const insertQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        const [result] = await req.db.execute(insertQuery, [username.trim(), email.trim(), hashedPassword]);
        
        // Log the user in automatically
        req.session.user = {
            uid: result.insertId,
            username: username.trim(),
            email: email.trim()
        };
        
        req.session.successMessage = 'Account created successfully! Welcome to Project Manager.';
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            title: 'Register',
            currentPage: 'register',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            formData: req.body
        });
    }
});

// Login form
router.get('/login', requireGuest, (req, res) => {
    res.render('login', {
        title: 'Login',
        currentPage: 'login',
        error: null
    });
});

// Handle login
router.post('/login', requireGuest, loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        const { username, password } = req.body;
        
        if (!errors.isEmpty()) {
            return res.render('login', {
                title: 'Login',
                currentPage: 'login',
                error: 'Please provide valid username and password'
            });
        }
        
        // Find user
        const query = 'SELECT * FROM users WHERE username = ?';
        const [users] = await req.db.execute(query, [username.trim()]);
        
        if (users.length === 0) {
            return res.render('login', {
                title: 'Login',
                currentPage: 'login',
                error: 'Invalid username or password'
            });
        }
        
        const user = users[0];
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.render('login', {
                title: 'Login',
                currentPage: 'login',
                error: 'Invalid username or password'
            });
        }
        
        // Set session
        req.session.user = {
            uid: user.uid,
            username: user.username,
            email: user.email
        };
        
        // Redirect to intended page or dashboard
        const redirectTo = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        
        req.session.successMessage = `Welcome back, ${user.username}!`;
        res.redirect(redirectTo);
        
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Login',
            currentPage: 'login',
            error: 'Login failed. Please try again.'
        });
    }
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
    const username = req.session.user.username;
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Unable to log out' });
        }
        
        res.clearCookie('connect.sid'); // Clear session cookie
        
        // If it's an AJAX request, return JSON
        if (req.xhr) {
            return res.json({ success: true, message: `Goodbye, ${username}!` });
        }
        
        // Otherwise redirect
        res.redirect('/?message=logged-out');
    });
});

// Check authentication status (for AJAX requests)
router.get('/check-auth', (req, res) => {
    res.json({
        authenticated: !!req.session.user,
        user: req.session.user || null
    });
});

// Password reset request (placeholder for future implementation)
router.get('/forgot-password', requireGuest, (req, res) => {
    res.render('forgot-password', {
        title: 'Reset Password',
        currentPage: 'login',
        message: null,
        error: null
    });
});

// Export middleware for use in other routes
module.exports = {
    router,
    requireAuth,
    requireGuest
};