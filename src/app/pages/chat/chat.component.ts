import { 
  Component, 
  OnInit, 
  OnDestroy, 
  signal, 
  computed, 
  ViewChild, 
  ElementRef,
  AfterViewChecked,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebRTCService, ChatMessage, Caption, FileMetadata } from '../../services/webrtc.service';

type ViewMode = 'lobby' | 'chat';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  
  // View state
  viewMode = signal<ViewMode>('lobby');
  
  // Form inputs
  userName = signal('');
  roomIdInput = signal('');
  messageInput = signal('');
  
  // UI state
  showChat = signal(true);
  isChatCollapsed = signal(false); // Chat panel collapsed (minimized to icon)
  isFullscreen = signal(false);
  isCopied = signal(false);
  fullscreenVideoId = signal<string | null>(null);
  captionLanguage = signal('vi-VN');
  showLanguageMenu = signal(false);
  layoutMode = signal<'focus' | 'grid'>('focus'); // Layout mode: focus (screen share large) or grid (equal size)
  unreadMessages = signal(0); // Unread message counter
  lastReadMessageCount = signal(0); // Track last read message count
  
  // Available languages for captions
  languages = [
    { code: 'vi-VN', name: 'Tiếng Việt' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'ja-JP', name: '日本語' },
    { code: 'ko-KR', name: '한국어' },
    { code: 'zh-CN', name: '中文 (简体)' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'es-ES', name: 'Español' },
  ];
  
  // Get state from service
  localStream = computed(() => this.webrtcService.localStream());
  remoteStreams = computed(() => this.webrtcService.remoteStreams());
  isVideoEnabled = computed(() => this.webrtcService.isVideoEnabled());
  isAudioEnabled = computed(() => this.webrtcService.isAudioEnabled());
  isScreenSharing = computed(() => this.webrtcService.isScreenSharing());
  connectionStatus = computed(() => this.webrtcService.connectionStatus());
  roomId = computed(() => this.webrtcService.roomId());
  messages = computed(() => this.webrtcService.messages());
  
  // Caption state
  isCaptionsEnabled = computed(() => this.webrtcService.isCaptionsEnabled());
  captions = computed(() => this.webrtcService.captions());
  currentCaption = computed(() => this.webrtcService.currentCaption());
  
  // Screen share state
  localScreenStream = computed(() => this.webrtcService.localScreenStream());
  remoteScreenShares = computed(() => this.webrtcService.remoteScreenShares());
  screenSharerName = computed(() => this.webrtcService.screenSharerName());
  
  // Typing indicator
  typingUsers = computed(() => this.webrtcService.getTypingUsersArray());
  
  // Voice activity
  isSpeaking = computed(() => this.webrtcService.isSpeaking());
  
  private shouldScrollToBottom = false;
  private notificationSound: HTMLAudioElement | null = null;
  private lastMessageCount = 0;
  
  constructor(public webrtcService: WebRTCService) {}
  
  ngOnInit(): void {
    // Generate default username
    this.userName.set(this.webrtcService.getLocalUserName());
    
    // Initialize notification sound
    this.initNotificationSound();
    
    // Subscribe to new messages
    this.webrtcService.message$.subscribe((message) => {
      if (!this.isOwnMessage(message)) {
        // Play sound and increment unread if chat is collapsed
        if (this.isChatCollapsed()) {
          this.unreadMessages.update(n => n + 1);
          this.playNotificationSound();
        }
        this.shouldScrollToBottom = true;
      }
    });
  }
  
  // Initialize notification sound
  private initNotificationSound(): void {
    // Create a simple beep sound using Web Audio API
    this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telejiQ1/DMbR0TTpbF2s5nIRYufLnS08N4Pik8k8zi0G4cC0+VxtzNaiUaLX280tPDeTwqPJPM4tBuHAtPlcbczWolGi1+vdLTw3k8KjyTzOLQbhwLT5XG3M1qJRotfr3S08N5PCo8k8zi0G4cC0+VxtzNaiUaLX690tPDeTwqPJPM4tBuHAtPlcbczWolGi1+vdLTw3k8KjyTzOLQbhwLT5XG3M1qJRotfr3S08N5PCo8k8zi0G4cC0+VxtzNaiUaLX690tPDeTwqPJPM4tBuHAtPlcbczWolGi1+vdLTw3k8KjyTzOLQbhwLT5XG3M1qJRotfr3S08N5PCo8k8zi0G4cC0+VxtzNaiUaLX690tPDeTwqPJPM4tBuHAtPlcbczQ==');
  }
  
  // Play notification sound
  private playNotificationSound(): void {
    if (this.notificationSound) {
      this.notificationSound.currentTime = 0;
      this.notificationSound.volume = 0.5;
      this.notificationSound.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }
  
  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }
  
  ngOnDestroy(): void {
    this.webrtcService.cleanup();
  }
  
  // Create a new room
  async createRoom(): Promise<void> {
    if (!this.userName().trim()) {
      this.userName.set(this.webrtcService.getLocalUserName());
    }
    
    this.webrtcService.setLocalUserName(this.userName());
    
    // Initialize media first
    await this.webrtcService.initLocalStream(true, true);
    
    // Create room
    await this.webrtcService.createRoom();
    
    // Switch to chat view
    this.viewMode.set('chat');
    
    // Set local video stream
    setTimeout(() => this.attachLocalVideo(), 100);
  }
  
  // Join existing room
  async joinRoom(): Promise<void> {
    const roomId = this.roomIdInput().trim().toUpperCase();
    
    if (!roomId) {
      alert('Please enter a Room ID');
      return;
    }
    
    if (!this.userName().trim()) {
      this.userName.set(this.webrtcService.getLocalUserName());
    }
    
    this.webrtcService.setLocalUserName(this.userName());
    
    // Initialize media
    await this.webrtcService.initLocalStream(true, true);
    
    // Join room
    const success = await this.webrtcService.joinRoom(roomId);
    
    if (success) {
      this.viewMode.set('chat');
      setTimeout(() => this.attachLocalVideo(), 100);
    }
  }
  
  // Attach local video stream to video element
  private attachLocalVideo(): void {
    const stream = this.localStream();
    if (stream && this.localVideoRef?.nativeElement) {
      this.localVideoRef.nativeElement.srcObject = stream;
    }
  }
  
  // Toggle video
  toggleVideo(): void {
    this.webrtcService.toggleVideo();
  }
  
  // Toggle audio
  toggleAudio(): void {
    this.webrtcService.toggleAudio();
  }
  
  // Toggle screen sharing
  async toggleScreenShare(): Promise<void> {
    if (this.isScreenSharing()) {
      await this.webrtcService.stopScreenShare();
    } else {
      await this.webrtcService.startScreenShare();
    }
  }
  
  // Leave room
  leaveRoom(): void {
    this.webrtcService.leaveRoom();
    this.viewMode.set('lobby');
    this.roomIdInput.set('');
    this.messageInput.set('');
  }
  
  // Send message
  sendMessage(): void {
    const text = this.messageInput().trim();
    if (text) {
      this.webrtcService.stopTyping(); // Stop typing when message is sent
      this.webrtcService.sendMessage(text);
      this.messageInput.set('');
      this.shouldScrollToBottom = true;
    }
  }
  
  // Handle Enter key in message input
  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
  
  // Handle typing indicator
  onMessageInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateMessage(value);
    
    // Emit typing event
    if (value.trim()) {
      this.webrtcService.startTyping();
    } else {
      this.webrtcService.stopTyping();
    }
  }
  
  // Stop typing when input loses focus
  onMessageBlur(): void {
    this.webrtcService.stopTyping();
  }
  
  // Copy room ID to clipboard
  async copyRoomId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.roomId());
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  // Toggle chat panel (collapse/expand)
  toggleChat(): void {
    const newState = !this.isChatCollapsed();
    this.isChatCollapsed.set(newState);
    
    // Reset unread count when expanding chat
    if (!newState) {
      this.unreadMessages.set(0);
    }
  }
  
  // Toggle fullscreen
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }
  
  // Toggle layout mode (focus/grid)
  toggleLayoutMode(): void {
    this.layoutMode.set(this.layoutMode() === 'focus' ? 'grid' : 'focus');
  }
  
  // Toggle individual video fullscreen
  toggleVideoFullscreen(oderId: string): void {
    if (this.fullscreenVideoId() === oderId) {
      this.fullscreenVideoId.set(null);
    } else {
      this.fullscreenVideoId.set(oderId);
    }
  }
  
  // Get participant name by ID
  getParticipantName(oderId: string): string {
    return this.webrtcService.getParticipantName(oderId);
  }
  
