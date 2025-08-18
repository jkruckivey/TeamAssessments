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

// Generate unique 6-digit PIN for teams
function generateTeamPIN() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Ensure PIN is unique within the group
function generateUniqueTeamPIN(group) {
    let pin;
    let attempts = 0;
    do {
        pin = generateTeamPIN();
        attempts++;
        // Prevent infinite loop
        if (attempts > 100) {
            pin = Date.now().toString().slice(-6);
            break;
        }
    } while (teams.some(t => normalizeGroup(t.group) === group && t.pin === pin));
    return pin;
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
let groups = ['default']; // Explicitly track groups
let groupEmails = {}; // Track email notifications for each group

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

        try {
            const groupData = await fs.readFile(path.join(DATA_DIR, 'groups.json'), 'utf8');
            groups = JSON.parse(groupData);
        } catch (error) {
            console.log('No existing group data found, using defaults');
            groups = ['default'];
        }

        try {
            const groupEmailData = await fs.readFile(path.join(DATA_DIR, 'group-emails.json'), 'utf8');
            groupEmails = JSON.parse(groupEmailData);
        } catch (error) {
            console.log('No existing group email data found, using defaults');
            groupEmails = {};
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
        await fs.writeFile(path.join(DATA_DIR, 'groups.json'), JSON.stringify(groups, null, 2));
        await fs.writeFile(path.join(DATA_DIR, 'group-emails.json'), JSON.stringify(groupEmails, null, 2));
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
        
        // Find the team to get the group information
        const team = teams.find(t => t.teamName === assessment.teamName);
        const groupName = team ? team.group : 'default';
        
        // Get the email for this group, no fallback - skip email if not configured
        const recipientEmail = groupEmails[groupName];
        
        // Skip email if no recipient configured for this group
        if (!recipientEmail) {
            console.log(`No email configured for group ${groupName}, skipping notification`);
            return true;
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: recipientEmail,
            subject: `New Assessment: ${assessment.teamName} (${groupName}) - Judge: ${assessment.judgeName}`,
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
                            <p><strong>Group/Classroom:</strong> ${groupName}</p>
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

// Send completion notification email
async function sendCompletionNotification(completionData) {
    try {
        const { judgeName, groupName, assessments, teams, completedAt } = completionData;
        
        // Get the email for this group, no fallback - skip email if not configured
        const recipientEmail = groupEmails[groupName];
        
        // Skip email if no recipient configured for this group
        if (!recipientEmail) {
            console.log(`No email configured for group ${groupName}, skipping completion notification`);
            return true;
        }
        
        // Calculate summary statistics
        const totalAssessments = assessments.length;
        const teamScores = assessments.map(a => {
            const total = a.ratings.complexity + a.ratings.storytelling + a.ratings.actionPlan + a.ratings.overall;
            return {
                teamName: a.teamName,
                score: ((total / 20) * 100).toFixed(1),
                ratings: a.ratings
            };
        });
        const averageScore = (teamScores.reduce((sum, team) => sum + parseFloat(team.score), 0) / totalAssessments).toFixed(1);
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: recipientEmail,
            subject: `✅ Judge Complete: ${judgeName} finished assessing ${groupName} (${totalAssessments} teams)`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .completion-details { background: #d4edda; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745; border-radius: 4px; }
                        .team-scores { margin: 20px 0; }
                        .team-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; gap: 10px; padding: 8px; border-bottom: 1px solid #eee; align-items: center; }
                        .team-header { font-weight: bold; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
                        .score-highlight { font-size: 1.1em; font-weight: bold; color: #28a745; }
                        .summary-stats { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🎉 Judge Assessment Complete!</h1>
                        <p>Ivey EdTech Lab • Team Assessment Platform</p>
                    </div>
                    
                    <div class="content">
                        <div class="completion-details">
                            <h2>Completion Summary</h2>
                            <p><strong>Judge:</strong> ${judgeName}</p>
                            <p><strong>Classroom:</strong> ${groupName}</p>
                            <p><strong>Teams Assessed:</strong> ${totalAssessments}</p>
                            <p><strong>Average Score:</strong> <span class="score-highlight">${averageScore}%</span></p>
                            <p><strong>Completed At:</strong> ${new Date(completedAt).toLocaleString()}</p>
                        </div>
                        
                        <div class="summary-stats">
                            <h3>📊 Quick Statistics</h3>
                            <p><strong>Highest Score:</strong> ${Math.max(...teamScores.map(t => parseFloat(t.score)))}%</p>
                            <p><strong>Lowest Score:</strong> ${Math.min(...teamScores.map(t => parseFloat(t.score)))}%</p>
                            <p><strong>Teams Above 80%:</strong> ${teamScores.filter(t => parseFloat(t.score) >= 80).length}</p>
                        </div>

                        <h3>📋 All Team Scores</h3>
                        <div class="team-scores">
                            <div class="team-row team-header">
                                <div>Team Name</div>
                                <div>Overall</div>
                                <div>Complexity</div>
                                <div>Story</div>
                                <div>Action</div>
                                <div>Score</div>
                            </div>
                            ${teamScores.map(team => `
                                <div class="team-row">
                                    <div><strong>${team.teamName}</strong></div>
                                    <div>${team.ratings.overall}/5</div>
                                    <div>${team.ratings.complexity}/5</div>
                                    <div>${team.ratings.storytelling}/5</div>
                                    <div>${team.ratings.actionPlan}/5</div>
                                    <div class="score-highlight">${team.score}%</div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <p style="margin-top: 25px;">
                            <a href="http://localhost:${PORT}/admin" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                                📊 View Full Results Dashboard
                            </a>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p><strong>All assessments for ${groupName} by ${judgeName} are now complete.</strong></p>
                        <p>The judge can still edit individual assessments if needed, but results have been finalized.</p>
                    </div>
                </body>
                </html>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Completion notification sent for judge: ${judgeName} in group: ${groupName}`);
        return true;
        
    } catch (error) {
        console.error('Error sending completion notification:', error.message);
        return false;
    }
}

// Send PIN notification email to team members
async function sendPINNotification(team, group) {
    try {
        if (!team.members || team.members.length === 0) {
            console.log(`No email addresses found for team: ${team.name}`);
            return false;
        }
        
        const memberEmails = team.members
            .filter(member => member.email && member.email.trim())
            .map(member => member.email.trim());
            
        if (memberEmails.length === 0) {
            console.log(`No valid email addresses found for team: ${team.name}`);
            return false;
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: memberEmails.join(', '),
            subject: `Your Team Assessment PIN - ${team.name}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .header { background: #c5b783; color: #2c2c2c; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .pin-highlight { 
                            background: #fafaf8; 
                            border: 2px solid #c5b783; 
                            padding: 20px; 
                            text-align: center; 
                            margin: 20px 0;
                            border-radius: 8px;
                        }
                        .pin-number { 
                            font-size: 2.5rem; 
                            font-weight: bold; 
                            color: #c5b783; 
                            letter-spacing: 0.2em; 
                            margin: 10px 0;
                        }
                        .instructions { 
                            background: #f9f9f9; 
                            padding: 15px; 
                            border-left: 4px solid #c5b783; 
                            margin: 20px 0;
                        }
                        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }
                        .button {
                            display: inline-block;
                            background: #c5b783;
                            color: #2c2c2c;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 4px;
                            font-weight: 600;
                            margin: 10px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🔐 Your Team Assessment PIN</h1>
                        <p>Ivey EdTech Lab • Team Assessment Platform</p>
                    </div>
                    
                    <div class="content">
                        <h2>Hello ${team.name} Members!</h2>
                        <p>Your team has been registered for the assessment process. Use the PIN below to view your team's assessment results once judges have submitted their evaluations.</p>
                        
                        <div class="pin-highlight">
                            <h3>Your Team PIN</h3>
                            <div class="pin-number">${team.pin}</div>
                            <p style="color: #666; font-size: 0.9em;">Keep this PIN safe - you'll need it to access your results</p>
                        </div>
                        
                        <div class="instructions">
                            <h4>How to View Your Results:</h4>
                            <ol>
                                <li>Visit the team results page using the link below</li>
                                <li>Enter your 6-digit PIN: <strong>${team.pin}</strong></li>
                                <li>View your team's assessment scores and judge feedback</li>
                            </ol>
                        </div>
                        
                        <p style="text-align: center;">
                            <a href="http://localhost:${PORT}/team-results?group=${encodeURIComponent(group)}" class="button">
                                📊 View Team Results
                            </a>
                        </p>
                        
                        <p><strong>Team Members:</strong></p>
                        <ul>
                            ${team.members.map(member => `<li>${member.name}${member.email ? ` (${member.email})` : ''}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent to all team members. Results will be available once judge assessments are submitted.</p>
                        <p>Assessment Group: ${group} • Team ID: ${team.id}</p>
                    </div>
                </body>
                </html>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`📧 PIN notification sent to team: ${team.name} (${memberEmails.length} recipients)`);
        return true;
        
    } catch (error) {
        console.error(`Error sending PIN notification to team ${team.name}:`, error.message);
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
        
        // Extract team member information
        const members = [];
        for (let i = 1; i <= 6; i++) { // Support up to 6 team members
            const memberName = row[`member${i}_name`] || row[`Member${i} Name`] || row[`member_${i}_name`];
            const memberEmail = row[`member${i}_email`] || row[`Member${i} Email`] || row[`member_${i}_email`];
            
            if (memberName && memberName.trim()) {
                members.push({
                    name: memberName.trim(),
                    email: memberEmail ? memberEmail.trim() : ''
                });
            }
        }
        
        validTeams.push({
            id: uuidv4(),
            name: cleanName,
            members: members,
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

// Serve team results page
app.get('/team-results', (req, res) => {
    res.sendFile(path.join(__dirname, 'team-results.html'));
});

// Serve group-specific assessment form
app.get('/assess/:groupName', (req, res) => {
    res.sendFile(path.join(__dirname, 'group-assessment.html'));
});

// Serve batch assessment form (fallback)
app.get('/batch-assessment', (req, res) => {
    res.sendFile(path.join(__dirname, 'batch-assessment.html'));
});

// Get all available groups
app.get('/api/groups', (req, res) => {
    try {
        const allGroups = new Set(groups);
        
        // Also include any groups that exist in teams or assessments but not in groups array
        teams.forEach(team => {
            allGroups.add(normalizeGroup(team.group));
        });
        
        assessments.forEach(assessment => {
            allGroups.add(normalizeGroup(assessment.group));
        });
        
        const groupList = Array.from(allGroups).sort();
        res.json(groupList);
    } catch (error) {
        console.error('Error getting groups:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});

// Create a new group
app.post('/api/groups', (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        const groupName = name.trim();
        
        // Validate group name (alphanumeric, hyphens, underscores only)
        if (!/^[a-zA-Z0-9_-]+$/.test(groupName)) {
            return res.status(400).json({ 
                error: 'Group name can only contain letters, numbers, hyphens, and underscores' 
            });
        }
        
        // Check if group already exists
        if (groups.includes(groupName)) {
            return res.status(400).json({ error: 'Group already exists' });
        }
        
        // Add group to the list
        groups.push(groupName);
        
        // Save the updated groups list
        saveData();
        
        console.log(`Created new group: ${groupName}`);
        res.json({ 
            success: true, 
            groupName: groupName,
            message: `Group '${groupName}' created successfully` 
        });
        
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Delete a group
app.delete('/api/groups/:groupName', (req, res) => {
    try {
        const groupName = req.params.groupName.trim();
        
        if (!groupName) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        // Check if group exists
        if (!groups.includes(groupName)) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if group has teams or assessments
        const groupHasTeams = teams.some(team => normalizeGroup(team.group) === normalizeGroup(groupName));
        const groupHasAssessments = assessments.some(assessment => normalizeGroup(assessment.group) === normalizeGroup(groupName));
        
        if (groupHasTeams) {
            return res.status(400).json({ 
                error: 'Cannot delete group with existing teams. Remove teams first.' 
            });
        }
        
        if (groupHasAssessments) {
            return res.status(400).json({ 
                error: 'Cannot delete group with existing assessments. Remove assessments first.' 
            });
        }
        
        // Remove group from the list
        groups = groups.filter(group => group !== groupName);
        
        // Save the updated groups list
        saveData();
        
        console.log(`Deleted group: ${groupName}`);
        res.json({ 
            success: true, 
            message: `Group '${groupName}' deleted successfully` 
        });
        
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

// Update group email notification
app.put('/api/groups/:groupName/email', (req, res) => {
    try {
        const groupName = req.params.groupName.trim();
        const { email } = req.body;
        
        if (!groupName) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        // Check if group exists
        if (!groups.includes(groupName)) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Validate email format if provided
        if (email && email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            groupEmails[groupName] = email.trim();
        } else {
            // Remove email if empty
            delete groupEmails[groupName];
        }
        
        // Save the updated email data
        saveData();
        
        console.log(`Updated email for group ${groupName}: ${groupEmails[groupName] || 'removed'}`);
        res.json({ 
            success: true, 
            message: `Email updated for group '${groupName}'`,
            email: groupEmails[groupName] || null
        });
        
    } catch (error) {
        console.error('Error updating group email:', error);
        res.status(500).json({ error: 'Failed to update group email' });
    }
});

// Get group email information
app.get('/api/groups/:groupName/email', (req, res) => {
    try {
        const groupName = req.params.groupName.trim();
        
        if (!groups.includes(groupName)) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        res.json({ 
            groupName: groupName,
            email: groupEmails[groupName] || null
        });
        
    } catch (error) {
        console.error('Error getting group email:', error);
        res.status(500).json({ error: 'Failed to get group email' });
    }
});

// Get all teams
app.get('/api/teams', (req, res) => {
  if (req.query.group) {
    // Filter by group if specified
    const group = normalizeGroup(req.query.group);
    const result = teams.filter(t => normalizeGroup(t.group) === group);
    res.json(result);
  } else {
    // Return all teams with teams wrapper for admin compatibility
    res.json({ teams: teams });
  }
});

// Submit assessment
app.post('/api/assessments', async (req, res) => {
  try {
    const { judgeName, teamName, ratings, comments, group: bodyGroup } = req.body;
    
    if (!judgeName || !teamName || !ratings) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the team to get the correct group
    // If multiple teams have same name, prefer non-default groups
    const matchingTeams = teams.filter(t => (t.name || t.teamName) === teamName.trim());
    const team = matchingTeams.find(t => normalizeGroup(t.group) !== 'default') || matchingTeams[0];
    const group = team ? normalizeGroup(team.group) : normalizeGroup(bodyGroup || req.query.group);
    
    console.log(`Assessment submission: teamName="${teamName}", found ${matchingTeams.length} matching teams, selected:`, team ? `group=${team.group}` : 'not found', `final group=${group}`);
    
    // Check if assessment already exists for this judge-team combination
    const existingIndex = assessments.findIndex(a => 
      a.judgeName.toLowerCase() === judgeName.trim().toLowerCase() && 
      a.teamName === teamName.trim()
    );

    const assessmentData = {
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

    let assessment;
    if (existingIndex >= 0) {
      // Update existing assessment
      assessment = {
        ...assessments[existingIndex],
        ...assessmentData
      };
      assessments[existingIndex] = assessment;
      console.log(`Updated existing assessment for ${judgeName} - ${teamName}`);
    } else {
      // Create new assessment
      assessment = {
        id: uuidv4(),
        ...assessmentData
      };
      assessments.push(assessment);
      console.log(`Created new assessment for ${judgeName} - ${teamName}`);
    }

    // Note: Email notifications are now only sent when judge marks complete
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
    const team = { 
        id: uuidv4(), 
        name: name.trim(), 
        group, 
        pin: generateUniqueTeamPIN(group),
        members: [],
        createdAt: new Date().toISOString() 
    };
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
                team.pin = generateUniqueTeamPIN(group);
                newTeams.push(team);
                existingTeamNames.add(team.name.toLowerCase());
            }
        });
        teams.push(...newTeams);
        await saveData();
        
        // Send PIN emails to team members (don't wait for completion)
        let emailCount = 0;
        newTeams.forEach(team => {
            if (team.members && team.members.length > 0) {
                sendPINNotification(team, group).then(success => {
                    if (success) emailCount++;
                }).catch(error => {
                    console.error(`Failed to send PIN email for team ${team.name}:`, error.message);
                });
            }
        });
        
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

// Get assessments for a specific group
app.get('/api/assessments/group/:groupName', (req, res) => {
    try {
        const groupName = normalizeGroup(req.params.groupName);
        
        // Get teams in this group
        const groupTeams = teams.filter(team => normalizeGroup(team.group) === groupName);
        const groupTeamNames = groupTeams.map(team => team.name || team.teamName);
        
        console.log(`Group ${groupName}: found ${groupTeams.length} teams:`, groupTeamNames);
        
        // Get assessments for teams in this group
        const groupAssessments = assessments.filter(assessment => 
            groupTeamNames.includes(assessment.teamName)
        );
        
        console.log(`Found ${groupAssessments.length} assessments for group ${groupName}`);
        
        res.json({ assessments: groupAssessments });
    } catch (error) {
        console.error('Error getting group assessments:', error);
        res.status(500).json({ error: 'Failed to get group assessments' });
    }
});

// Mark assessments complete for a judge
app.post('/api/assessments/complete', async (req, res) => {
    try {
        const { judgeName, groupName } = req.body;
        
        if (!judgeName || !groupName) {
            return res.status(400).json({ error: 'Missing judgeName or groupName' });
        }

        const normalizedGroup = normalizeGroup(groupName);
        
        // Get teams in this group
        const groupTeams = teams.filter(team => normalizeGroup(team.group) === normalizedGroup);
        const groupTeamNames = groupTeams.map(team => team.name || team.teamName);
        
        // Get this judge's assessments for this group
        const judgeAssessments = assessments.filter(assessment => 
            assessment.judgeName.toLowerCase() === judgeName.toLowerCase() &&
            groupTeamNames.includes(assessment.teamName || assessment.name)
        );

        // Get unique teams assessed by this judge (remove duplicates)
        const uniqueTeamsAssessed = [...new Set(judgeAssessments.map(a => a.teamName || a.name))];

        // Verify judge has assessed all teams
        if (uniqueTeamsAssessed.length !== groupTeams.length) {
            return res.status(400).json({ 
                error: `Judge has only assessed ${uniqueTeamsAssessed.length} of ${groupTeams.length} teams` 
            });
        }

        console.log(`Judge ${judgeName} has assessed all ${uniqueTeamsAssessed.length} teams in ${normalizedGroup}`);

        // Send completion email notification
        const completionData = {
            judgeName,
            groupName: normalizedGroup,
            assessments: judgeAssessments,
            teams: groupTeams,
            completedAt: new Date().toISOString()
        };

        sendCompletionNotification(completionData).catch(error => {
            console.error('Failed to send completion notification:', error.message);
        });

        res.json({ 
            success: true, 
            message: 'Assessments marked complete and admin notified',
            assessmentsCount: judgeAssessments.length
        });

    } catch (error) {
        console.error('Error marking assessments complete:', error);
        res.status(500).json({ error: 'Failed to mark assessments complete' });
    }
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
            team.totalScore = (((totals.complexity + totals.storytelling + totals.actionPlan + totals.overall) / (count * 20)) * 100).toFixed(1);
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

// Download CSV template for team upload
app.get('/api/template/teams-csv', (req, res) => {
    try {
        const csvHeader = 'team_name,member1_name,member1_email,member2_name,member2_email,member3_name,member3_email,member4_name,member4_email\n';
        
        // Add sample data rows to show format
        const sampleRows = [
            'Team Alpha,John Smith,john.smith@student.ivey.ca,Sarah Johnson,sarah.johnson@student.ivey.ca,Mike Chen,mike.chen@student.ivey.ca,Lisa Brown,lisa.brown@student.ivey.ca',
            'Team Beta,Alex Wilson,alex.wilson@student.ivey.ca,Emma Davis,emma.davis@student.ivey.ca,Ryan Taylor,ryan.taylor@student.ivey.ca,',
            'Team Gamma,Jordan Lee,jordan.lee@student.ivey.ca,Casey Miller,casey.miller@student.ivey.ca,,,'
        ];
        
        const csvContent = csvHeader + sampleRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="teams-upload-template.csv"');
        res.send(csvContent);
        
    } catch (error) {
        console.error('Error generating CSV template:', error);
        res.status(500).json({ error: 'Failed to generate CSV template' });
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

// Email results to program team
app.post('/api/email/results', async (req, res) => {
    try {
        const group = req.query.group ? normalizeGroup(req.query.group) : 'default';
        const source = assessments.filter(a => normalizeGroup(a.group) === group);
        
        if (source.length === 0) {
            return res.status(400).json({ error: 'No assessment data available to email' });
        }
        
        // Generate CSV content
        const csvHeader = 'Judge Name,Team Name,Complexity Understanding,Clear Storytelling,Systems Action Plan,Overall Assessment,Total Score %,Complexity Comments,Storytelling Comments,Action Plan Comments,Overall Comments,Submitted At\n';
        const csvRows = source.map(assessment => {
            const totalScore = (((assessment.ratings.complexity + assessment.ratings.storytelling + assessment.ratings.actionPlan + assessment.ratings.overall) / 20) * 100).toFixed(1);
            return [
                assessment.judgeName,
                assessment.teamName,
                assessment.ratings.complexity,
                assessment.ratings.storytelling,
                assessment.ratings.actionPlan,
                assessment.ratings.overall,
                totalScore + '%',
                `"${assessment.comments.complexity.replace(/"/g, '""')}"`,
                `"${assessment.comments.storytelling.replace(/"/g, '""')}"`,
                `"${assessment.comments.actionPlan.replace(/"/g, '""')}"`,
                `"${assessment.comments.overall.replace(/"/g, '""')}"`,
                assessment.submittedAt
            ].join(',');
        });
        const csvContent = csvHeader + csvRows.join('\n');
        
        // Email recipients - only send if configured via environment variable
        const recipients = process.env.PROGRAM_TEAM_EMAILS ? 
            process.env.PROGRAM_TEAM_EMAILS.split(',').map(email => email.trim()) : 
            [];
            
        // Skip email if no recipients configured
        if (recipients.length === 0) {
            console.log('No PROGRAM_TEAM_EMAILS configured, skipping PIN notification');
            return true;
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: recipients.join(', '),
            subject: `Team Assessment Results Export - ${group} - ${new Date().toLocaleDateString()}`,
            html: `
                <h2>📊 Team Assessment Results</h2>
                <p><strong>Group:</strong> ${group}</p>
                <p><strong>Total Assessments:</strong> ${source.length}</p>
                <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
                <p>Please find the complete assessment results attached as a CSV file.</p>
                <br>
                <p><em>Generated automatically by the Ivey Team Assessment Platform</em></p>
            `,
            attachments: [
                {
                    filename: `team-assessments-${group}-${new Date().toISOString().split('T')[0]}.csv`,
                    content: csvContent,
                    contentType: 'text/csv'
                }
            ]
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`📧 Assessment results emailed to: ${recipients.join(', ')}`);
        
        res.json({ 
            success: true, 
            message: 'Assessment results emailed successfully',
            recipients: recipients,
            assessmentCount: source.length
        });
        
    } catch (error) {
        console.error('Error emailing results:', error);
        res.status(500).json({ error: 'Failed to email results: ' + error.message });
    }
});

// Team results by PIN
app.get('/api/team-results', (req, res) => {
    try {
        const { pin, group: queryGroup } = req.query;
        const group = normalizeGroup(queryGroup);
        
        if (!pin || pin.length !== 6) {
            return res.status(400).json({ error: 'Please provide a valid 6-digit PIN' });
        }
        
        // Find team by PIN
        const team = teams.find(t => 
            normalizeGroup(t.group) === group && t.pin === pin
        );
        
        if (!team) {
            return res.status(404).json({ error: 'Invalid PIN or no team found' });
        }
        
        // Get all assessments for this team
        const teamAssessments = assessments.filter(a => 
            normalizeGroup(a.group) === group && 
            a.teamName.toLowerCase() === team.name.toLowerCase()
        );
        
        if (teamAssessments.length === 0) {
            return res.status(404).json({ 
                error: 'No assessments found for this team yet. Please check back later.' 
            });
        }
        
        // Calculate averages and total score
        const totals = { complexity: 0, storytelling: 0, actionPlan: 0, overall: 0 };
        teamAssessments.forEach(assessment => {
            totals.complexity += assessment.ratings.complexity;
            totals.storytelling += assessment.ratings.storytelling;
            totals.actionPlan += assessment.ratings.actionPlan;
            totals.overall += assessment.ratings.overall;
        });
        
        const count = teamAssessments.length;
        const averages = {
            complexity: (totals.complexity / count).toFixed(2),
            storytelling: (totals.storytelling / count).toFixed(2),
            actionPlan: (totals.actionPlan / count).toFixed(2),
            overall: (totals.overall / count).toFixed(2)
        };
        
        const totalScore = (((totals.complexity + totals.storytelling + totals.actionPlan + totals.overall) / (count * 20)) * 100).toFixed(1);
        
        // Return team results
        res.json({
            teamName: team.name,
            judgeCount: count,
            averages: averages,
            totalScore: totalScore,
            assessments: teamAssessments.map(a => ({
                ratings: a.ratings,
                comments: a.comments,
                submittedAt: a.submittedAt
            })),
            members: team.members || []
        });
        
    } catch (error) {
        console.error('Error retrieving team results:', error);
        res.status(500).json({ error: 'Failed to retrieve team results' });
    }
});

// Test email configuration
app.post('/api/test-email', async (req, res) => {
    try {
        const { email } = req.body;
        const testEmail = email || process.env.EMAIL_USER || 'test@example.com';
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'team-assessments@ivey.ca',
            to: testEmail,
            subject: '✅ Email Configuration Test - Ivey Team Assessment Platform',
            html: `
                <h2>Email Test Successful!</h2>
                <p>If you're reading this, your email configuration is working correctly.</p>
                <p><strong>Configuration Details:</strong></p>
                <ul>
                    <li>From: ${process.env.EMAIL_USER || 'Not configured'}</li>
                    <li>To: ${testEmail}</li>
                    <li>Time: ${new Date().toLocaleString()}</li>
                </ul>
                <p>You can now proceed with using the assessment platform.</p>
                <hr>
                <p><em>Ivey EdTech Lab • Team Assessment Platform</em></p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Test email sent successfully to: ${testEmail}`);
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully',
            recipient: testEmail
        });
        
    } catch (error) {
        console.error('❌ Test email failed:', error.message);
        res.status(500).json({ 
            error: 'Failed to send test email',
            details: error.message,
            suggestion: 'Check your EMAIL_USER and EMAIL_PASS in .env file'
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        assessments: assessments.length,
        teams: teams.length,
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
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
