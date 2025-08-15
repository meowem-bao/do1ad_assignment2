const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Import auth middleware
const { requireAuth } = require('./auth');

// Validation middleware for projects
const projectValidation = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Project title must be between 3 and 100 characters'),
    
    body('short_description')
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Short description must be between 10 and 500 characters'),
    
    body('start_date')
        .isISO8601()
        .withMessage('Please provide a valid start date'),
    
    body('end_date')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Please provide a valid end date')
        .custom((value, { req }) => {
            if (value && req.body.start_date && new Date(value) <= new Date(req.body.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    body('phase')
        .isIn(['design', 'development', 'testing', 'deployment', 'complete'])
        .withMessage('Please select a valid phase')
];

// Dashboard - Show user's projects
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT p.*, COUNT(p.pid) as project_count
            FROM projects p 
            WHERE p.uid = ? 
            ORDER BY p.start_date DESC
        `;
        
        const [projects] = await req.db.execute(
            'SELECT * FROM projects WHERE uid = ? ORDER BY start_date DESC', 
            [req.session.user.uid]
        );
        
        // Get project statistics
        const statsQuery = `
            SELECT 
                phase,
                COUNT(*) as count
            FROM projects 
            WHERE uid = ? 
            GROUP BY phase
        `;
        
        const [stats] = await req.db.execute(statsQuery, [req.session.user.uid]);
        
        // Process stats into a more usable format
        const projectStats = {
            design: 0,
            development: 0,
            testing: 0,
            deployment: 0,
            complete: 0,
            total: projects.length
        };
        
        stats.forEach(stat => {
            projectStats[stat.phase] = stat.count;
        });
        
        res.render('dashboard', {
            title: 'Dashboard',
            currentPage: 'dashboard',
            user: req.session.user,
            projects: projects,
            stats: projectStats,
            successMessage: req.session.successMessage || null,
            errorMessage: req.session.errorMessage || null
        });
        
        // Clear flash messages
        delete req.session.successMessage;
        delete req.session.errorMessage;
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            title: 'Dashboard Error',
            currentPage: 'dashboard',
            message: 'Unable to load dashboard'
        });
    }
});

// View project details
router.get('/project/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Get project with user information
        const query = `
            SELECT p.*, u.username, u.email 
            FROM projects p 
            JOIN users u ON p.uid = u.uid 
            WHERE p.pid = ?
        `;
        
        const [projects] = await req.db.execute(query, [projectId]);
        
        if (projects.length === 0) {
            return res.status(404).render('error', {
                title: 'Project Not Found',
                message: 'The project you are looking for does not exist.',
                user: req.session.user || null
            });
        }
        
        const project = projects[0];
        
        // Check if current user owns this project (for edit/delete buttons)
        const isOwner = req.session.user && req.session.user.uid === project.uid;
        
        res.render('project-details', {
            title: `${project.title} - Project Details`,
            user: req.session.user || null,
            project: project,
            isOwner: isOwner
        });
        
    } catch (error) {
        console.error('Project details error:', error);
        res.status(500).render('error', {
            title: 'Error Loading Project',
            message: 'Unable to load project details. Please try again later.',
            user: req.session.user || null
        });
    }
});

// Add project form
router.get('/add-project', requireAuth, (req, res) => {
    res.render('add-project', {
        title: 'Add New Project',
        currentPage: 'add-project',
        user: req.session.user,
        errors: [],
        formData: {}
    });
});

// Handle add project
router.post('/add-project', requireAuth, projectValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        const { title, short_description, start_date, end_date, phase } = req.body;
        
        const formData = { title, short_description, start_date, end_date, phase };
        
        if (!errors.isEmpty()) {
            return res.render('add-project', {
                title: 'Add New Project',
                currentPage: 'add-project',
                user: req.session.user,
                errors: errors.array(),
                formData: formData
            });
        }
        
        // Insert new project
        const insertQuery = `
            INSERT INTO projects (title, short_description, start_date, end_date, phase, uid) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            title.trim(),
            short_description.trim(),
            start_date,
            end_date || null,
            phase,
            req.session.user.uid
        ];
        
        await req.db.execute(insertQuery, values);
        
        req.session.successMessage = 'Project added successfully!';
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Add project error:', error);
        res.render('add-project', {
            title: 'Add New Project',
            currentPage: 'add-project',
            user: req.session.user,
            errors: [{ msg: 'Failed to add project. Please try again.' }],
            formData: req.body
        });
    }
});