// Check if participant's video is enabled
  // Note: WebRTC doesn't propagate track.enabled state to remote peers
  // So we must rely on the socket-based media state
  isParticipantVideoEnabled(peerId: string): boolean {
    return this.webrtcService.isParticipantVideoEnabled(peerId);
  }
  
  // Check if participant's audio is enabled
  isParticipantAudioEnabled(oderId: string): boolean {
    return this.webrtcService.isParticipantAudioEnabled(oderId);
  }
  
  // Check if peer is speaking
  isPeerSpeaking(peerId: string): boolean {
    return this.webrtcService.isPeerSpeaking(peerId);
  }
  
  // Check if stream has active video
  hasActiveVideo(stream: MediaStream): boolean {
    const videoTrack = stream.getVideoTracks()[0];
    return videoTrack ? videoTrack.enabled && !videoTrack.muted : false;
  }
  
  // Get first letter of name for avatar
  getAvatarLetter(name: string): string {
    return name?.charAt(0)?.toUpperCase() || '?';
  }
  
  // Toggle live captions
  toggleCaptions(): void {
    this.webrtcService.toggleCaptions(this.captionLanguage());
  }
  
  // Set caption language
  setCaptionLanguage(langCode: string): void {
    this.captionLanguage.set(langCode);
    this.showLanguageMenu.set(false);
    
    // Restart captions with new language if enabled
    if (this.isCaptionsEnabled()) {
      this.webrtcService.stopCaptions();
      setTimeout(() => {
        this.webrtcService.startCaptions(langCode);
      }, 100);
    }
  }
  
  // Toggle language menu
  toggleLanguageMenu(): void {
    this.showLanguageMenu.set(!this.showLanguageMenu());
  }
  
  // Get current language name
  getCurrentLanguageName(): string {
    const lang = this.languages.find(l => l.code === this.captionLanguage());
    return lang?.name || 'Tiếng Việt';
  }
  
  // Check if speech recognition is supported
  isSpeechRecognitionSupported(): boolean {
    return this.webrtcService.isSpeechRecognitionSupported();
  }
  
  // ==================== FILE SHARING ====================
  
  // Trigger file input
  triggerFileInput(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = false;
    fileInput.accept = '*/*';
    
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.sendFile(file);
      }
    };
    
    fileInput.click();
  }
  
  // Send file
  async sendFile(file: File): Promise<void> {
    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 100MB limit');
      return;
    }
    
    await this.webrtcService.sendFile(file);
    this.shouldScrollToBottom = true;
  }
  
  // Download file
  downloadFile(file: FileMetadata): void {
    if (!file.url) return;
    
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  // Preview image file
  isImageFile(file: FileMetadata): boolean {
    return file.type.startsWith('image/');
  }
  
  // Format file size
  formatFileSize(bytes: number): string {
    return this.webrtcService.formatFileSize(bytes);
  }
  
  // Get file icon
  getFileIcon(fileType: string): string {
    return this.webrtcService.getFileIcon(fileType);
  }
  
  // Handle drag over
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Handle file drop
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.sendFile(files[0]);
    }
  }
  
  // Scroll chat to bottom
  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
  
  // Format message time
  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Check if message is from current user
  isOwnMessage(message: ChatMessage): boolean {
    return message.sender === this.webrtcService.getLocalUserName();
  }
  
  // Update form values
  updateUserName(value: string): void {
    this.userName.set(value);
  }
  
  updateRoomId(value: string): void {
    this.roomIdInput.set(value);
  }
  
  updateMessage(value: string): void {
    this.messageInput.set(value);
  }
}
