import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { environment } from '../../environments/environment';

declare var gapi: any;
declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private isInitialized = false;
  private isSignedIn = new BehaviorSubject<boolean>(false);
  public isSignedIn$ = this.isSignedIn.asObservable();
  private accessToken: string | null = null;

  private readonly CLIENT_ID = environment.googleClientId;
  private readonly DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
  private readonly SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

  constructor() {
    this.initializeGapi();
  }

  /**
   * Initialize Google API client (using new Google Identity Services)
   */
  private async initializeGapi(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        console.error('Google API client library not loaded');
        reject(new Error('Google API client library not loaded'));
        return;
      }

      // Wait a bit for gapi to be fully available
      const checkGapi = () => {
        if (typeof gapi.load === 'function') {
          // Only load client, not auth2 (deprecated)
          gapi.load('client', async () => {
            try {
              // Initialize client only (no auth2)
              await gapi.client.init({
                discoveryDocs: this.DISCOVERY_DOCS
              });
              
              this.isInitialized = true;
              console.log('✅ Google API client initialized');
              
              // Check if we have a stored token
              const storedToken = sessionStorage.getItem('google_access_token');
              if (storedToken) {
                this.accessToken = storedToken;
                this.setAccessToken(storedToken);
                this.isSignedIn.next(true);
              }
              
              resolve();
            } catch (error: any) {
              console.error('❌ Error initializing Google API client:', error);
              reject(error);
            }
          });
        } else {
          // Retry after a short delay
          setTimeout(checkGapi, 100);
        }
      };

      checkGapi();
    });
  }

  /**
   * Set access token for API calls
   */
  private setAccessToken(token: string): void {
    this.accessToken = token;
    // Note: With Google Identity Services, we don't use gapi.client.setToken()
    // Instead, we'll pass the token directly in each API request
  }

  /**
   * Check if user is signed in
   */
  checkSignInStatus(): boolean {
    if (!this.isInitialized) return false;
    
    // Check if we have a stored token
    const storedToken = sessionStorage.getItem('google_access_token');
    if (storedToken) {
      this.accessToken = storedToken;
      this.setAccessToken(storedToken);
      this.isSignedIn.next(true);
      return true;
    }
    
    this.isSignedIn.next(false);
    return false;
  }

  /**
   * Sign in with Google using Google Identity Services
   */
  signIn(): Observable<boolean> {
    return from(this.initializeGapi().then(async () => {
      try {
        // Wait for Google Identity Services to be available
        await this.waitForGoogleIdentityServices();

        // Check if Google Identity Services is available
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
          throw new Error('Google Identity Services chưa được tải. Vui lòng tải lại trang.');
        }

        // Use Google Identity Services OAuth 2.0
        return new Promise<boolean>((resolve, reject) => {
          try {
            const tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: this.CLIENT_ID,
              scope: this.SCOPES,
              callback: (response: any) => {
                if (response.error) {
                  console.error('❌ OAuth error:', response.error);
                  if (response.error === 'popup_closed_by_user' || response.error === 'access_denied') {
                    reject(new Error('Đăng nhập bị hủy bởi người dùng'));
                  } else {
                    reject(new Error(`Lỗi đăng nhập: ${response.error}`));
                  }
                  return;
                }

                // Store token
                this.accessToken = response.access_token;
                sessionStorage.setItem('google_access_token', response.access_token);
                
                // Set token for gapi client
                this.setAccessToken(response.access_token);
                
                this.isSignedIn.next(true);
                console.log('✅ Signed in successfully');
                resolve(true);
              }
            });
            
            // Request access token (this will open popup)
            tokenClient.requestAccessToken();
          } catch (error: any) {
            console.error('❌ Error creating token client:', error);
            reject(new Error('Không thể khởi tạo Google OAuth. Vui lòng thử lại.'));
          }
        });
      } catch (error: any) {
        console.error('❌ Error signing in:', error);
        
        if (error.message) {
          throw new Error(error.message);
        }
        
        throw new Error('Không thể đăng nhập Google. Vui lòng thử lại.');
      }
    }));
  }

  /**
   * Wait for Google Identity Services to be loaded
   */
  private async waitForGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait

      const checkGoogle = () => {
        attempts++;
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Google Identity Services không thể tải. Vui lòng tải lại trang.'));
        } else {
          setTimeout(checkGoogle, 100);
        }
      };

      checkGoogle();
    });
  }

  /**
   * Sign out
   */
  signOut(): Observable<void> {
    return from(this.initializeGapi().then(async () => {
      try {
        // Revoke token if available
        if (this.accessToken && typeof google !== 'undefined' && google.accounts) {
          google.accounts.oauth2.revoke(this.accessToken, () => {
            console.log('Token revoked');
          });
        }
        
        // Clear stored token
        sessionStorage.removeItem('google_access_token');
        this.accessToken = null;
        
        // Clear gapi token
        if (gapi.client) {
          gapi.client.setToken(null);
        }
        
        this.isSignedIn.next(false);
      } catch (error) {
        console.error('Error signing out:', error);
        // Still clear local state even if revoke fails
        sessionStorage.removeItem('google_access_token');
        this.accessToken = null;
        this.isSignedIn.next(false);
      }
    }));
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    if (this.accessToken) {
      return this.accessToken;
    }
    
    // Try to get from session storage
    const storedToken = sessionStorage.getItem('google_access_token');
    if (storedToken) {
      this.accessToken = storedToken;
      return storedToken;
    }
    
    return null;
  }

  /**
   * Check if Google API is ready
   */
  isReady(): boolean {
    return this.isInitialized && typeof gapi !== 'undefined' && gapi.client !== undefined;
  }
}