// Edit project form
router.get('/edit-project/:id', requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const query = 'SELECT * FROM projects WHERE pid = ? AND uid = ?';
        const [projects] = await req.db.execute(query, [projectId, req.session.user.uid]);
        
        if (projects.length === 0) {
            req.session.errorMessage = 'Project not found or you do not have permission to edit it.';
            return res.redirect('/dashboard');
        }
        
        const project = projects[0];
        
        res.render('edit-project', {
            title: `Edit Project: ${project.title}`,
            currentPage: 'dashboard',
            user: req.session.user,
            project: project,
            errors: [],
            formData: project
        });
        
    } catch (error) {
        console.error('Edit project error:', error);
        req.session.errorMessage = 'Unable to load project for editing.';
        res.redirect('/dashboard');
    }
});

// Handle edit project
router.post('/edit-project/:id', requireAuth, projectValidation, async (req, res) => {
    try {
        const projectId = req.params.id;
        const errors = validationResult(req);
        const { title, short_description, start_date, end_date, phase } = req.body;
        
        const formData = { title, short_description, start_date, end_date, phase };
        
        // First, verify the project belongs to the user
        const checkQuery = 'SELECT * FROM projects WHERE pid = ? AND uid = ?';
        const [existingProjects] = await req.db.execute(checkQuery, [projectId, req.session.user.uid]);
        
        if (existingProjects.length === 0) {
            req.session.errorMessage = 'Project not found or you do not have permission to edit it.';
            return res.redirect('/dashboard');
        }
        
        if (!errors.isEmpty()) {
            return res.render('edit-project', {
                title: `Edit Project: ${formData.title}`,
                currentPage: 'dashboard',
                project: { pid: projectId, ...formData },
                errors: errors.array(),
                formData: formData
            });
        }
        
        // Update project
        const updateQuery = `
            UPDATE projects 
            SET title = ?, short_description = ?, start_date = ?, end_date = ?, phase = ?
            WHERE pid = ? AND uid = ?
        `;
        
        const values = [
            title.trim(),
            short_description.trim(),
            start_date,
            end_date || null,
            phase,
            projectId,
            req.session.user.uid
        ];
        
        await req.db.execute(updateQuery, values);
        
        req.session.successMessage = 'Project updated successfully!';
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Update project error:', error);
        res.render('edit-project', {
            title: 'Edit Project',
            currentPage: 'dashboard',
            project: { pid: req.params.id, ...req.body },
            errors: [{ msg: 'Failed to update project. Please try again.' }],
            formData: req.body
        });
    }
});

// Delete project
router.post('/delete-project/:id', requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Verify the project belongs to the user and delete it
        const deleteQuery = 'DELETE FROM projects WHERE pid = ? AND uid = ?';
        const [result] = await req.db.execute(deleteQuery, [projectId, req.session.user.uid]);
        
        if (result.affectedRows === 0) {
            req.session.errorMessage = 'Project not found or you do not have permission to delete it.';
        } else {
            req.session.successMessage = 'Project deleted successfully!';
        }
        
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Delete project error:', error);
        req.session.errorMessage = 'Failed to delete project. Please try again.';
        res.redirect('/dashboard');
    }
});

// Get project data as JSON (for AJAX requests)
router.get('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const query = 'SELECT * FROM projects WHERE pid = ? AND uid = ?';
        const [projects] = await req.db.execute(query, [projectId, req.session.user.uid]);
        
        if (projects.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json(projects[0]);
        
    } catch (error) {
        console.error('Get project API error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Get user's projects statistics as JSON
router.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                phase,
                COUNT(*) as count
            FROM projects 
            WHERE uid = ? 
            GROUP BY phase
        `;
        
        const [stats] = await req.db.execute(statsQuery, [req.session.user.uid]);
        
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
        console.error('Get stats API error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;