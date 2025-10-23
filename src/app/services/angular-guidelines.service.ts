import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AngularGuideline {
  id: string;
  title: string;
  category: string;
  content: string;
  url: string;
  description?: string;
  tags?: string[];
}

export interface GuidelineCategory {
  id: string;
  name: string;
  icon: string;
  guidelines: string[]; // URLs to fetch
}

@Injectable({
  providedIn: 'root'
})
export class AngularGuidelinesService {
  // Base URLs for Angular documentation
  private readonly ANGULAR_DEV_CONTENT = '/api/angular-dev/assets/content';
  private readonly ANGULAR_DEV = 'https://angular.dev';

  // Predefined categories and their content URLs
  readonly categories: GuidelineCategory[] = [
    {
      id: 'introduction',
      name: 'Introduction',
      icon: 'pi pi-book',
      guidelines: [
        '/guide/what-is-angular.md.html',
        '/guide/installation.md.html',
        '/guide/start-coding.md.html'
      ]
    },
    {
      id: 'components',
      name: 'Components',
      icon: 'pi pi-box',
      guidelines: [
        '/guide/components/anatomy-of-components.md.html',
        '/guide/components/lifecycle.md.html',
        '/guide/components/queries.md.html',
        '/guide/components/styling.md.html',
        '/guide/components/host-elements.md.html'
      ]
    },
    {
      id: 'signals',
      name: 'Signals',
      icon: 'pi pi-bolt',
      guidelines: [
        '/guide/signals.md.html',
        '/guide/signals/overview.md.html',
        '/guide/signals/inputs.md.html',
        '/guide/signals/outputs.md.html'
      ]
    },
    {
      id: 'templates',
      name: 'Templates',
      icon: 'pi pi-code',
      guidelines: [
        '/guide/templates/overview.md.html',
        '/guide/templates/binding.md.html',
        '/guide/templates/control-flow.md.html',
        '/guide/templates/pipes.md.html'
      ]
    },
    {
      id: 'directives',
      name: 'Directives',
      icon: 'pi pi-sitemap',
      guidelines: [
        '/guide/directives/overview.md.html',
        '/guide/directives/attribute-directives.md.html',
        '/guide/directives/structural-directives.md.html'
      ]
    },
    {
      id: 'dependency-injection',
      name: 'Dependency Injection',
      icon: 'pi pi-share-alt',
      guidelines: [
        '/guide/di/overview.md.html',
        '/guide/di/dependency-injection-providers.md.html',
        '/guide/di/hierarchical-dependency-injection.md.html'
      ]
    },
    {
      id: 'routing',
      name: 'Routing',
      icon: 'pi pi-directions',
      guidelines: [
        '/guide/routing/overview.md.html',
        '/guide/routing/router-tutorial.md.html',
        '/guide/routing/common-router-tasks.md.html'
      ]
    },
    {
      id: 'forms',
      name: 'Forms',
      icon: 'pi pi-file-edit',
      guidelines: [
        '/guide/forms/overview.md.html',
        '/guide/forms/reactive-forms.md.html',
        '/guide/forms/template-driven-forms.md.html'
      ]
    },
    {
      id: 'http',
      name: 'HTTP Client',
      icon: 'pi pi-cloud-download',
      guidelines: [
        '/guide/http/setup.md.html',
        '/guide/http/making-requests.md.html',
        '/guide/http/interceptors.md.html'
      ]
    },
    {
      id: 'best-practices',
      name: 'Best Practices',
      icon: 'pi pi-star',
      guidelines: [
        '/best-practices/runtime-performance.md.html',
        '/best-practices/security.md.html',
        '/best-practices/accessibility.md.html'
      ]
    }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Fetch a guideline content from Angular.dev
   */
  fetchGuideline(url: string): Observable<string> {
    const fullUrl = `${this.ANGULAR_DEV_CONTENT}${url}`;
    return this.http.get(fullUrl, { responseType: 'text' });
  }

  /**
   * Parse HTML content to extract meaningful information
   */
  parseGuidelineContent(html: string, url: string): AngularGuideline {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract title (first h1)
    const titleElement = doc.querySelector('h1');
    const title = titleElement?.textContent?.trim() || 'Angular Guideline';

    // Extract description (first paragraph after title)
    const firstParagraph = doc.querySelector('p');
    const description = firstParagraph?.textContent?.trim() || '';

    // Get all content
    const content = doc.body.innerHTML || html;

    // Extract category from URL
    const category = this.getCategoryFromUrl(url);

    // Extract tags from content (look for common Angular terms)
    const tags = this.extractTags(content);

    return {
      id: url,
      title,
      category,
      content,
      url: `${this.ANGULAR_DEV}${url.replace('.md.html', '')}`,
      description,
      tags
    };
  }

  /**
   * Get category name from URL
   */
  private getCategoryFromUrl(url: string): string {
    const parts = url.split('/');
    if (parts.length >= 3) {
      return parts[2].replace('-', ' ');
    }
    return 'General';
  }

  /**
   * Extract relevant tags from content
   */
  private extractTags(content: string): string[] {
    const commonTags = [
      'component', 'directive', 'service', 'pipe', 'module',
      'routing', 'forms', 'http', 'signals', 'template',
      'dependency injection', 'testing', 'performance', 'security'
    ];

    const contentLower = content.toLowerCase();
    return commonTags.filter(tag => contentLower.includes(tag));
  }

  /**
   * Get all guidelines for a category
   */
  getCategoryGuidelines(categoryId: string): string[] {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.guidelines || [];
  }

  /**
   * Search guidelines by query
   */
  searchGuidelines(query: string, guidelines: AngularGuideline[]): AngularGuideline[] {
    const searchTerm = query.toLowerCase();
    return guidelines.filter(g =>
      g.title.toLowerCase().includes(searchTerm) ||
      g.description?.toLowerCase().includes(searchTerm) ||
      g.content.toLowerCase().includes(searchTerm) ||
      g.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }
}

