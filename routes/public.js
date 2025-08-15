const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();

// Search validation
const searchValidation = [
    query('query')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
    
    query('type')
        .optional()
        .isIn(['title', 'date'])
        .withMessage('Search type must be either "title" or "date"'),
    
    query('phase')
        .optional()
        .isIn(['design', 'development', 'testing', 'deployment', 'complete'])
        .withMessage('Phase filter must be valid')
];

// Homepage - Display all projects
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT p.pid, p.title, p.start_date, p.short_description, p.phase, u.email, u.username 
            FROM projects p 
            JOIN users u ON p.uid = u.uid 
            ORDER BY p.start_date DESC
            LIMIT 20
        `;
        
        const [projects] = await req.db.execute(query);
        
        // Get total project count
        const [countResult] = await req.db.execute('SELECT COUNT(*) as total FROM projects');
        const totalProjects = countResult[0].total;
        
        res.render('index', { 
            title: 'Project Management System',
            currentPage: 'home',
            user: req.session.user || null,
            projects: projects,
            totalProjects: totalProjects,
            successMessage: req.query.message === 'logged-out' ? 'You have been logged out successfully.' : null
        });
        
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).render('error', { 
            title: 'Error',
            currentPage: 'home',
            message: 'Unable to load projects. Please try again later.' 
        });
    }
});

// Project details
router.get('/project/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Validate project ID
        if (!projectId || isNaN(projectId)) {
            return res.status(404).render('error', {
                title: 'Invalid Project',
                message: 'Invalid project ID provided.'
            });
        }
        
        const query = `
            SELECT p.*, u.email, u.username 
            FROM projects p 
            JOIN users u ON p.uid = u.uid 
            WHERE p.pid = ?
        `;
        
        const [projects] = await req.db.execute(query, [projectId]);
        
        if (projects.length === 0) {
            return res.status(404).render('error', {
                title: 'Project Not Found',
                message: 'The requested project could not be found.'
            });
        }
        
        const project = projects[0];
        
        // Get related projects from the same user (excluding current project)
        const relatedQuery = `
            SELECT pid, title, phase, start_date 
            FROM projects 
            WHERE uid = ? AND pid != ? 
            ORDER BY start_date DESC 
            LIMIT 3
        `;
        
        const [relatedProjects] = await req.db.execute(relatedQuery, [project.uid, projectId]);
        
        res.render('project-details', {
            title: `${project.title}`,
            currentPage: 'projects',
            user: req.session.user || null,
            project: project,
            relatedProjects: relatedProjects,
            canEdit: req.session.user && req.session.user.uid === project.uid
        });
        
    } catch (error) {
        console.error('Error fetching project details:', error);
        res.status(500).render('error', {
            title: 'Error',
            currentPage: 'projects',
            user: req.session.user || null,
            message: 'Unable to load project details. Please try again later.'
        });
    }
});

// Search projects
router.get('/search', searchValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        let { query: searchQuery, date: searchDate, phase, page } = req.query;
        
        // Set defaults
        page = parseInt(page) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        
        let projects = [];
        let totalCount = 0;
        let whereConditions = [];
        let params = [];
        
        // Build search conditions
        if (searchQuery && searchQuery.trim()) {
            whereConditions.push('(p.title LIKE ? OR p.short_description LIKE ?)');
            params.push(`%${searchQuery.trim()}%`, `%${searchQuery.trim()}%`);
        }
        
        if (searchDate && searchDate.trim()) {
            whereConditions.push('DATE(p.start_date) = ?');
            params.push(searchDate.trim());
        }
        
        // Add phase filter if provided
        if (phase) {
            whereConditions.push('p.phase = ?');
            params.push(phase);
        }
        
        // Base query parts
        const joinClause = 'JOIN users u ON p.uid = u.uid';
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' OR ') : '';
        
        // Main search query
        const sqlQuery = `
            SELECT p.pid, p.title, p.start_date, p.end_date, p.short_description, p.phase, u.email, u.username 
            FROM projects p 
            ${joinClause}
            ${whereClause}
            ORDER BY p.start_date DESC
            LIMIT ? OFFSET ?
        `;
        
        // Count query for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM projects p 
            ${joinClause}
            ${whereClause}
        `;
        
        // Execute queries
        if (whereConditions.length > 0) {
            // Search with conditions
            const [projectResults] = await req.db.execute(sqlQuery, [...params, limit, offset]);
            const [countResults] = await req.db.execute(countQuery, params);
            
            projects = projectResults;
            totalCount = countResults[0].total;
        } else {
            // No search conditions - show all projects (for "View All" button)
            const allProjectsQuery = `
                SELECT p.pid, p.title, p.start_date, p.end_date, p.short_description, p.phase, u.email, u.username 
                FROM projects p 
                ${joinClause}
                ORDER BY p.start_date DESC
                LIMIT ? OFFSET ?
            `;
            
            const allCountQuery = `
                SELECT COUNT(*) as total
                FROM projects p 
                ${joinClause}
            `;
            
            const [projectResults] = await req.db.execute(allProjectsQuery, [limit, offset]);
            const [countResults] = await req.db.execute(allCountQuery);
            
            projects = projectResults;
            totalCount = countResults[0].total;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        
        // Create title based on search parameters
        let title = 'Search Results';
        if (searchQuery && searchDate) {
            title = `Search Results for "${searchQuery}" or date "${searchDate}"`;
        } else if (searchQuery) {
            title = `Search Results for "${searchQuery}"`;
        } else if (searchDate) {
            title = `Projects starting on "${searchDate}"`;
        } else {
            title = 'All Projects';
        }
        
        res.render('search-results', {
            title: title,
            currentPage: 'search',
            user: req.session.user || null,
            projects: projects,
            searchQuery: searchQuery || '',        
            searchDate: searchDate || '',          
            selectedPhase: phase || '',
            paginationPage: page,
            totalPages: totalPages,
            totalCount: totalCount,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            errors: errors.array(),
            searchPerformed: !!(searchQuery || searchDate || phase)
        });
        
    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).render('error', {
            title: 'Search Error',
            currentPage: 'search',
            message: 'Search failed. Please try again later.',
            user: req.session.user || null
        });
    }
});

