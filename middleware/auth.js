/**
 * Authentication Middleware
 * Handles user authentication, authorization, and session management
 */

// Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        // Store the original URL for redirect after login
        req.session.returnTo = req.originalUrl;
        
        // If it's an API request, return JSON error
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({
                error: 'Authentication required',
                redirectTo: '/login'
            });
        }
        
        // For regular requests, redirect to login
        return res.redirect('/login');
    }
    
    // User is authenticated, continue
    next();
};

// Check if user is not authenticated (guest only pages)
const requireGuest = (req, res, next) => {
    if (req.session.user) {
        // If user is logged in and trying to access login/register, redirect to dashboard
        return res.redirect('/dashboard');
    }
    
    // User is not logged in, continue
    next();
};

// Check if user owns the project (for edit/delete operations)
const requireProjectOwnership = async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const userId = req.session.user.uid;
        
        if (!projectId || !userId) {
            return res.status(400).json({
                error: 'Missing project ID or user authentication'
            });
        }
        
        // Check if project exists and belongs to user
        const query = 'SELECT uid FROM projects WHERE pid = ?';
        const [projects] = await req.db.execute(query, [projectId]);
        
        if (projects.length === 0) {
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(404).json({ error: 'Project not found' });
            }
            req.session.errorMessage = 'Project not found.';
            return res.redirect('/dashboard');
        }
        
        if (projects[0].uid !== userId) {
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(403).json({ error: 'Access denied' });
            }
            req.session.errorMessage = 'You do not have permission to access this project.';
            return res.redirect('/dashboard');
        }
        
        // User owns the project, continue
        next();
        
    } catch (error) {
        console.error('Project ownership check error:', error);
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server error' });
        }
        
        req.session.errorMessage = 'Unable to verify project ownership.';
        res.redirect('/dashboard');
    }
};

// Role-based access control (for future expansion)
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // For now, we don't have roles in the database
        // This is a placeholder for future role-based features
        if (req.session.user.role !== role) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};

// Admin check (placeholder for future admin features)
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        req.session.errorMessage = 'Admin access required.';
        return res.redirect('/');
    }
    
    next();
};

// Session timeout check
const checkSessionTimeout = (req, res, next) => {
    if (req.session.user && req.session.lastActivity) {
        const now = Date.now();
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (now - req.session.lastActivity > sessionTimeout) {
            // Session has expired
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
            });
            
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(401).json({
                    error: 'Session expired',
                    redirectTo: '/login'
                });
            }
            
            return res.redirect('/login?message=session-expired');
        }
    }
    
    // Update last activity timestamp
    if (req.session.user) {
        req.session.lastActivity = Date.now();
    }
    
    next();
};

// CSRF token generation and validation
const generateCSRFToken = (req, res, next) => {
    if (!req.session.csrfToken) {
        // Generate a simple CSRF token
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }
    
    // Make CSRF token available to templates
    res.locals.csrfToken = req.session.csrfToken;
    
    next();
};

const validateCSRFToken = (req, res, next) => {
    // Skip CSRF validation for GET requests
    if (req.method === 'GET') {
        return next();
    }
    
    const sessionToken = req.session.csrfToken;
    const requestToken = req.body._csrf || req.headers['x-csrf-token'];
    
    if (!sessionToken || !requestToken || sessionToken !== requestToken) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
        
        return res.status(403).render('error', {
            title: 'Security Error',
            message: 'Invalid security token. Please try again.'
        });
    }
    
    next();
};

// Rate limiting for authentication endpoints
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Clean up old attempts
        for (const [key, data] of attempts.entries()) {
            if (now - data.firstAttempt > windowMs) {
                attempts.delete(key);
            }
        }
        
        const userAttempts = attempts.get(ip);
        
        if (userAttempts && userAttempts.count >= maxAttempts) {
            const timeLeft = Math.ceil((windowMs - (now - userAttempts.firstAttempt)) / 1000 / 60);
            
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(429).json({
                    error: 'Too many login attempts',
                    timeLeft: timeLeft
                });
            }
            
            return res.render('login', {
                title: 'Login',
                error: `Too many login attempts. Please try again in ${timeLeft} minutes.`
            });
        }
        
        // Record this attempt on login failure
        req.recordFailedAttempt = () => {
            if (!userAttempts) {
                attempts.set(ip, { count: 1, firstAttempt: now });
            } else {
                userAttempts.count++;
            }
        };
        
        // Clear attempts on successful login
        req.clearFailedAttempts = () => {
            attempts.delete(ip);
        };
        
        next();
    };
};

// Middleware to check if user account is active (for future account status features)
const requireActiveAccount = (req, res, next) => {
    if (req.session.user && req.session.user.status === 'suspended') {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
        });
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ error: 'Account suspended' });
        }
        
        return res.render('error', {
            title: 'Account Suspended',
            message: 'Your account has been suspended. Please contact support.'
        });
    }
    
    next();
};

module.exports = {
    requireAuth,
    requireGuest,
    requireProjectOwnership,
    optionalAuth,
    requireRole,
    requireAdmin,
    checkSessionTimeout,
    generateCSRFToken,
    validateCSRFToken,
    authRateLimit,
    requireActiveAccount
};