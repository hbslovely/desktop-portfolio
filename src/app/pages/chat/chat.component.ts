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
import { WebRTCService, ChatMessage } from '../../services/webrtc.service';

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
  isFullscreen = signal(false);
  isCopied = signal(false);
  
  // Get state from service
  localStream = computed(() => this.webrtcService.localStream());
  remoteStreams = computed(() => this.webrtcService.remoteStreams());
  isVideoEnabled = computed(() => this.webrtcService.isVideoEnabled());
  isAudioEnabled = computed(() => this.webrtcService.isAudioEnabled());
  isScreenSharing = computed(() => this.webrtcService.isScreenSharing());
  connectionStatus = computed(() => this.webrtcService.connectionStatus());
  roomId = computed(() => this.webrtcService.roomId());
  messages = computed(() => this.webrtcService.messages());
  
  private shouldScrollToBottom = false;
  
  constructor(public webrtcService: WebRTCService) {}
  
  ngOnInit(): void {
    // Generate default username
    this.userName.set(this.webrtcService.getLocalUserName());
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
  
  // Toggle chat panel
  toggleChat(): void {
    this.showChat.set(!this.showChat());
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