// Browse projects by phase
router.get('/browse/:phase', async (req, res) => {
    try {
        const phase = req.params.phase;
        const validPhases = ['design', 'development', 'testing', 'deployment', 'complete'];
        
        if (!validPhases.includes(phase)) {
            return res.status(404).render('error', {
                title: 'Invalid Phase',
                message: 'The requested project phase is not valid.'
            });
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        
        // Get projects in specific phase
        const query = `
            SELECT p.pid, p.title, p.start_date, p.short_description, p.phase, u.email, u.username 
            FROM projects p 
            JOIN users u ON p.uid = u.uid 
            WHERE p.phase = ?
            ORDER BY p.start_date DESC
            LIMIT ? OFFSET ?
        `;
        
        const countQuery = `
            SELECT COUNT(*) as total
            FROM projects p 
            WHERE p.phase = ?
        `;
        
        const [projects] = await req.db.execute(query, [phase, limit, offset]);
        const [countResults] = await req.db.execute(countQuery, [phase]);
        
        const totalCount = countResults[0].total;
        const totalPages = Math.ceil(totalCount / limit);
        
        res.render('browse-phase', {
            title: `${phase.charAt(0).toUpperCase() + phase.slice(1)} Projects`,
            currentPage: 'browse',
            user: req.session.user || null,
            projects: projects,
            phase: phase,
            currentPage: page,
            totalPages: totalPages,
            totalCount: totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        });
        
    } catch (error) {
        console.error('Error browsing projects by phase:', error);
        res.status(500).render('error', {
            title: 'Browse Error',
            currentPage: 'browse',
            user: req.session.user || null,
            message: 'Unable to browse projects. Please try again later.'
        });
    }
});

// API endpoint for project statistics (public)
router.get('/api/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                phase,
                COUNT(*) as count
            FROM projects 
            GROUP BY phase
        `;
        
        const [stats] = await req.db.execute(statsQuery);
        
        const projectStats = {
            design: 0,
            development: 0,
            testing: 0,
            deployment: 0,
            complete: 0,
            total: 0
        };
        
        stats.forEach(stat => {
            projectStats[stat.phase] = stat.count;
            projectStats.total += stat.count;
        });
        
        res.json(projectStats);
        
    } catch (error) {
        console.error('Get public stats API error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// API endpoint for recent projects (public)
router.get('/api/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        
        const query = `
            SELECT p.pid, p.title, p.start_date, p.phase, u.username 
            FROM projects p 
            JOIN users u ON p.uid = u.uid 
            ORDER BY p.start_date DESC
            LIMIT ?
        `;
        
        const [projects] = await req.db.execute(query, [limit]);
        
        res.json(projects);
        
    } catch (error) {
        console.error('Get recent projects API error:', error);
        res.status(500).json({ error: 'Failed to fetch recent projects' });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Project Management System',
        currentPage: 'about',
        user: req.session.user || null
    });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact Us',
        currentPage: 'contact',
        user: req.session.user || null
    });
});

module.exports = router;