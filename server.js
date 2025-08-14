const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
// Helper to normalize group slug
function normalizeGroup(value) {
  const v = (value ?? "").toString().trim();
  return v.length ? v : "default";
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// In-memory storage (for development - use database in production)
let assessments = [];
let teams = [];
let judges = [];

// Initialize data
async function initializeData() {
    try {
        // Load existing data if available
        try {
            const assessmentData = await fs.readFile(path.join(DATA_DIR, 'assessments.json'), 'utf8');
            assessments = JSON.parse(assessmentData);
        } catch (error) {
            console.log('No existing assessment data found, starting fresh');
        }

        try {
            const teamData = await fs.readFile(path.join(DATA_DIR, 'teams.json'), 'utf8');
            teams = JSON.parse(teamData);
        } catch (error) {
            console.log('No existing team data found, starting fresh');
        }

        try {
            const judgeData = await fs.readFile(path.join(DATA_DIR, 'judges.json'), 'utf8');
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
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(path.join(DATA_DIR, 'assessments.json'), JSON.stringify(assessments, null, 2));
        await fs.writeFile(path.join(DATA_DIR, 'teams.json'), JSON.stringify(teams, null, 2));
        await fs.writeFile(path.join(DATA_DIR, 'judges.json'), JSON.stringify(judges, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
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

// CSV Processing Functions
async function parseCSV(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString());
        
        stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

function validateTeamData(data) {
    const errors = [];
    const validTeams = [];
    const seenTeams = new Set();
    
    data.forEach((row, index) => {
        const rowNum = index + 1;
        
        // Check for team name field (support multiple possible column names)
        const teamName = row['team_name'] || row['teamName'] || row['Team Name'] || 
                         row['name'] || row['Name'] || row['team'] || row['Team'];
        
        if (!teamName || !teamName.trim()) {
            errors.push(`Row ${rowNum}: Missing team name`);
            return;
        }
        
        const cleanName = teamName.trim();
        
        if (seenTeams.has(cleanName.toLowerCase())) {
            errors.push(`Row ${rowNum}: Duplicate team name "${cleanName}"`);
            return;
        }
        
        seenTeams.add(cleanName.toLowerCase());
        validTeams.push({
            id: uuidv4(),
            name: cleanName,
            createdAt: new Date().toISOString(),
            source: 'csv_upload'
        });
    });
    
    return { errors, validTeams };
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
  const group = normalizeGroup(req.query.group);
  const result = teams.filter(t => normalizeGroup(t.group) === group);
  res.json(result);
});

// Submit assessment
app.post('/api/assessments', async (req, res) => {
  try {
    const { judgeName, teamName, ratings, comments, group: bodyGroup } = req.body;
    const group = normalizeGroup(bodyGroup || req.query.group);
    if (!judgeName || !teamName || !ratings) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const assessment = {
      id: uuidv4(),
      judgeName: judgeName.trim(),
      teamName: teamName.trim(),
      group,
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

    // Send email notification (don't wait for it to complete)
    sendAssessmentNotification(assessment).catch(error => {
      console.error('Failed to send email notification:', error.message);
    });

    await saveData();

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
  const group = req.query.group ? normalizeGroup(req.query.group) : null;
  const result = group ? assessments.filter(a => normalizeGroup(a.group) === group) : assessments;
  res.json(result);
});

// Add a team (assign group)
app.post('/api/teams', (req, res) => {
    const { name, group: bodyGroup } = req.body;
    const group = normalizeGroup(bodyGroup || req.query.group);
    const team = { id: uuidv4(), name: name.trim(), group, createdAt: new Date().toISOString() };
    teams.push(team);
    saveData();
    res.json(team);
});

// Upload teams from CSV (scoped by group)
app.post('/api/teams/upload', upload.single('csvFile'), async (req, res) => {
    try {
        const group = normalizeGroup(req.query.group);
        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }
        const csvData = await parseCSV(req.file.buffer);
        if (csvData.length === 0) {
            return res.status(400).json({
                error: 'CSV file is empty or invalid',
                expectedFormat: 'CSV should have columns: team_name, teamName, Team Name, name, or Name'
            });
        }
        const { errors, validTeams } = validateTeamData(csvData);
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation errors found',
                details: errors,
                validTeams: validTeams.length,
                totalRows: csvData.length
            });
        }
        const existingTeamNames = new Set(
            teams.filter(t => normalizeGroup(t.group) === group).map(t => t.name.toLowerCase())
        );
        const duplicates = [];
        const newTeams = [];
        validTeams.forEach(team => {
            if (existingTeamNames.has(team.name.toLowerCase())) {
                duplicates.push(team.name);
            } else {
                team.group = group;
                newTeams.push(team);
                existingTeamNames.add(team.name.toLowerCase());
            }
        });
        teams.push(...newTeams);
        await saveData();
        const result = {
            success: true,
            message: `Successfully imported ${newTeams.length} teams`,
            imported: newTeams.length,
            duplicatesSkipped: duplicates.length,
            totalProcessed: validTeams.length,
            newTeams: newTeams.map(t => ({ name: t.name, id: t.id }))
        };
        if (duplicates.length > 0) {
            result.duplicates = duplicates;
            result.message += ` (${duplicates.length} duplicates skipped)`;
        }
        console.log(`CSV Import [group=${group}]: ${newTeams.length} teams added, ${duplicates.length} duplicates skipped`);
        res.json(result);
    } catch (error) {
        console.error('Error processing CSV upload:', error);
        res.status(500).json({
            error: 'Failed to process CSV file',
            details: error.message
        });
    }
});

// Get assessments by team (optional group)
app.get('/api/assessments/team/:teamName', (req, res) => {
    const teamName = req.params.teamName;
    const group = req.query.group ? normalizeGroup(req.query.group) : null;
    const teamAssessments = assessments.filter(a =>
        a.teamName.toLowerCase() === teamName.toLowerCase() && (!group || normalizeGroup(a.group) === group)
    );
    res.json(teamAssessments);
});

// Analytics (scoped by group if provided)
app.get('/api/analytics', (req, res) => {
    try {
        const group = req.query.group ? normalizeGroup(req.query.group) : null;
        const source = group ? assessments.filter(a => normalizeGroup(a.group) === group) : assessments;
        const teamStats = {};
        source.forEach(assessment => {
            const name = assessment.teamName;
            if (!teamStats[name]) {
                teamStats[name] = {
                    teamName: name,
                    assessments: [],
                    averages: { complexity: 0, storytelling: 0, actionPlan: 0, overall: 0 },
                    totalScore: 0,
                    judgeCount: 0
                };
            }
            teamStats[name].assessments.push(assessment);
            teamStats[name].judgeCount++;
        });
        Object.values(teamStats).forEach(team => {
            const totals = { complexity: 0, storytelling: 0, actionPlan: 0, overall: 0 };
            team.assessments.forEach(a => {
                totals.complexity += a.ratings.complexity;
                totals.storytelling += a.ratings.storytelling;
                totals.actionPlan += a.ratings.actionPlan;
                totals.overall += a.ratings.overall;
            });
            const count = team.judgeCount || 1;
            team.averages = {
                complexity: (totals.complexity / count).toFixed(2),
                storytelling: (totals.storytelling / count).toFixed(2),
                actionPlan: (totals.actionPlan / count).toFixed(2),
                overall: (totals.overall / count).toFixed(2)
            };
            team.totalScore = (((totals.complexity + totals.storytelling + totals.actionPlan + totals.overall) / (count * 4)) * 100).toFixed(1);
        });
        const analytics = {
            totalAssessments: source.length,
            totalTeams: Object.keys(teamStats).length,
            teamStats: Object.values(teamStats).sort((a, b) => b.totalScore - a.totalScore),
            judgeList: [...new Set(source.map(a => a.judgeName))]
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
