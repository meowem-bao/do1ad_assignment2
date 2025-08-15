// Common JavaScript functionality for all pages

// Client-side form validation
(function() {
    'use strict';
    window.addEventListener('load', function() {
        var forms = document.getElementsByTagName('form');
        var validation = Array.prototype.filter.call(forms, function(form) {
            // Skip forms with onsubmit handlers (like delete forms with confirm dialogs)
            if (form.onsubmit && form.onsubmit.toString().includes('confirm')) {
                return false;
            }
            
            form.addEventListener('submit', function(event) {
                // Date validation for forms with date inputs
                const startDate = document.getElementById('start_date');
                const endDate = document.getElementById('end_date');
                
                if (startDate && endDate && startDate.value && endDate.value) {
                    if (new Date(startDate.value) > new Date(endDate.value)) {
                        event.preventDefault();
                        event.stopPropagation();
                        alert('End date cannot be before start date.');
                        return false;
                    }
                }
                
                if (form.checkValidity() === false) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                form.classList.add('was-validated');
            }, false);
        });
    }, false);
})();

// Character counter for description fields
document.addEventListener('DOMContentLoaded', function() {
    const descriptionField = document.getElementById('short_description');
    if (descriptionField) {
        function updateCharacterCount() {
            const maxLength = 500;
            const currentLength = descriptionField.value.length;
            const remaining = maxLength - currentLength;
            
            let helpText = document.querySelector('#short_description + .form-text');
            if (!helpText) {
                helpText = document.createElement('div');
                helpText.className = 'form-text character-counter';
                descriptionField.parentNode.insertBefore(helpText, descriptionField.nextSibling);
            }
            
            helpText.textContent = `${remaining} characters remaining`;
            helpText.className = 'form-text character-counter';
            
            if (remaining < 50) {
                helpText.classList.add('text-warning');
                helpText.classList.remove('text-danger');
            } else if (remaining < 0) {
                helpText.classList.add('text-danger');
                helpText.classList.remove('text-warning');
            } else {
                helpText.classList.remove('text-warning', 'text-danger');
            }
        }
        
        descriptionField.addEventListener('input', updateCharacterCount);
        
        // Initialize counter if field has content
        if (descriptionField.value.length > 0) {
            updateCharacterCount();
        }
    }
    
    // Auto-focus first input on forms
    const firstInput = document.querySelector('input[type="text"]:not([readonly]), input[type="email"]:not([readonly])');
    if (firstInput && !document.querySelector('.alert')) {
        firstInput.focus();
    }
    
    // Auto-focus search input on search pages
    const searchInput = document.querySelector('input[name="query"]');
    if (searchInput) {
        searchInput.focus();
    }
});