# 🕒 My Timesheet - Productive.io Integration

A **beautiful, modern web application** for submitting timesheets to Productive.io with bulk date range support and proxy functionality.

## 🎨 **Beautiful Modern UI**

- **Hero Section**: Eye-catching gradient header with animated elements
- **Card-based Layout**: Clean, organized panels with subtle shadows and hover effects
- **Responsive Design**: Perfect on desktop, tablet, and mobile devices
- **Modern Typography**: Inter font family for excellent readability
- **Color Coded Status**: Visual indicators for entry states and results
- **Smooth Animations**: Delightful micro-interactions and transitions

## ✨ Features

- **📅 Date Range Selection**: Choose custom date ranges or business days only
- **⚡ Bulk Operations**: Apply hours and notes to multiple entries at once
- **🔒 Secure Proxy**: Server-side proxy to handle CORS and authentication
- **📊 Real-time Progress**: Track submission progress with detailed feedback
- **💾 Configuration Storage**: Save your API credentials locally
- **🎨 Modern UI**: Beautiful, responsive interface using PrimeNG
- **☁️ Vercel Ready**: Configured for seamless deployment

## 🚀 Quick Start

### Development

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm start
```

3. **Access the application:**
```
http://localhost:3600/my-timesheet
```

### Production Deployment

Deploy to Vercel with one command:

```bash
vercel --prod
```

The application will be available at your Vercel domain + `/my-timesheet`

## 🔧 Configuration

### Required Fields

To use the timesheet submission, you'll need:

1. **Auth Token**: Your Productive.io authentication token
   - Find this in your browser's network tab when using Productive.io
   - Look for the `X-Auth-Token` header in API requests

2. **Organization ID**: Your organization's ID in Productive.io
   - Available in the `X-Organization-Id` header

3. **Person ID**: Your user ID in the system
   - Found in the API request payload under `relationships.person.data.id`

4. **Service ID**: The service/project you're logging time for
   - Found in the API request payload under `relationships.service.data.id`

### Getting Your Configuration

1. Open Productive.io in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Submit a timesheet entry manually
5. Look for the API call to `api.productive.io/api/v2/time_entries`
6. Copy the required values from headers and payload

## 📱 How to Use

1. **Configure API Settings:**
   - Enter your Auth Token, Organization ID, Person ID, and Service ID
   - Click "Save Config" to store locally

2. **Select Date Range:**
   - Choose start and end dates
   - Toggle "Business days only" to exclude weekends
   - Click "Generate Entries"

3. **Set Time Entries:**
   - Use bulk settings to apply default hours/notes to all entries
   - Customize individual entries as needed
   - Hours are converted to minutes automatically (8h = 480 minutes)

4. **Submit Timesheet:**
   - Review your entries in the table
   - Click "Submit Timesheet" to send all entries
   - Monitor progress and results in real-time

## 🔄 API Endpoints

### Development Proxy Routes

The application uses Angular proxy configuration (`proxy.conf.json`) for development:

- `/api/productive/*` → `https://api.productive.io/*`

### Production Routes (Vercel)

The `vercel.json` configuration handles routing in production:

```json
{
  "source": "/api/productive/:path*",
  "destination": "https://api.productive.io/:path*"
}
```

Timesheet entries are submitted directly to Productive through `/api/productive/api/v2/time_entries`, one request per selected day.

## 🛠️ Technical Stack

- **Frontend**: Angular 17 + PrimeNG
- **Backend**: Node.js API routes (Vercel Functions)
- **Deployment**: Vercel
- **Proxy**: Angular CLI Proxy (dev) + Vercel Rewrites (prod)

## 📦 Project Structure

```
├── src/app/
│   ├── pages/my-timesheet/           # Main timesheet component
│   ├── services/timesheet.service.ts # Timesheet service
│   └── app.routes.ts                 # Route configuration
├── proxy.conf.json                   # Development proxy config
├── vercel.json                       # Production deployment config
└── package.json                      # Dependencies and scripts
```

## 🔒 Security Notes

- Auth tokens are stored locally in browser storage
- All API calls go through proxy to avoid CORS issues
- Sensitive headers are handled server-side
- No sensitive data is logged or transmitted to third parties

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure proxy configuration is correct
2. **Auth Failures**: Verify your auth token is still valid
3. **Build Errors**: Check TypeScript types and imports
4. **API Errors**: Confirm your IDs (person, service, organization) are correct

### Debug Mode

Enable browser dev tools to see:
- Network requests to the proxy endpoints
- Console logs for submission progress
- Local storage for saved configuration

## 📄 License

This project is for educational and personal use. Respect Productive.io's terms of service when using their API.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**⚠️ Important**: Always test with a small date range first to ensure your configuration is correct before submitting large batches of timesheet entries.