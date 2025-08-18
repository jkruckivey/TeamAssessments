// Batch Assessment Management
class BatchAssessment {
    constructor() {
        this.currentStep = 'classroom-selection';
        this.selectedClassroom = null;
        this.judgeName = '';
        this.teams = [];
        this.currentTeamIndex = 0;
        this.assessments = {};
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTeamsData();
        this.loadSavedProgress();
    }

    bindEvents() {
        // Classroom selection
        document.querySelectorAll('.classroom-option').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectClassroom(e));
        });

        document.getElementById('start-assessment').addEventListener('click', () => this.startAssessment());

        // Navigation
        document.getElementById('prev-team').addEventListener('click', () => this.previousTeam());
        document.getElementById('next-team').addEventListener('click', () => this.nextTeam());
        document.getElementById('save-and-continue').addEventListener('click', () => this.saveAndContinue());
        document.getElementById('back-to-teams').addEventListener('click', () => this.backToTeams());
        document.getElementById('submit-all').addEventListener('click', () => this.submitAllAssessments());

        // Form validation
        document.getElementById('judge-name').addEventListener('input', () => this.validateJudgeName());
        
        // Auto-save on form changes
        document.getElementById('team-assessment-form').addEventListener('change', () => {
            this.debounce(() => this.autoSave(), 1000);
        });
    }

    async loadTeamsData() {
        try {
            const response = await fetch('/api/teams');
            const data = await response.json();
            this.allTeams = data.teams || [];
        } catch (error) {
            console.error('Failed to load teams data:', error);
            this.allTeams = [];
        }
    }

    selectClassroom(e) {
        // Remove previous selection
        document.querySelectorAll('.classroom-option').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Select current classroom
        e.target.classList.add('selected');
        this.selectedClassroom = e.target.dataset.classroom;
        
        // Filter teams for selected classroom
        this.teams = this.allTeams.filter(team => team.group === this.selectedClassroom);
        
        // Enable start button
        this.validateStartButton();
    }

    validateJudgeName() {
        this.judgeName = document.getElementById('judge-name').value.trim();
        this.validateStartButton();
    }

    validateStartButton() {
        const startBtn = document.getElementById('start-assessment');
        const canStart = this.selectedClassroom && this.judgeName.length > 0;
        startBtn.disabled = !canStart;
    }

    startAssessment() {
        if (!this.selectedClassroom || !this.judgeName) return;

        this.currentStep = 'team-assessment';
        this.currentTeamIndex = 0;
        this.showStep('team-assessment');
        this.loadCurrentTeam();
        this.updateProgress();
    }

    loadCurrentTeam() {
        const team = this.teams[this.currentTeamIndex];
        if (!team) return;

        // Update team info display
        document.getElementById('current-team-name').textContent = team.teamName;
        document.getElementById('current-team-members').textContent = team.members;
        document.getElementById('classroom-name').textContent = this.selectedClassroom;
        document.getElementById('current-step').textContent = `Team ${this.currentTeamIndex + 1} of ${this.teams.length}`;

        // Load saved assessment if exists
        this.loadTeamAssessment(team.teamName);
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }

    loadTeamAssessment(teamName) {
        const assessment = this.assessments[teamName];
        if (!assessment) {
            this.clearForm();
            return;
        }

        // Load ratings
        Object.keys(assessment.ratings || {}).forEach(criterion => {
            const radio = document.querySelector(`input[name="${criterion}"][value="${assessment.ratings[criterion]}"]`);
            if (radio) radio.checked = true;
        });

        // Load comments
        Object.keys(assessment.comments || {}).forEach(criterion => {
            const textarea = document.querySelector(`textarea[name="${criterion}Comments"]`);
            if (textarea) textarea.value = assessment.comments[criterion] || '';
        });
    }

    clearForm() {
        document.getElementById('team-assessment-form').reset();
    }

    saveCurrentTeamAssessment() {
        const team = this.teams[this.currentTeamIndex];
        if (!team) return;

        const formData = new FormData(document.getElementById('team-assessment-form'));
        const ratings = {};
        const comments = {};

        // Extract ratings
        ['complexity', 'storytelling', 'actionPlan', 'overall'].forEach(criterion => {
            const value = formData.get(criterion);
            if (value) ratings[criterion] = parseInt(value);
        });

        // Extract comments
        ['complexityComments', 'storytellingComments', 'actionPlanComments', 'overallComments'].forEach(field => {
            const criterion = field.replace('Comments', '');
            comments[criterion] = formData.get(field) || '';
        });

        // Save to assessments object
        this.assessments[team.teamName] = {
            teamName: team.teamName,
            ratings,
            comments,
            timestamp: new Date().toISOString()
        };

        this.saveProgress();
    }

    previousTeam() {
        if (this.currentTeamIndex > 0) {
            this.saveCurrentTeamAssessment();
            this.currentTeamIndex--;
            this.loadCurrentTeam();
            this.updateProgress();
        }
    }

    nextTeam() {
        this.saveCurrentTeamAssessment();
        
        if (this.currentTeamIndex < this.teams.length - 1) {
            this.currentTeamIndex++;
            this.loadCurrentTeam();
            this.updateProgress();
        } else {
            // Last team, go to summary
            this.showSummary();
        }
    }

    saveAndContinue() {
        this.saveCurrentTeamAssessment();
        this.showSaveIndicator();
        
        // Continue to next team or summary
        if (this.currentTeamIndex < this.teams.length - 1) {
            this.nextTeam();
        } else {
            this.showSummary();
        }
    }

    showSummary() {
        this.currentStep = 'assessment-summary';
        this.showStep('assessment-summary');
        this.populateSummary();
    }

    populateSummary() {
        const summaryGrid = document.getElementById('summary-grid');
        document.getElementById('summary-classroom').textContent = this.selectedClassroom;
        
        summaryGrid.innerHTML = '';

        this.teams.forEach(team => {
            const assessment = this.assessments[team.teamName];
            const summaryCard = this.createTeamSummaryCard(team, assessment);
            summaryGrid.appendChild(summaryCard);
        });
    }

    createTeamSummaryCard(team, assessment) {
        const div = document.createElement('div');
        div.className = 'team-summary';
        
        if (!assessment) {
            div.innerHTML = `
                <h4>${team.teamName}</h4>
                <p style="color: #dc3545; font-style: italic;">Not yet assessed</p>
            `;
            return div;
        }

        const total = Object.values(assessment.ratings).reduce((sum, rating) => sum + rating, 0);
        const percentage = Math.round((total / 20) * 100);

        div.innerHTML = `
            <h4>${team.teamName}</h4>
            <div class="rating-summary">
                <span>System Complexity:</span>
                <span>${assessment.ratings.complexity || 'N/A'}/5</span>
            </div>
            <div class="rating-summary">
                <span>Clear Storytelling:</span>
                <span>${assessment.ratings.storytelling || 'N/A'}/5</span>
            </div>
            <div class="rating-summary">
                <span>Action Plan:</span>
                <span>${assessment.ratings.actionPlan || 'N/A'}/5</span>
            </div>
            <div class="rating-summary">
                <span>Overall:</span>
                <span>${assessment.ratings.overall || 'N/A'}/5</span>
            </div>
            <div class="total-score">
                Total Score: ${total}/20 (${percentage}%)
            </div>
        `;

        return div;
    }

    backToTeams() {
        this.currentStep = 'team-assessment';
        this.showStep('team-assessment');
        this.loadCurrentTeam();
        this.updateProgress();
    }

    async submitAllAssessments() {
        if (this.isLoading) return;

        const incompleteTeams = this.teams.filter(team => !this.assessments[team.teamName]);
        
        if (incompleteTeams.length > 0) {
            const proceed = confirm(`${incompleteTeams.length} teams haven't been assessed yet. Do you want to submit anyway?`);
            if (!proceed) return;
        }

        this.isLoading = true;
        const submitBtn = document.getElementById('submit-all');
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        try {
            // Submit each assessment
            const submissions = Object.values(this.assessments).map(assessment => {
                return fetch('/api/assessments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        judgeName: this.judgeName,
                        teamName: assessment.teamName,
                        ratings: assessment.ratings,
                        comments: assessment.comments
                    })
                });
            });

            await Promise.all(submissions);
            
            // Clear saved progress
            this.clearProgress();
            
            alert(`Successfully submitted ${Object.keys(this.assessments).length} team assessments!`);
            window.location.href = '/admin';
            
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Failed to submit assessments. Please try again.');
        } finally {
            this.isLoading = false;
            submitBtn.textContent = 'Submit All Assessments';
            submitBtn.disabled = false;
        }
    }

    updateProgress() {
        const progress = ((this.currentTeamIndex + 1) / this.teams.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-team');
        const nextBtn = document.getElementById('next-team');
        
        prevBtn.disabled = this.currentTeamIndex === 0;
        
        if (this.currentTeamIndex === this.teams.length - 1) {
            nextBtn.textContent = 'Review Summary →';
        } else {
            nextBtn.textContent = 'Next Team →';
        }
    }

    showStep(stepId) {
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(stepId).classList.add('active');
    }

    autoSave() {
        this.saveCurrentTeamAssessment();
        this.showSaveIndicator();
    }

    showSaveIndicator() {
        const indicator = document.getElementById('save-indicator');
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    saveProgress() {
        const progressData = {
            selectedClassroom: this.selectedClassroom,
            judgeName: this.judgeName,
            currentTeamIndex: this.currentTeamIndex,
            assessments: this.assessments,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('batchAssessmentProgress', JSON.stringify(progressData));
    }

    loadSavedProgress() {
        const saved = localStorage.getItem('batchAssessmentProgress');
        if (!saved) return;

        try {
            const progressData = JSON.parse(saved);
            
            // Check if saved data is recent (within 24 hours)
            const saveTime = new Date(progressData.timestamp);
            const now = new Date();
            const hoursDiff = (now - saveTime) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                this.clearProgress();
                return;
            }

            // Restore progress
            this.selectedClassroom = progressData.selectedClassroom;
            this.judgeName = progressData.judgeName;
            this.currentTeamIndex = progressData.currentTeamIndex || 0;
            this.assessments = progressData.assessments || {};

            // Update UI if there's saved progress
            if (this.selectedClassroom && this.judgeName) {
                document.getElementById('judge-name').value = this.judgeName;
                
                const classroomBtn = document.querySelector(`[data-classroom="${this.selectedClassroom}"]`);
                if (classroomBtn) {
                    classroomBtn.classList.add('selected');
                    this.validateStartButton();
                }
            }
            
        } catch (error) {
            console.error('Failed to load saved progress:', error);
            this.clearProgress();
        }
    }

    clearProgress() {
        localStorage.removeItem('batchAssessmentProgress');
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
}

// Initialize the batch assessment when page loads
document.addEventListener('DOMContentLoaded', () => {
    new BatchAssessment();
});