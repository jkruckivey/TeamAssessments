const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// In-memory storage (for development - use database in production)
let assessments = [];
let teams = [];
let judges = [];

// Initialize data
async function initializeData() {
    try {
        // Load existing data if available
        try {
            const assessmentData = await fs.readFile('data/assessments.json', 'utf8');
            assessments = JSON.parse(assessmentData);
        } catch (error) {
            console.log('No existing assessment data found, starting fresh');
        }

        try {
            const teamData = await fs.readFile('data/teams.json', 'utf8');
            teams = JSON.parse(teamData);
        } catch (error) {
            console.log('No existing team data found, starting fresh');
        }

        try {
            const judgeData = await fs.readFile('data/judges.json', 'utf8');
            judges = JSON.parse(judgeData);
        } catch (error) {
            console.log('No existing judge data found, starting fresh');
        }
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

// Save data to files
async function saveData() {
    if (process.env.NODE_ENV !== 'production') {
        try {
            await fs.mkdir('data', { recursive: true });
            await fs.writeFile('data/assessments.json', JSON.stringify(assessments, null, 2));
            await fs.writeFile('data/teams.json', JSON.stringify(teams, null, 2));
            await fs.writeFile('data/judges.json', JSON.stringify(judges, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Test email configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.log('Email configuration error:', error.message);
        console.log('Note: Email notifications will not work. Please configure EMAIL_USER and EMAIL_PASS in .env file');
    } else {
        console.log('Email server is ready to send notifications');
    }
});

// Send assessment notification email
async function sendAssessmentNotification(assessment) {
    try {
        const totalRating = assessment.ratings.complexity + assessment.ratings.storytelling + 
                          assessment.ratings.actionPlan + assessment.ratings.overall;
        const totalScore = ((totalRating / 20) * 100).toFixed(1);
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: 'jkrcuk@ivey.ca',
            subject: `New Team Assessment Submitted - ${assessment.teamName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .header { background: #c5b783; color: #2c2c2c; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .assessment-details { background: #fafaf8; padding: 15px; margin: 15px 0; border-left: 4px solid #c5b783; }
                        .rating-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
                        .rating-item { background: white; padding: 10px; border: 1px solid #e5e5e5; }
                        .score-highlight { font-size: 1.2em; font-weight: bold; color: #c5b783; }
                        .comments { margin: 15px 0; padding: 10px; background: #f9f9f9; border: 1px solid #e5e5e5; }
                        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🎯 New Team Assessment Received</h1>
                        <p>Ivey EdTech Lab • Team Assessment Platform</p>
                    </div>
                    
                    <div class="content">
                        <div class="assessment-details">
                            <h2>Assessment Summary</h2>
                            <p><strong>Judge:</strong> ${assessment.judgeName}</p>
                            <p><strong>Team:</strong> ${assessment.teamName}</p>
                            <p><strong>Overall Score:</strong> <span class="score-highlight">${totalScore}%</span></p>
                            <p><strong>Submitted:</strong> ${new Date(assessment.submittedAt).toLocaleString()}</p>
                        </div>
                        
                        <h3>Individual Ratings (1-5 Scale)</h3>
                        <div class="rating-grid">
                            <div class="rating-item">
                                <strong>System Complexity Understanding</strong><br>
                                Rating: ${assessment.ratings.complexity}/5
                            </div>
                            <div class="rating-item">
                                <strong>Clear Storytelling</strong><br>
                                Rating: ${assessment.ratings.storytelling}/5
                            </div>
                            <div class="rating-item">
                                <strong>Systems-Oriented Action Plan</strong><br>
                                Rating: ${assessment.ratings.actionPlan}/5
                            </div>
                            <div class="rating-item">
                                <strong>Overall Assessment</strong><br>
                                Rating: ${assessment.ratings.overall}/5
                            </div>
                        </div>
                        
                        ${assessment.comments.complexity || assessment.comments.storytelling || assessment.comments.actionPlan || assessment.comments.overall ? `
                        <h3>Judge Comments</h3>
                        ${assessment.comments.complexity ? `<div class="comments"><strong>Complexity:</strong> ${assessment.comments.complexity}</div>` : ''}
                        ${assessment.comments.storytelling ? `<div class="comments"><strong>Storytelling:</strong> ${assessment.comments.storytelling}</div>` : ''}
                        ${assessment.comments.actionPlan ? `<div class="comments"><strong>Action Plan:</strong> ${assessment.comments.actionPlan}</div>` : ''}
                        ${assessment.comments.overall ? `<div class="comments"><strong>Overall:</strong> ${assessment.comments.overall}</div>` : ''}
                        ` : '<p><em>No additional comments provided by the judge.</em></p>'}
                        
                        <p style="margin-top: 25px;">
                            <a href="http://localhost:${PORT}/admin" style="background: #c5b783; color: #2c2c2c; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                                📊 View Admin Dashboard
                            </a>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>This assessment was automatically submitted through the Ivey Team Assessment Platform.</p>
                        <p>Assessment ID: ${assessment.id}</p>
                    </div>
                </body>
                </html>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`📧 Assessment notification sent for team: ${assessment.teamName}`);
        return true;
        
    } catch (error) {
        console.error('Error sending email notification:', error.message);
        return false;
    }
}

// Routes

// Serve main assessment form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Get all teams
app.get('/api/teams', (req, res) => {
    res.json(teams);
});

// Add new team
app.post('/api/teams', (req, res) => {
    const { name } = req.body;
    const team = {
        id: uuidv4(),
        name: name.trim(),
        createdAt: new Date().toISOString()
    };
    
    teams.push(team);
    saveData();
    res.json(team);
});

// Submit assessment
app.post('/api/assessments', async (req, res) => {
    try {
        const {
            judgeName,
            teamName,
            ratings,
            comments
        } = req.body;

        // Validate required fields
        if (!judgeName || !teamName || !ratings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const assessment = {
            id: uuidv4(),
            judgeName: judgeName.trim(),
            teamName: teamName.trim(),
            ratings: {
                complexity: parseInt(ratings.complexity) || 1,
                storytelling: parseInt(ratings.storytelling) || 1,
                actionPlan: parseInt(ratings.actionPlan) || 1,
                overall: parseInt(ratings.overall) || 1
            },
            comments: {
                complexity: comments?.complexity || '',
                storytelling: comments?.storytelling || '',
                actionPlan: comments?.actionPlan || '',
                overall: comments?.overall || ''
            },
            submittedAt: new Date().toISOString()
        };

        assessments.push(assessment);
        await saveData();

        // Send email notification (don't wait for it to complete)
        sendAssessmentNotification(assessment).catch(error => {
            console.error('Failed to send email notification:', error.message);
        });

        res.json({ 
            success: true, 
            message: 'Assessment submitted successfully',
            assessmentId: assessment.id
        });

    } catch (error) {
        console.error('Error submitting assessment:', error);
        res.status(500).json({ error: 'Failed to submit assessment' });
    }
});

// Get all assessments
app.get('/api/assessments', (req, res) => {
    res.json(assessments);
});

// Get assessments by team
app.get('/api/assessments/team/:teamName', (req, res) => {
    const teamName = req.params.teamName;
    const teamAssessments = assessments.filter(a => 
        a.teamName.toLowerCase() === teamName.toLowerCase()
    );
    res.json(teamAssessments);
});

// Get assessment analytics
app.get('/api/analytics', (req, res) => {
    try {
        // Group assessments by team
        const teamStats = {};
        
        assessments.forEach(assessment => {
            const teamName = assessment.teamName;
            
            if (!teamStats[teamName]) {
                teamStats[teamName] = {
                    teamName,
                    assessments: [],
                    averages: {
                        complexity: 0,
                        storytelling: 0,
                        actionPlan: 0,
                        overall: 0
                    },
                    totalScore: 0,
                    judgeCount: 0
                };
            }
            
            teamStats[teamName].assessments.push(assessment);
            teamStats[teamName].judgeCount++;
        });
        
        // Calculate averages
        Object.values(teamStats).forEach(team => {
            const totals = { complexity: 0, storytelling: 0, actionPlan: 0, overall: 0 };
            
            team.assessments.forEach(assessment => {
                totals.complexity += assessment.ratings.complexity;
                totals.storytelling += assessment.ratings.storytelling;
                totals.actionPlan += assessment.ratings.actionPlan;
                totals.overall += assessment.ratings.overall;
            });
            
            const count = team.judgeCount;
            team.averages = {
                complexity: (totals.complexity / count).toFixed(2),
                storytelling: (totals.storytelling / count).toFixed(2),
                actionPlan: (totals.actionPlan / count).toFixed(2),
                overall: (totals.overall / count).toFixed(2)
            };
            
            team.totalScore = (
                (totals.complexity + totals.storytelling + totals.actionPlan + totals.overall) 
                / (count * 4) * 100
            ).toFixed(1);
        });
        
        const analytics = {
            totalAssessments: assessments.length,
            totalTeams: Object.keys(teamStats).length,
            teamStats: Object.values(teamStats).sort((a, b) => b.totalScore - a.totalScore),
            judgeList: [...new Set(assessments.map(a => a.judgeName))]
        };
        
        res.json(analytics);
        
    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({ error: 'Failed to generate analytics' });
    }
});

// Export assessments as CSV
app.get('/api/export/csv', (req, res) => {
    try {
        const csvHeader = 'Judge Name,Team Name,Complexity Understanding,Clear Storytelling,Systems Action Plan,Overall Assessment,Complexity Comments,Storytelling Comments,Action Plan Comments,Overall Comments,Submitted At\n';
        
        const csvRows = assessments.map(assessment => {
            return [
                assessment.judgeName,
                assessment.teamName,
                assessment.ratings.complexity,
                assessment.ratings.storytelling,
                assessment.ratings.actionPlan,
                assessment.ratings.overall,
                `"${assessment.comments.complexity.replace(/"/g, '""')}"`,
                `"${assessment.comments.storytelling.replace(/"/g, '""')}"`,
                `"${assessment.comments.actionPlan.replace(/"/g, '""')}"`,
                `"${assessment.comments.overall.replace(/"/g, '""')}"`,
                assessment.submittedAt
            ].join(',');
        });
        
        const csvContent = csvHeader + csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="team-assessments.csv"');
        res.send(csvContent);
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        assessments: assessments.length,
        teams: teams.length
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Team Assessment Server running on port ${PORT}`);
        console.log(`Assessment Form: http://localhost:${PORT}`);
        console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
        console.log(`Current assessments: ${assessments.length}`);
    });
});