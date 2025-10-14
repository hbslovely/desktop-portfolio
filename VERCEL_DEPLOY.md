# Vercel Deployment Guide

## Environment Variable Setup

This application uses The News API to fetch latest headlines. You need to configure the API token in Vercel.

### Step 1: Get Your API Token

The API token is: `XXXXXXXX`

### Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `NEWS_API_TOKEN`
   - **Value**: `XXXXXXXX`
   - **Environment**: Select all (Production, Preview, Development)

### Step 3: Deploy

After setting the environment variable, deploy your application:

```bash
vercel --prod
```

Or push to your connected Git repository, and Vercel will automatically deploy.

## API Configuration

The News API configuration is managed through environment files:

- **Development**: `src/environments/environment.ts` (hardcoded token for local development)
- **Production**: `src/environments/environment.prod.ts` (uses environment variable)

## News API Endpoint

The application uses:
- **URL**: `https://api.thenewsapi.com/v1/news/headlines`
- **Parameters**:
  - `locale`: us
  - `language`: en
  - `api_token`: from environment variable
  - `categories`: (optional) for filtering news

## Features

The News app includes:
- ✅ Real-time news headlines
- ✅ Category filtering (General, Tech, Business, Science, Sports, Entertainment)
- ✅ Responsive card layout
- ✅ Image loading with fallback
- ✅ Click to read full article (opens in new tab)
- ✅ Refresh button
- ✅ Loading and error states
- ✅ Beautiful gradient UI

## Troubleshooting

If news is not loading:

1. **Check API Token**: Verify the environment variable is set correctly in Vercel
2. **Check API Limits**: The free tier has usage limits
3. **Check Console**: Open browser console for error messages
4. **Rebuild**: After changing environment variables, trigger a new deployment

## Local Development

For local development, the API token is hardcoded in `environment.ts`. For production, it's read from the `NEWS_API_TOKEN` environment variable.

To test with production environment locally:

```bash
ng build --configuration=production
ng serve --configuration=production
```

## Security Note

⚠️ Never commit API tokens to your repository. Use environment variables for all sensitive data in production.

