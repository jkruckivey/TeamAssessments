# Email Configuration Guide

## Quick Setup (5 minutes)

### Step 1: Create Your .env File
1. Copy the example file: `cp .env.example .env`
2. Open `.env` file in a text editor

### Step 2: Choose Your Email Provider

#### Option A: Gmail (Recommended)
1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification" → "App passwords"
   - Select "Mail" and generate password
3. **Update .env file**:
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
PROGRAM_TEAM_EMAILS=jkrcuk@ivey.ca,program-team@ivey.ca
```

#### Option B: Outlook/Hotmail
```env
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
EMAIL_HOST=smtp.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
PROGRAM_TEAM_EMAILS=jkrcuk@ivey.ca,program-team@ivey.ca
```

#### Option C: Ivey Email (if available)
```env
EMAIL_USER=your-email@ivey.ca
EMAIL_PASS=your-password
EMAIL_HOST=smtp.ivey.ca
EMAIL_PORT=587
EMAIL_SECURE=true
PROGRAM_TEAM_EMAILS=jkrcuk@ivey.ca,program-team@ivey.ca
```

### Step 3: Test Configuration
1. Start the server: `npm start`
2. Go to Admin Dashboard: http://localhost:3000/admin
3. Scroll to "Email Configuration" section
4. Enter your email address and click "Send Test Email"
5. Check your inbox for the test email

### Step 4: Configure Recipients
Update `PROGRAM_TEAM_EMAILS` in `.env` with actual email addresses (comma-separated):
```env
PROGRAM_TEAM_EMAILS=jkrcuk@ivey.ca,coordinator@ivey.ca,assistant@ivey.ca
```

## Email Features

Once configured, the system will automatically send:

1. **Judge Notifications**: Immediate email when assessments are submitted
2. **Team PINs**: Automatic PIN delivery when teams are uploaded with member emails
3. **Results Export**: On-demand CSV delivery to program team
4. **System Notifications**: Status updates and confirmations

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - For Gmail: Use App Password, not regular password
   - For Outlook: Enable "Less secure app access"

2. **"Connection timeout"**
   - Check EMAIL_HOST and EMAIL_PORT settings
   - Verify firewall/network isn't blocking SMTP

3. **"Invalid credentials"**
   - Double-check EMAIL_USER and EMAIL_PASS
   - Ensure no extra spaces in .env file

4. **Test email works, but system emails don't**
   - Check PROGRAM_TEAM_EMAILS format (comma-separated, no spaces)
   - Verify all email addresses are valid

### Getting Help:
- Use the test email feature in admin dashboard
- Check server console for detailed error messages
- Verify .env file is in project root directory