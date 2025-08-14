class TeamAssessmentForm {
    constructor() {
        this.form = document.getElementById('assessment-form');
        this.successMessage = document.getElementById('success-message');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            this.form.addEventListener('reset', () => this.handleReset());
        }

        // Add visual feedback for radio button selections
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => this.updateRatingDisplay(e));
        });
    }

    updateRatingDisplay(event) {
        const selectedRadio = event.target;
        const criterion = selectedRadio.name;
        
        // Remove active class from all options in this criterion
        const allOptionsInCriterion = document.querySelectorAll(`input[name="${criterion}"]`);
        allOptionsInCriterion.forEach(radio => {
            radio.closest('.rating-option').classList.remove('selected');
        });
        
        // Add active class to selected option
        selectedRadio.closest('.rating-option').classList.add('selected');
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        try {
            // Show loading state
            this.setLoadingState(true);
            
            // Collect form data
            const formData = this.collectFormData();
            
            // Validate required fields
            if (!this.validateForm(formData)) {
                this.setLoadingState(false);
                return;
            }
            
            // Submit assessment
            await this.submitAssessment(formData);
            
            // Show success message
            this.showSuccess();
            
        } catch (error) {
            console.error('Error submitting assessment:', error);
            this.showError('Failed to submit assessment. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    collectFormData() {
        const formData = new FormData(this.form);
        
        return {
            judgeName: formData.get('judgeName')?.trim(),
            teamName: formData.get('teamName')?.trim(),
            ratings: {
                complexity: formData.get('complexity'),
                storytelling: formData.get('storytelling'),
                actionPlan: formData.get('actionPlan'),
                overall: formData.get('overall')
            },
            comments: {
                complexity: formData.get('complexityComments')?.trim() || '',
                storytelling: formData.get('storytellingComments')?.trim() || '',
                actionPlan: formData.get('actionPlanComments')?.trim() || '',
                overall: formData.get('overallComments')?.trim() || ''
            }
        };
    }

    validateForm(data) {
        const errors = [];
        
        if (!data.judgeName) {
            errors.push('Judge name is required');
        }
        
        if (!data.teamName) {
            errors.push('Team name is required');
        }
        
        if (!data.ratings.complexity) {
            errors.push('System complexity understanding rating is required');
        }
        
        if (!data.ratings.storytelling) {
            errors.push('Clear storytelling rating is required');
        }
        
        if (!data.ratings.actionPlan) {
            errors.push('Systems action plan rating is required');
        }
        
        if (!data.ratings.overall) {
            errors.push('Overall assessment rating is required');
        }
        
        if (errors.length > 0) {
            this.showError(errors.join('\\n'));
            return false;
        }
        
        return true;
    }

    async submitAssessment(data) {
        const response = await fetch('/api/assessments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...data, group: getGroupFromUrl() })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit assessment');
        }
        
        return await response.json();
    }

    setLoadingState(loading) {
        const submitButton = this.form.querySelector('.btn-primary');
        const form = this.form;
        
        if (loading) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            form.classList.add('loading');
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Assessment';
            form.classList.remove('loading');
        }
    }

    showSuccess() {
        // Hide the form
        this.form.style.display = 'none';
        
        // Show success message
        this.successMessage.style.display = 'block';
        
        // Scroll to success message
        this.successMessage.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }

    showError(message) {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(error => error.remove());
        
        // Create new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<p><strong>Error:</strong> ${message.replace(/\\n/g, '<br>')}</p>`;
        errorDiv.style.cssText = `
            background: #ffebee;
            border: 2px solid #f44336;
            padding: 1rem;
            margin: 1rem 0;
            color: #d32f2f;
            font-weight: 500;
        `;
        
        // Insert at top of form
        this.form.insertBefore(errorDiv, this.form.firstChild);
        
        // Scroll to error
        errorDiv.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 8000);
    }

    handleReset() {
        // Remove any error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(error => error.remove());
        
        // Reset radio button displays
        const allRatingOptions = document.querySelectorAll('.rating-option');
        allRatingOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        // Clear any loading states
        this.setLoadingState(false);
        
        console.log('Form reset completed');
    }
}

// Utility functions for team management
class TeamManager {
    static async loadTeams() {
        try {
            const response = await fetch(`/api/teams?group=${encodeURIComponent(getGroupFromUrl())}`);
            const teams = await response.json();
            return teams;
        } catch (error) {
            console.error('Error loading teams:', error);
            return [];
        }
    }

    static async addTeam(teamName) {
        try {
            const response = await fetch('/api/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: teamName })
            });
            
            if (!response.ok) {
                throw new Error('Failed to add team');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error adding team:', error);
            throw error;
        }
    }
}

// Auto-complete functionality for team names
class TeamAutocomplete {
    constructor() {
        this.teamInput = document.getElementById('team-name');
        this.teams = [];
        this.initialize();
    }

    async initialize() {
        if (!this.teamInput) return;
        
        // Load existing teams
        this.teams = await TeamManager.loadTeams();
        
        // Create datalist for autocomplete
        this.createDatalist();
        
        // Add event listeners
        this.teamInput.addEventListener('input', (e) => this.handleInput(e));
    }

    createDatalist() {
        // Remove existing datalist
        const existingDatalist = document.getElementById('team-names');
        if (existingDatalist) {
            existingDatalist.remove();
        }
        
        // Create new datalist
        const datalist = document.createElement('datalist');
        datalist.id = 'team-names';
        
        this.teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.name;
            datalist.appendChild(option);
        });
        
        // Add datalist to input
        this.teamInput.setAttribute('list', 'team-names');
        this.teamInput.parentNode.appendChild(datalist);
    }

    handleInput(event) {
        const input = event.target.value.trim();
        
        // Provide visual feedback for team name matching
        const isExistingTeam = this.teams.some(team => 
            team.name.toLowerCase() === input.toLowerCase()
        );
        
        if (input && isExistingTeam) {
            this.teamInput.style.borderColor = '#4caf50';
            this.teamInput.style.background = '#f1f8e9';
        } else if (input) {
            this.teamInput.style.borderColor = '#c5b783';
            this.teamInput.style.background = '#fffbf0';
        } else {
            this.teamInput.style.borderColor = '#e5e5e5';
            this.teamInput.style.background = 'white';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {\n    const adminLink = document.querySelector('.admin-link');\n    if (adminLink) {\n      const g = getGroupFromUrl();\n      const url = new URL(adminLink.getAttribute('href'), window.location.origin);\n      url.searchParams.set('group', g);\n      adminLink.setAttribute('href', url.pathname + url.search);\n    }
    new TeamAssessmentForm();
    new TeamAutocomplete();
    
    console.log('Team Assessment Form initialized');
    
    // Check API health
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('API Status:', data);
        })
        .catch(error => {
            console.warn('API health check failed:', error);
        });
});

// Export for potential use in other scripts
window.TeamAssessmentForm = TeamAssessmentForm;
window.TeamManager = TeamManager;