# GitHub App Authentication Setup

This project now uses **GitHub App authentication** instead of Personal Access Tokens for better security and scalability.

## Benefits of GitHub App

- ✅ **More secure**: Tokens are scoped to specific repositories and permissions
- ✅ **Better rate limits**: Higher rate limits (5,000 requests/hour per installation)
- ✅ **Automatic token management**: Tokens are automatically refreshed
- ✅ **Fine-grained permissions**: Control exactly what the app can do

## Setup Instructions

### 1. Get GitHub App Credentials

You need to get your GitHub App ID. The client secret is already configured.

**Option A: If you already have a GitHub App**

1. Go to https://github.com/settings/apps
2. Click on your app
3. Find the **App ID** (it's a number like `123456`)
4. Copy it

**Option B: Create a new GitHub App**

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **GitHub App name**: `desktop-portfolio-api` (or any name)
   - **Homepage URL**: Your website URL
   - **Webhook**: Leave unchecked (unless you need webhooks)
   - **Repository permissions**:
     - Contents: **Read and write**
     - Metadata: **Read-only** (automatically enabled)
3. Click **Create GitHub App**
4. Copy the **App ID** (shown on the app page)
5. Generate a **Private key**:
   - Scroll down to "Private keys"
   - Click **Generate a private key**
   - Download the `.pem` file
   - Open it and copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

### 2. Update Environment Variables

#### Local Development (.env.local)

Update your `.env.local` file:

```env
# GitHub App Configuration
GITHUB_APP_ID=123456  # Replace with your actual App ID
GITHUB_CLIENT_SECRET=76c59a22962580607bff371e08430e096a737658

# Optional: Installation ID (will be auto-detected if not provided)
# GITHUB_INSTALLATION_ID=12345678

# Fallback: GitHub Personal Access Token (if GitHub App is not configured)
# GITHUB_TOKEN=your_github_token_here

# GitHub Repository Configuration
GITHUB_REPO_OWNER=hbslovely
GITHUB_REPO_NAME=desktop-portfolio
GITHUB_BRANCH=master
```

**Important**: If your private key has newlines, you can either:
- Keep it as a multi-line string in `.env.local`
- Or use `\n` to represent newlines: `GITHUB_CLIENT_SECRET="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"`

#### Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

   - **GITHUB_APP_ID**
     - Value: Your GitHub App ID (e.g., `123456`)
     - Environment: All (Production, Preview, Development)
   
   - **GITHUB_CLIENT_SECRET**
     - Value: Your GitHub App private key (the entire PEM content)
     - Environment: All
     - **Important**: For multi-line private keys, paste the entire key including newlines
   
   - **GITHUB_INSTALLATION_ID** (Optional)
     - Value: Your installation ID
     - Environment: All
     - **Note**: If not provided, the app will auto-detect it

5. Click **Save** for each variable
6. **Redeploy** your application (Vercel will auto-redeploy after adding env vars)

### 3. Install GitHub App on Your Repository

1. Go to your GitHub App settings: https://github.com/settings/apps/YOUR_APP_NAME
2. Click **Install App** (or **Edit** if already installed)
3. Select the repository: `hbslovely/desktop-portfolio`
4. Click **Install**
5. Note the **Installation ID** (optional, but can be added to env vars for faster lookup)

## How It Works

1. **JWT Token Generation**: The app generates a JWT token using the App ID and private key
2. **Installation Token**: Uses the JWT to get an installation access token from GitHub
3. **Token Caching**: Installation tokens are cached for 55 minutes (they expire after 1 hour)
4. **Automatic Refresh**: Tokens are automatically refreshed when they expire

## Fallback to Personal Access Token

If GitHub App authentication fails (e.g., missing credentials), the system will automatically fall back to using `GITHUB_TOKEN` (Personal Access Token) if it's configured. This ensures backward compatibility.

## Testing

### Local Testing

```bash
# Make sure .env.local has GITHUB_APP_ID and GITHUB_CLIENT_SECRET
npm run dev:api

# Test the API
curl http://localhost:3001/api/stocks/list
```

### Vercel Testing

1. Check deployment logs in Vercel Dashboard
2. Look for messages like:
   - `[list.js] Using GitHub App authentication` ✅
   - `[list.js] GitHub App auth failed, falling back to GITHUB_TOKEN` ⚠️

## Troubleshooting

### Error: "GITHUB_APP_ID environment variable is not set"

- Make sure you've added `GITHUB_APP_ID` to `.env.local` (local) or Vercel environment variables (production)

### Error: "Failed to generate JWT token"

- Check that `GITHUB_CLIENT_SECRET` contains the full private key (including BEGIN/END lines)
- Make sure newlines are properly formatted

### Error: "No installation found for owner"

- Make sure the GitHub App is installed on the repository
- Check that `GITHUB_REPO_OWNER` matches the repository owner
- You can manually set `GITHUB_INSTALLATION_ID` to skip auto-detection

### Error: "Failed to get installation token"

- Verify the GitHub App has the correct permissions (Contents: Read and write)
- Check that the installation is active
- Try reinstalling the app on the repository

### Fallback to GITHUB_TOKEN

If you see warnings about falling back to `GITHUB_TOKEN`, it means:
- GitHub App authentication failed
- The system is using Personal Access Token instead
- Check the error message in logs to fix the GitHub App setup

## Migration from Personal Access Token

If you're migrating from Personal Access Token:

1. ✅ Keep `GITHUB_TOKEN` in env vars as a fallback
2. ✅ Add `GITHUB_APP_ID` and `GITHUB_CLIENT_SECRET`
3. ✅ Install the GitHub App on your repository
4. ✅ Test that it works
5. ✅ (Optional) Remove `GITHUB_TOKEN` once confirmed working

## Security Notes

- 🔒 **Never commit** `.env.local` or private keys to Git
- 🔒 Private keys are stored securely in Vercel environment variables
- 🔒 Installation tokens are cached in memory only (not persisted)
- 🔒 Tokens automatically expire and refresh

