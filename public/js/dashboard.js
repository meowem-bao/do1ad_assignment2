// Dashboard filtering functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard JS loaded');
    
    const statCards = document.querySelectorAll('.stat-card');
    const projectCards = document.querySelectorAll('.project-card');
    const filterDisplay = document.getElementById('filterDisplay');
    const currentFilter = document.getElementById('currentFilter');
    const clearFilter = document.getElementById('clearFilter');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const projectsContainer = document.getElementById('projectsContainer');

    console.log('Found stat cards:', statCards.length);
    console.log('Found project cards:', projectCards.length);

    if (statCards.length > 0) {
        // Add click handlers to stat cards
        statCards.forEach((card, index) => {
            console.log('Adding click handler to card', index, 'with phase:', card.getAttribute('data-phase'));
            
            card.addEventListener('click', function(e) {
                console.log('Stat card clicked:', this.getAttribute('data-phase'));
                const phase = this.getAttribute('data-phase');
                filterProjectsByPhase(phase);
                
                // Update active state
                statCards.forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Clear filter functionality
        if (clearFilter) {
            clearFilter.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Clear filter clicked');
                filterProjectsByPhase('all');
                statCards.forEach(c => c.classList.remove('active'));
            });
        }

        function filterProjectsByPhase(phase) {
            console.log('Filtering by phase:', phase);
            let visibleCount = 0;

            if (projectCards.length === 0) {
                console.log('No project cards found');
                return;
            }

            projectCards.forEach((card, index) => {
                const projectPhase = card.getAttribute('data-phase');
                console.log(`Project ${index}: phase=${projectPhase}, target=${phase}`);
                
                if (phase === 'all' || projectPhase === phase) {
                    // Remove any inline display style to let CSS take over
                    card.style.removeProperty('display');
                    visibleCount++;
                    console.log(`Showing project ${index}`);
                } else {
                    card.style.display = 'none';
                    console.log(`Hiding project ${index}`);
                }
            });

            console.log(`Visible projects: ${visibleCount}`);

            // Update filter display
            if (phase === 'all') {
                if (filterDisplay) filterDisplay.style.display = 'none';
            } else {
                if (filterDisplay) {
                    filterDisplay.style.display = 'block';
                    if (currentFilter) {
                        currentFilter.textContent = phase.charAt(0).toUpperCase() + phase.slice(1);
                    }
                }
            }

            // Show/hide no results message
            if (visibleCount === 0 && phase !== 'all') {
                if (projectsContainer) projectsContainer.style.display = 'none';
                if (noResultsMessage) noResultsMessage.style.display = 'block';
            } else {
                if (projectsContainer) {
                    // Reset container display to let CSS handle it
                    projectsContainer.style.removeProperty('display');
                }
                if (noResultsMessage) noResultsMessage.style.display = 'none';
            }
        }

        // Test function - you can call this in browser console
        window.testFilter = function(phase) {
            console.log('Testing filter for phase:', phase);
            filterProjectsByPhase(phase);
        };
        
        console.log('Dashboard filtering initialized successfully');
    } else {
        console.log('No stat cards found - filtering not initialized');
    }
});