# Team Assessment Platform

A professional team evaluation system designed for Ivey Business School judges to assess student team presentations and assign grades efficiently.

## Features

### 📋 **Judge Assessment Form**
- Clean, professional interface matching Ivey branding
- 4 assessment criteria with 1-5 rating scale:
  1. **System Complexity Understanding**
  2. **Clear Storytelling Ability** 
  3. **Systems-Oriented Action Plan**
  4. **Overall Assessment**
- Optional comments for detailed feedback
- Team name auto-complete
- Mobile-responsive design

### 📊 **Admin Analytics Dashboard**
- Real-time assessment statistics
- Team-by-team score breakdowns
- Individual judge evaluations view
- Sortable results by performance
- Export functionality (CSV format)

### 🔧 **Built-in Features**
- Data persistence (file-based for development)
- Assessment validation
- Automatic score calculation
- Professional Ivey branding
- Responsive design

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# or for development:
npm run dev
```

### 3. Access the Platform
- **Assessment Form**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin

## Usage Guide

### For Judges
1. Navigate to the main form
2. Enter your name and the team name exactly as provided
3. Rate each criterion from 1 (Fair) to 5 (Excellent)
4. Add comments for detailed feedback (optional)
5. Submit assessment

### For Administrators
1. Access the admin dashboard
2. View real-time assessment statistics
3. Review team-by-team results
4. Export data for grade assignment
5. Use detailed views for comprehensive feedback

## Assessment Criteria & Rubric

The assessment form includes a comprehensive rubric that judges and students both have access to. This ensures transparency and consistency in evaluation.

### Assessment Criteria

#### 1. System Complexity Understanding (1-5)
**"Demonstrates a good understanding of the complexity of the system"**
- Evaluates how well the team demonstrates understanding of complex systems
- Considers depth of analysis and recognition of system interconnections

#### 2. Clear Storytelling (1-5)
**"Demonstrates the ability to simplify the complexity with a clear story"**
- Assesses the team's ability to simplify complexity with clear narrative
- Focuses on communication clarity and narrative structure

#### 3. Systems-Oriented Action Plan (1-5)
**"Demonstrates the ability to build a systems-oriented action plan"**
- Reviews the quality of their systems thinking and actionable plans
- Evaluates strategic thinking and implementation feasibility

#### 4. Overall Assessment (1-5)
**Holistic evaluation of the team's performance across all criteria**
- Comprehensive assessment considering all aspects of performance
- Allows judges to weigh overall impression and presentation quality

### Rating Scale

- **5 - Excellent**: Exceptional performance that exceeds expectations
- **4 - Good**: Above average performance that meets most expectations  
- **3 - Satisfactory**: Adequate performance that meets basic expectations
- **2 - Needs Improvement**: Below average performance with noticeable gaps
- **1 - Fair**: Poor performance requiring significant improvement

### Rubric Transparency

The complete rubric is displayed prominently on the assessment form, with a note that **"Students have also been given this criteria for their preparation."** This ensures:

- **Consistency**: All judges use the same evaluation standards
- **Fairness**: Students know exactly how they'll be evaluated
- **Transparency**: Clear expectations for all participants
- **Quality**: Standardized assessment across all judges

## Data Structure

### Assessment Record
```json
{
  "id": "uuid",
  "judgeName": "Judge Name",
  "teamName": "Team Name",
  "ratings": {
    "complexity": 4,
    "storytelling": 5,
    "actionPlan": 3,
    "overall": 4
  },
  "comments": {
    "complexity": "Strong understanding...",
    "storytelling": "Clear narrative...",
    "actionPlan": "Good framework...",
    "overall": "Solid presentation..."
  },
  "submittedAt": "2025-01-14T10:30:00.000Z"
}
```

## API Endpoints

### Assessment Submission
- `POST /api/assessments` - Submit new assessment
- `GET /api/assessments` - Get all assessments
- `GET /api/assessments/team/:teamName` - Get team-specific assessments

### Analytics
- `GET /api/analytics` - Get comprehensive analytics
- `GET /api/export/csv` - Export assessments as CSV

### Team Management
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Add new team

### System
- `GET /api/health` - Health check endpoint

## Scoring System

### Individual Ratings: 1-5 Scale
- **5 - Excellent**: Exceptional performance
- **4 - Good**: Above average performance  
- **3 - Satisfactory**: Meets expectations
- **2 - Needs Improvement**: Below expectations
- **1 - Fair**: Significant improvement needed

### Total Score Calculation
Total Score = (Sum of all ratings ÷ Max possible score) × 100

Example: (4+5+3+4) ÷ 20 × 100 = 80%

## Deployment

### For Production (e.g., Render, Heroku)
1. Set `NODE_ENV=production`
2. Configure environment variables if needed
3. The system uses in-memory storage in production for simplicity
4. For persistent storage, integrate with a database

### Environment Variables
```bash
PORT=3000                    # Server port (optional)
NODE_ENV=production         # Environment mode

# Email Notifications
EMAIL_USER=your-email@gmail.com    # Gmail address for sending notifications
EMAIL_PASS=your-app-password       # Gmail App Password (not regular password)
```

### Setting Up Email Notifications

1. **Gmail Configuration** (Recommended):
   - Use a Gmail account for sending notifications
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password: [Gmail App Passwords Guide](https://support.google.com/accounts/answer/185833)
   - Set `EMAIL_USER` to your Gmail address
   - Set `EMAIL_PASS` to the generated App Password

2. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure your email settings** in `.env`:
   ```bash
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

4. **Email Features**:
   - Automatic notification sent to `jkrcuk@ivey.ca` for every assessment
   - Professional HTML email format with Ivey branding
   - Includes all assessment details and ratings
   - Direct link to admin dashboard
   - Assessment ID for reference

## File Structure
```
├── server.js              # Express server & API
├── index.html             # Judge assessment form
├── admin.html             # Analytics dashboard
├── styles.css             # Ivey-branded styling
├── script.js              # Form functionality
├── package.json           # Dependencies
├── README.md              # Documentation
└── data/                  # Data storage (development)
    ├── assessments.json   # Assessment records
    ├── teams.json         # Team list
    └── judges.json        # Judge information
```

## Customization

### Adding New Criteria
1. Update the form in `index.html`
2. Modify the data structure in `server.js`
3. Update analytics calculations
4. Adjust styling as needed

### Branding Changes
- Colors: Modify CSS variables for Ivey gold (`#c5b783`)
- Typography: Update font family in `styles.css`
- Logo: Replace logo section in headers

## Support

For technical support or feature requests:
- **Developer**: Ivey EdTech Lab
- **Platform**: Node.js/Express
- **License**: MIT

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (responsive design)

---

**Built for Ivey Business School EdTech Lab**  
Professional team assessment platform designed for academic evaluation excellence.
## Render Deployment (Persistent Data)

To host on Render with data persistence:

1. Push this repo to GitHub (if not already).
2. On Render: New ? Web Service ? select the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATA_DIR=/opt/render/project/src/data`
   - Optional: `EMAIL_USER`, `EMAIL_PASS` (for email notifications)
6. Add a Persistent Disk:
   - Size: e.g., 1 GB
   - Mount path: `/opt/render/project/src/data`

Access URLs:
- Form: `https://<your-service>.onrender.com/`
- Admin: `https://<your-service>.onrender.com/admin`

Notes:
- The server now reads/writes JSON under `DATA_DIR` in all environments.
- If you change the mount path, update `DATA_DIR` accordingly.
- Consider protecting `/admin` with basic auth or a token before public access.
