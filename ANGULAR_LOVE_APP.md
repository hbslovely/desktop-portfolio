# Angular.love Article App

## 📚 Overview

A beautiful, modern article reader app that integrates with the Angular.love (Angular InDepth) blog API to display Angular tutorials, RxJS guides, and technical articles.

## 🔗 API Endpoints Used

- **Articles List**: `https://28db4e59-blog-bff.contact-ef8.workers.dev/articles?take=12&skip=0&category=angular-in-depth`
- **Article Detail**: `https://28db4e59-blog-bff.contact-ef8.workers.dev/articles/{slug}`

## ✨ Features

### 📋 Article List View
- **Grid Layout**: Responsive card-based grid displaying articles
- **Search Functionality**: Real-time search across titles, excerpts, and authors
- **Category Filters**: 
  - Angular InDepth
  - RxJS
  - Tutorials
  - All Articles
- **Pagination**: Navigate through articles with previous/next buttons
- **Article Cards**: Display featured image, author info, reading time, title, and excerpt

### 📖 Article Detail View
- **Full Article Content**: Rich HTML content rendering
- **Hero Image**: Large featured image with gradient overlay
- **Author Information**: 
  - Avatar with Angular-red border
  - Name and position
  - Social media links (GitHub, Twitter, LinkedIn)
- **Article Metadata**:
  - Publication date
  - Reading time
  - Difficulty level (Beginner/Intermediate/Advanced) with color coding
- **Table of Contents**: Automatic TOC generation from article anchors
- **Styled Content**: Beautiful typography for all HTML elements:
  - Code blocks with syntax highlighting
  - Tables with gradient headers
  - Blockquotes with left border
  - Lists and images

## 🎨 Design Theme

### Color Palette
- **Primary**: Angular Red (#dd0031)
- **Secondary**: Deep Red (#c3002f)
- **Accent**: Pink (#ff4081)
- **Teal**: Cyan (#00bcd4)
- **Purple**: Material Purple (#9c27b0)

### UI Elements
- **Heartbeat Animation**: Animated heart icon in the header
- **Gradient Buttons**: Red-to-pink gradient primary actions
- **Card Hover Effects**: Elevation and scale transforms
- **Smooth Transitions**: Cubic-bezier easing for all animations
- **Glass Morphism**: Backdrop blur effects on header bars

## 📁 Files Created

### Service
- `src/app/services/angular-love.service.ts`
  - TypeScript interfaces for API responses
  - HTTP methods for fetching articles
  - Pagination support

### Component
- `src/app/components/apps/angular-love-app/angular-love-app.component.ts`
  - Signals-based state management
  - Article loading and detail viewing logic
  - Search and filter functionality
  - Pagination controls
- `src/app/components/apps/angular-love-app/angular-love-app.component.html`
  - Dual-view template (list and detail)
  - Dynamic content rendering
  - Responsive layout
- `src/app/components/apps/angular-love-app/angular-love-app.component.scss`
  - 800+ lines of modern SCSS
  - Responsive breakpoints
  - Animations and transitions
  - Custom scrollbars

### Configuration
- `src/app/config/window-registry.ts` - Added window definition
- `src/app/config/app-icons.config.ts` - Added app icon and metadata
- `src/app/app.component.ts` - Imported component
- `src/app/app.component.html` - Added component switch case

## 🚀 How to Use

1. **Open the App**: Click the Angular.love icon on the desktop (heart icon in column 3)
2. **Browse Articles**: Scroll through the article cards
3. **Search**: Use the search bar to find specific topics
4. **Filter by Category**: Click category pills to filter content
5. **Read Article**: Click any article card to view full details
6. **Navigate**: Use pagination buttons to load more articles
7. **Go Back**: Click "Back to Articles" to return to the list

## 🎯 Technical Highlights

- **Angular 18+**: Standalone components with signals
- **TypeScript**: Fully typed with strict mode
- **RxJS**: Reactive programming with observables
- **HttpClient**: RESTful API integration
- **Responsive Design**: Mobile-first approach
- **Performance**: Lazy loading and optimized rendering
- **Accessibility**: Semantic HTML and ARIA attributes

## 📊 Data Structure

### Article List Response
```typescript
{
  data: AngularLoveArticle[];
  total: string | number;
}
```

### Article Detail Response
```typescript
{
  id: number;
  content: string;  // HTML content
  slug: string;
  title: string;
  readingTime: number;
  publishDate: string;
  difficulty?: string;
  anchors?: AngularLoveAnchor[];  // TOC
  seo?: AngularLoveSEO;
  author: AngularLoveAuthor;
}
```

## 🎨 Styling Features

- **Gradient Headers**: Red-to-pink gradients on tables and sections
- **Difficulty Badges**: Color-coded by level
  - Green: Beginner
  - Orange: Intermediate
  - Red: Advanced
- **Custom Table Styling**: Interactive rows with hover effects
- **Code Blocks**: Monospace font with custom background
- **Author Cards**: Elevated card with gradient background
- **Reading Time Badge**: Floating badge on article images

## 📱 Responsive Breakpoints

- **Desktop**: Full grid layout (1200px+)
- **Tablet**: 2-column grid (768px - 1024px)
- **Mobile**: Single column (< 768px)

## 🔍 Search Keywords

The app is searchable via:
- 'angular', 'rxjs', 'tutorials', 'articles', 'blog'
- 'indepth', 'in-depth', 'web', 'development'
- 'typescript', 'frontend', 'framework', 'programming'
- 'coding', 'education', 'learning'

## 🌟 Future Enhancements

Potential improvements:
- Bookmark favorite articles
- Share articles via social media
- Dark mode theme
- Article categories expansion
- Comments section
- Related articles recommendations
- Full-text search with highlighting

## 📝 Notes

- All content is fetched from the Angular.love API
- The app handles API errors gracefully with retry functionality
- Images have fallback placeholders if loading fails
- Pagination maintains category filters
- Search is client-side for performance

---

**Created**: October 21, 2025  
**API Source**: [Angular.love](https://angular.love)  
**Framework**: Angular 18+ with Standalone Components

