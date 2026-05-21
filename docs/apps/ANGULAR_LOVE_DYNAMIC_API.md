# Angular Love Dynamic API URL Implementation

## Overview
This document describes the implementation of dynamic API URL fetching for the Angular Love service. The service now automatically crawls the angular.love website to detect and use the current API URL, with intelligent caching and failure recovery.

## Implementation Details

### Key Features
1. **Automatic API URL Discovery**: The service fetches the angular.love/news page and extracts the current API URL from the JavaScript bundle
2. **localStorage Caching**: API URL is cached in localStorage with a 3-day expiration to minimize network requests
3. **Smart Refresh**: Only fetches new URL when:
   - Cache is expired (after 3 days)
   - Cache doesn't exist
   - API calls fail (automatic retry mechanism)
4. **Fallback Mechanism**: If fetching fails, the service falls back to a known working URL
5. **Dynamic Detection**: Searches through all chunk files to find the `AL_API_URL` configuration

### How It Works

#### 1. Initial Setup
When the `AngularLoveService` is instantiated, it checks localStorage for a cached API URL:

```typescript
constructor(private http: HttpClient) {
  this.initializeApiUrl();
}
```

#### 2. Cache Check Process
The service performs the following steps on initialization:

1. **Check localStorage**: Looks for `angular_love_api_url` key
2. **Validate Expiration**: Checks if the cached URL is less than 3 days old
3. **Use Cached URL**: If valid and not expired, uses the cached URL immediately
4. **Fetch New URL**: If expired or missing, fetches a new URL from angular.love

#### 3. URL Discovery Process
When fetching is needed, the service:

1. **Fetch HTML Page**: Retrieves the angular.love/news page
2. **Extract Script References**: Searches for chunk JavaScript files (e.g., `chunk-OCQ5UGTF.js`)
3. **Search Each Chunk**: Iterates through each chunk file looking for `AL_API_URL`
4. **Extract URL**: Uses regex pattern to find the API URL: `AL_API_URL\s*:\s*"([^"]+)"`
5. **Update Service**: Updates the internal `BehaviorSubject` with the new URL
6. **Store in Cache**: Saves the URL to localStorage with current timestamp

#### 4. Automatic Retry on Failure
All API methods (`getArticles`, `getArticleBySlug`, `getAuthorBySlug`) include error handling:

```typescript
.pipe(
  catchError((error) => {
    console.error('Failed to fetch articles:', error);
    this.handleApiFailure(); // Triggers URL refresh
    return throwError(() => error);
  })
)
```

When an API call fails, the service automatically attempts to fetch a fresh API URL from angular.love.

### Current Configuration

- **Current API URL**: `https://0dd7e866-blog-bff.contact-ef8.workers.dev`
- **Fallback URL**: `https://0dd7e866-blog-bff.contact-ef8.workers.dev`
- **Cache Duration**: 3 days (259,200,000 milliseconds)
- **localStorage Key**: `angular_love_api_url`
- **Source**: Detected from `chunk-OCQ5UGTF.js` on angular.love

### Code Structure

#### Properties
- `baseUrlSubject`: BehaviorSubject that holds the current API URL
- `baseUrl$`: Observable for components to subscribe to URL changes
- `FALLBACK_URL`: Backup URL if detection fails
- `STORAGE_KEY`: Key used for localStorage (`angular_love_api_url`)
- `EXPIRATION_TIME`: Cache expiration time (3 days in milliseconds)

#### Key Methods

##### `initializeApiUrl()`
Initializes the service by checking localStorage and loading cached URL or fetching new one.

##### `getStoredApiUrl()`
Retrieves the cached API URL and timestamp from localStorage.

##### `storeApiUrl(url: string)`
Stores the API URL in localStorage with the current timestamp.

##### `isExpired(timestamp: number)`
Checks if a timestamp is older than 3 days.

##### `fetchAndStoreApiUrl()`
Fetches a new API URL and stores it in localStorage.

##### `fetchApiUrl()`
Main method that performs the URL discovery:
- Fetches angular.love/news HTML
- Parses for chunk file references
- Searches each chunk for AL_API_URL
- Updates the baseUrlSubject with the found URL

##### `handleApiFailure()`
Called when API requests fail. Triggers a fresh URL fetch from angular.love.

##### `getCurrentBaseUrl()`
Returns the current API URL from the BehaviorSubject.

##### `getArticles()`, `getArticleBySlug()`, `getAuthorBySlug()`
All API methods now:
- Use `getCurrentBaseUrl()` to get the latest API URL
- Include `catchError` handlers that trigger URL refresh on failure

## Benefits

1. **Resilience**: Automatically adapts if angular.love changes their API endpoint
2. **No Manual Updates**: No need to manually update the URL when angular.love updates
3. **Performance**: Caching reduces network requests - only fetches when needed
4. **Reliability**: 
   - Fallback mechanism ensures service continues working even if detection fails
   - Automatic retry on API failures ensures URL stays up-to-date
5. **Offline Support**: Cached URL works even when angular.love is temporarily unreachable
6. **Bandwidth Efficient**: Only crawls angular.love when cache expires or API fails

## Testing

To test the implementation:

1. **Check Console Logs**: Look for messages like:
   - `"Using cached API URL: https://..."` - When using cached URL
   - `"Cached URL expired or not found, fetching new one..."` - When cache is expired
   - `"Found and updated API URL: https://..."` - When URL is successfully fetched
   - `"API URL cached for 3 days: https://..."` - When URL is stored in cache
   - `"API call failed, attempting to refresh API URL..."` - When API fails and triggers refresh

2. **Check localStorage**: 
   - Open DevTools → Application → localStorage
   - Look for key `angular_love_api_url`
   - Value should be JSON with `url` and `timestamp` fields

3. **Test Cache Expiration**: 
   - Manually modify the timestamp in localStorage to a date 4 days ago
   - Refresh the app - should trigger a new fetch

4. **Test Failure Recovery**:
   - Temporarily block requests to the API URL (DevTools Network tab)
   - Trigger an article fetch
   - Service should automatically attempt to fetch new URL

5. **Monitor Network Requests**: 
   - First load: Should fetch angular.love/news and chunk files
   - Subsequent loads (within 3 days): No requests to angular.love
   - After 3 days: Should fetch again

## Monitoring

The service logs important events to the console:
- Successful URL updates
- Errors during fetching
- Warnings when falling back to default URL

## Future Improvements

Potential enhancements:
1. Add retry logic with exponential backoff for failed fetches
2. Add a manual refresh method accessible via component UI
3. Implement health checks for the discovered API URL before using it
4. Add metrics/analytics for URL change detection
5. Support multiple fallback URLs in case primary fails
6. Add unit tests for cache and expiration logic

## Technical Notes

### CORS Considerations
The implementation relies on angular.love having proper CORS headers to allow fetching their JavaScript files from the browser. Currently, their files are served with `access-control-allow-origin: *`.

### Performance
The service fetches the HTML and multiple JS files only when:
- Cache doesn't exist (first time)
- Cache has expired (after 3 days)
- API calls fail

This minimizes impact on performance and bandwidth while ensuring the URL stays current.

### Error Handling
All fetch operations are wrapped in try-catch blocks and include error logging. The service gracefully degrades to the fallback URL if any step fails.

## Related Files
- `/src/app/services/angular-love.service.ts` - Main service implementation
- `/src/app/components/apps/angular-love-app/` - Component using the service

## References
- Original API URL discovered: `https://0dd7e866-blog-bff.contact-ef8.workers.dev`
- Source website: https://angular.love/news
- Configuration chunk: `chunk-OCQ5UGTF.js` (hash may change with deployments)

