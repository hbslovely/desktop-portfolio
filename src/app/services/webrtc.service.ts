import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  timestamp: Date | string;
  type: 'text' | 'system' | 'file';
  file?: FileMetadata;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  url?: string; // Blob URL for downloaded files
  progress?: number; // Download progress 0-100
  status: 'pending' | 'transferring' | 'completed' | 'error';
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  senderId: string;
  senderName: string;
  chunks: ArrayBuffer[];
  receivedSize: number;
  totalChunks: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
}

export interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  connection?: RTCPeerConnection;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
  isScreenSharing?: boolean;
}

export interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing: boolean;
}

export interface Caption {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService implements OnDestroy {
  // Signals for reactive state
  localStream = signal<MediaStream | null>(null);
  remoteStreams = signal<Map<string, MediaStream>>(new Map());
  isVideoEnabled = signal(true);
  isAudioEnabled = signal(true);
  isScreenSharing = signal(false);
  connectionStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  roomId = signal<string>('');
  participants = signal<Participant[]>([]);
  messages = signal<ChatMessage[]>([]);

  // Screen share state
  localScreenStream = signal<MediaStream | null>(null);
  remoteScreenShares = signal<Map<string, MediaStream>>(new Map());
  screenSharerName = signal<string | null>(null); // Who is currently sharing (remote)

  // Caption/CC state
  isCaptionsEnabled = signal(false);
  captions = signal<Caption[]>([]);
  currentCaption = signal<Caption | null>(null);

  // Typing indicator state
  typingUsers = signal<Map<string, string>>(new Map()); // oderId -> userName

  // Voice activity detection
  isSpeaking = signal(false);
  speakingPeers = signal<Set<string>>(new Set());

  // Events
  private messageSubject = new Subject<ChatMessage>();
  message$ = this.messageSubject.asObservable();

  // Socket.IO connection
  private socket: Socket | null = null;

  // Signaling server URL - configurable via environment
  private signalingServerUrl = environment.signalingServerUrl || 'http://localhost:3007';

  // WebRTC configuration
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      // STUN servers for NAT discovery
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Additional STUN servers
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      { urls: 'stun:stun.voipstunt.com' },
      // TURN servers for better connectivity (public free TURN servers)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10, // Pre-gather more candidates
    iceTransportPolicy: 'all' // Use both relay and direct connections
  };

  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private localUserId = '';
  private localUserName = '';
  private screenStream: MediaStream | null = null;
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  // Track known stream IDs per peer (to distinguish camera vs screen share)
  private peerStreamIds = new Map<string, Set<string>>();

  // Track participant names by ID
  private participantNames = new Map<string, string>();

  // Track participant media states (video/audio enabled)
  private participantMediaStates = new Map<string, { videoEnabled: boolean; audioEnabled: boolean }>();

  // Track received message IDs to prevent duplicates
  private receivedMessageIds = new Set<string>();

  // Speech recognition for live captions
  private speechRecognition: any = null;
  private isRecognitionActive = false;

  // File transfer
  private fileTransfers = new Map<string, FileTransfer>();
  private readonly CHUNK_SIZE = 16384; // 16KB chunks for WebRTC

  // Typing indicator
  private typingTimeout: any = null;
  private isCurrentlyTyping = false;
  private typingTimeouts = new Map<string, any>(); // Clear typing after timeout

  // Voice activity detection
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalysers = new Map<string, AnalyserNode>();
  private voiceActivityInterval: any;

  // Random name generators
  private adjectives = [
    'Happy', 'Brave', 'Clever', 'Swift', 'Bright', 'Calm', 'Kind', 'Bold',
    'Wise', 'Cool', 'Noble', 'Quick', 'Sharp', 'Smart', 'Warm', 'Wild',
    'Lucky', 'Sunny', 'Cosmic', 'Magic', 'Golden', 'Silver', 'Crystal', 'Ocean',
    'Forest', 'Thunder', 'Shadow', 'Mystic', 'Stellar', 'Atomic', 'Digital', 'Neon'
  ];

  private nouns = [
    'Tiger', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Hawk', 'Fox', 'Panda',
    'Dragon', 'Phoenix', 'Falcon', 'Shark', 'Dolphin', 'Owl', 'Raven', 'Lynx',
    'Knight', 'Ninja', 'Wizard', 'Ranger', 'Hunter', 'Pilot', 'Captain', 'Scout',
    'Coder', 'Hacker', 'Gamer', 'Artist', 'Voyager', 'Explorer', 'Pioneer', 'Legend'
  ];

  constructor() {
    this.localUserName = this.generateRandomName();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private generateUserId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  // Generate a random meaningful username
  private generateRandomName(): string {
    const adj = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
  }

  getLocalUserId(): string {
    return this.localUserId;
  }

  getLocalUserName(): string {
    return this.localUserName;
  }

  setLocalUserName(name: string): void {
    this.localUserName = name || this.generateRandomName();
  }

  // Connect to signaling server
  private connectToSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      console.log('Connecting to signaling server:', this.signalingServerUrl);

      this.socket = io(this.signalingServerUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('Connected to signaling server with ID:', this.socket?.id);
        this.localUserId = this.socket?.id || this.generateUserId();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.connectionStatus.set('disconnected');
        this.addSystemMessage('Failed to connect to server. Using local mode.');
        // Resolve anyway to allow local testing
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from signaling server:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.socket?.connect();
        }
      });

      // Setup signaling event handlers
      this.setupSignalingHandlers();
    });
  }

  // Setup signaling event handlers
  private setupSignalingHandlers(): void {
    if (!this.socket) return;

    // Room joined - receive existing participants
    this.socket.on('room-joined', async ({ roomId, participants, userId }) => {
      console.log('Joined room:', roomId, 'Existing participants:', participants);
      this.localUserId = userId;
      this.connectionStatus.set('connected');
      this.addSystemMessage(`Joined room: ${roomId}`);

      // Store participant names and create peer connections
      for (const participant of participants) {
        this.participantNames.set(participant.id, participant.userName);
        // Store initial media state from participant (default to true if not provided)
        this.participantMediaStates.set(participant.id, {
          videoEnabled: participant.videoEnabled ?? true,
          audioEnabled: participant.audioEnabled ?? true
        });
        await this.createPeerConnection(participant.id, true);
      }

      // Update participants list
      this.updateParticipantsList();

      // Send our media state to existing participants
      setTimeout(() => this.notifyMediaStateChange(), 500);
    });

    // New user joined
    this.socket.on('user-joined', async ({ userId, userName }) => {
      console.log('User joined:', userName, userId);
      this.addSystemMessage(`${userName} joined the room`);

      // Store participant name
      this.participantNames.set(userId, userName);

      // Set default media state for new user (default to true)
      this.participantMediaStates.set(userId, {
        videoEnabled: true,
        audioEnabled: true
      });

      // Create peer connection and send offer
      await this.createPeerConnection(userId, false);

      // Send our media state to the new user
      setTimeout(() => this.notifyMediaStateChange(), 500);

      // Update participants list
      this.updateParticipantsList();
    });

    // User left
    this.socket.on('user-left', ({ userId, userName }) => {
      console.log('User left:', userName, userId);
      this.addSystemMessage(`${userName} left the room`);
      this.participantNames.delete(userId);
      this.handlePeerDisconnect(userId);

      // Update participants list
      this.updateParticipantsList();
    });

    // Receive offer
    this.socket.on('offer', async ({ senderId, senderName, offer }) => {
      console.log('Received offer from:', senderName, senderId);
      await this.handleOffer(senderId, offer);
    });

    // Receive answer
    this.socket.on('answer', async ({ senderId, answer }) => {
      console.log('Received answer from:', senderId);
      await this.handleAnswer(senderId, answer);
    });

    // Receive ICE candidate
    this.socket.on('ice-candidate', async ({ senderId, candidate }) => {
      console.log('Received ICE candidate from:', senderId);
      await this.handleIceCandidate(senderId, candidate);
    });

    // Receive chat message
    this.socket.on('chat-message', (message: ChatMessage) => {
      // Don't add our own messages (server broadcasts to all)
      // Also check for duplicate messages by ID
      if (message.senderId !== this.localUserId && !this.receivedMessageIds.has(message.id)) {
        this.receivedMessageIds.add(message.id);
        const chatMessage: ChatMessage = {
          ...message,
          timestamp: new Date(message.timestamp)
        };
        this.messages.update(msgs => [...msgs, chatMessage]);
        this.messageSubject.next(chatMessage);
      }
    });

    // Media state change from other users
    this.socket.on('media-state-change', ({ userId, video, audio, screenShare }) => {
      // Store media state
      this.participantMediaStates.set(userId, { videoEnabled: video, audioEnabled: audio });

      // Update participants list
      this.updateParticipantsList();
    });

    // Receive live captions from other users
    this.socket.on('caption', (caption: Caption) => {
      if (caption.speakerId !== this.localUserId) {
        this.handleRemoteCaption(caption);
      }
    });

    // Screen share started by remote user
    this.socket.on('screen-share-start', ({ userId, userName }) => {
      console.log('Screen share started by:', userName);
      this.screenSharerName.set(userName);
      this.addSystemMessage(`${userName} started screen sharing`);
    });

    // Typing indicator
    this.socket.on('user-typing', ({ userId, userName, isTyping }) => {
      this.handleRemoteTyping(userId, userName, isTyping);
    });

    // Screen share stopped by remote user
    this.socket.on('screen-share-stop', ({ userId, userName }) => {
      console.log('Screen share stopped by:', userName);
      this.screenSharerName.set(null);
      // Remove the screen share stream
      this.remoteScreenShares.update(shares => {
        const newShares = new Map(shares);
        newShares.delete(userId);
        return newShares;
      });
      this.addSystemMessage(`${userName} stopped screen sharing`);
    });
  }

  // Initialize local media stream
  async initLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream | null> {
    try {
      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: isMobile ? { ideal: 640, max: 1280 } : { ideal: 1280 },
          height: isMobile ? { ideal: 480, max: 720 } : { ideal: 720 },
          facingMode: 'user',
          aspectRatio: { ideal: 16/9 }
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: isMobile ? 16000 : 48000 // Lower sample rate for mobile
        } : false
      });

      this.localStream.set(stream);
      this.isVideoEnabled.set(video);
      this.isAudioEnabled.set(audio);

      // Setup voice activity detection for local stream
      if (audio) {
        this.setupVoiceActivityDetection(stream);
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      this.addSystemMessage('Failed to access camera/microphone. Please check permissions.');
      return null;
    }
  }

  // Setup voice activity detection
  private setupVoiceActivityDetection(stream: MediaStream): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;
      this.localAnalyser.smoothingTimeConstant = 0.5;
      source.connect(this.localAnalyser);

      // Start monitoring voice activity
      this.startVoiceActivityMonitoring();
    } catch (error) {
      console.error('Error setting up voice activity detection:', error);
    }
  }

  // Start monitoring voice activity
  private startVoiceActivityMonitoring(): void {
    if (this.voiceActivityInterval) {
      clearInterval(this.voiceActivityInterval);
    }

    const checkVoiceActivity = () => {
      // Check local speaking
      if (this.localAnalyser && this.isAudioEnabled()) {
        const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
        this.localAnalyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = average > 15; // Threshold for voice activity

        if (this.isSpeaking() !== isSpeaking) {
          this.isSpeaking.set(isSpeaking);
        }
      } else {
        if (this.isSpeaking()) {
          this.isSpeaking.set(false);
        }
      }

      // Check remote speakers
      const currentSpeakers = new Set<string>();
      this.remoteAnalysers.forEach((analyser, peerId) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (average > 15) {
          currentSpeakers.add(peerId);
        }
      });

      // Update if changed
      const currentSet = this.speakingPeers();
      if (currentSpeakers.size !== currentSet.size ||
          ![...currentSpeakers].every(id => currentSet.has(id))) {
        this.speakingPeers.set(currentSpeakers);
      }
    };

    // Check every 100ms
    this.voiceActivityInterval = setInterval(checkVoiceActivity, 100);
  }

  // Setup voice activity detection for remote stream
  setupRemoteVoiceActivity(peerId: string, stream: MediaStream): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      this.remoteAnalysers.set(peerId, analyser);
    } catch (error) {
      console.error('Error setting up remote voice activity:', error);
    }
  }

  // Check if a specific peer is speaking
  isPeerSpeaking(peerId: string): boolean {
    return this.speakingPeers().has(peerId);
  }

  // Toggle video
  toggleVideo(): void {
    const stream = this.localStream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoEnabled.set(videoTrack.enabled);

        // Notify other participants
        this.notifyMediaStateChange();
      }
    }
  }

  // Toggle audio
  toggleAudio(): void {
    const stream = this.localStream();
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const wasEnabled = audioTrack.enabled;
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioEnabled.set(audioTrack.enabled);

        // If audio was just enabled and captions are active, restart recognition
        if (!wasEnabled && audioTrack.enabled && this.isCaptionsEnabled()) {
          console.log('Audio enabled, restarting captions...');
          setTimeout(() => {
            this.restartCaptionsIfNeeded();
          }, 500); // Small delay to ensure mic is ready
        }

        // Notify other participants
        this.notifyMediaStateChange();
      }
    }
  }

  // Notify media state change
  private notifyMediaStateChange(): void {
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('media-state-change', {
        roomId: this.roomId(),
        video: this.isVideoEnabled(),
        audio: this.isAudioEnabled(),
        screenShare: this.isScreenSharing()
      });
    }
  }

  // Start screen sharing
  async startScreenShare(): Promise<boolean> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const videoTrack = this.screenStream.getVideoTracks()[0];

      // Add screen share track to all peer connections and renegotiate
      for (const [peerId, pc] of this.peerConnections.entries()) {
        // Add new track for screen share
        pc.addTrack(videoTrack, this.screenStream!);

        // Renegotiate to send the new track
        await this.renegotiate(peerId, pc);
      }

      // Update local screen stream signal
      this.localScreenStream.set(this.screenStream);
      this.isScreenSharing.set(true);

      // Notify other participants about screen share
      this.notifyScreenShareStart();

      // Handle screen share end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return true;
    } catch (error) {
      console.error('Error sharing screen:', error);
      return false;
    }
  }

  // Renegotiate peer connection (used when adding/removing tracks)
  private async renegotiate(peerId: string, pc: RTCPeerConnection): Promise<void> {
    try {
      console.log('Renegotiating with peer:', peerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.socket?.connected) {
        this.socket.emit('offer', {
          targetId: peerId,
          offer: pc.localDescription
        });
      }
    } catch (error) {
      console.error('Renegotiation error:', error);
    }
  }

  // Stop screen sharing
  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      const videoTrack = this.screenStream.getVideoTracks()[0];

      // Remove screen share track from all peer connections and renegotiate
      for (const [peerId, pc] of this.peerConnections.entries()) {
        const sender = pc.getSenders().find(s => s.track === videoTrack);
        if (sender) {
          pc.removeTrack(sender);
          // Renegotiate after removing track
          await this.renegotiate(peerId, pc);
        }
      }

      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Clear local screen stream signal
    this.localScreenStream.set(null);
    this.isScreenSharing.set(false);

    // Notify other participants about screen share stop
    this.notifyScreenShareStop();
  }

  // Notify screen share started
  private notifyScreenShareStart(): void {
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('screen-share-start', {
        roomId: this.roomId(),
        userName: this.localUserName
      });
    }
    this.addSystemMessage(`You started screen sharing`);
  }

  // Notify screen share stopped
  private notifyScreenShareStop(): void {
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('screen-share-stop', {
        roomId: this.roomId()
      });
    }
    this.addSystemMessage(`You stopped screen sharing`);
  }

  // Create a new room (as host)
  async createRoom(): Promise<string> {
    await this.connectToSignalingServer();

    const roomId = this.generateRoomId();
    this.roomId.set(roomId);
    this.connectionStatus.set('connecting');

    if (this.socket?.connected) {
      this.socket.emit('join-room', {
        roomId,
        userName: this.localUserName
      });
    } else {
      // Fallback for local testing without server
      this.connectionStatus.set('connected');
      this.addSystemMessage(`Room created! Share this ID: ${roomId}`);
    }

    return roomId;
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Join an existing room
  async joinRoom(roomId: string): Promise<boolean> {
    try {
      await this.connectToSignalingServer();

      this.roomId.set(roomId);
      this.connectionStatus.set('connecting');

      if (this.socket?.connected) {
        this.socket.emit('join-room', {
          roomId,
          userName: this.localUserName
        });
        return true;
      } else {
        // Fallback for local testing
        this.connectionStatus.set('connected');
        this.addSystemMessage(`Joined room: ${roomId}`);
        return true;
      }
    } catch (error) {
      console.error('Error joining room:', error);
      this.connectionStatus.set('disconnected');
      this.addSystemMessage('Failed to join room.');
      return false;
    }
  }

  // Create peer connection
  private async createPeerConnection(peerId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    console.log('Creating peer connection for:', peerId, 'createOffer:', createOffer);

    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // Add local stream tracks (camera)
    const localStream = this.localStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Add screen share track if currently sharing
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        pc.addTrack(track, this.screenStream!);
      });
    }

    // Initialize stream tracking for this peer if not exists
    if (!this.peerStreamIds.has(peerId)) {
      this.peerStreamIds.set(peerId, new Set<string>());
    }

// Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from:', peerId, 'track kind:', event.track.kind, 'streams:', event.streams.length);
      const remoteStream = event.streams[0];

      if (!remoteStream) {
        console.warn('No stream in track event');
        return;
      }

      const knownStreamIds = this.peerStreamIds.get(peerId)!;

      // Check if this is a new stream (screen share) or existing (camera)
      const isNewStream = !knownStreamIds.has(remoteStream.id);

      console.log('Stream ID:', remoteStream.id, 'isNew:', isNewStream, 'known streams:', knownStreamIds.size);

      if (isNewStream) {
        knownStreamIds.add(remoteStream.id);

        // First stream is camera, additional streams are screen share
        if (knownStreamIds.size === 1) {
          // This is the camera stream
          console.log('Setting as camera stream for:', peerId);
          this.remoteStreams.update(streams => {
            const newStreams = new Map(streams);
            newStreams.set(peerId, remoteStream);
            return newStreams;
          });
          
          // Setup voice activity detection for remote stream
          try {
            this.setupRemoteVoiceActivity(peerId, remoteStream);
          } catch (error) {
            console.error('Error setting up remote voice activity:', error);
          }
        } else {
          // This is a screen share stream
          console.log('Setting as screen share stream for:', peerId);
          this.remoteScreenShares.update(shares => {
            const newShares = new Map(shares);
            newShares.set(peerId, remoteStream);
            return newShares;
          });

          // Listen for track removal on screen share stream
          event.track.onended = () => {
            console.log('Screen share track ended from:', peerId);
            this.remoteScreenShares.update(shares => {
              const newShares = new Map(shares);
              newShares.delete(peerId);
              return newShares;
            });
            // Remove from known streams so it can be re-added if they share again
            knownStreamIds.delete(remoteStream.id);
          };

          event.track.onmute = () => {
            console.log('Screen share track muted from:', peerId);
            this.remoteScreenShares.update(shares => {
              const newShares = new Map(shares);
              newShares.delete(peerId);
              return newShares;
            });
          };
        }
      }

      // Update participants list when stream is received
      this.updateParticipantsList();
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket?.connected) {
        console.log('Sending ICE candidate to:', peerId, 'candidate:', event.candidate.candidate);
        this.socket.emit('ice-candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      } else if (!event.candidate) {
        console.log('ICE gathering completed for:', peerId);
      }
    };

    // Handle ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state for', peerId, ':', pc.iceGatheringState);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state with', peerId, ':', pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        console.error('Peer connection failed with', peerId, '- attempting reconnection');
        // Try to reconnect
        this.reconnectPeer(peerId);
      } else if (pc.connectionState === 'disconnected') {
        // Wait a bit to see if it reconnects automatically
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log('Connection still disconnected, handling disconnect for:', peerId);
            this.handlePeerDisconnect(peerId);
          }
        }, 3000);
      } else if (pc.connectionState === 'connected') {
        console.log('Peer connection established with', peerId);
        // Setup remote voice activity when connected (if not already setup)
        setTimeout(() => {
          const remoteStream = this.remoteStreams().get(peerId);
          if (remoteStream && !this.remoteAnalysers.has(peerId)) {
            try {
              this.setupRemoteVoiceActivity(peerId, remoteStream);
            } catch (error) {
              console.error('Error setting up remote voice activity on connect:', error);
            }
          }
        }, 500);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state with', peerId, ':', pc.iceConnectionState);

      // Handle connection failures
      if (pc.iceConnectionState === 'failed') {
        console.warn('ICE connection failed with', peerId, '- attempting to restart ICE');
        // Try to restart ICE
        if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') {
          try {
            pc.restartIce();
            console.log('ICE restart initiated for:', peerId);
          } catch (error) {
            console.error('Error restarting ICE:', error);
            // If restart fails, try to recreate the connection
            this.reconnectPeer(peerId);
          }
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('ICE disconnected with', peerId, '- will retry');
        // Wait a bit and check if it reconnects
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log('ICE still disconnected, attempting restart for:', peerId);
            if (pc.signalingState === 'stable') {
              try {
                pc.restartIce();
              } catch (error) {
                console.error('Error restarting ICE after disconnect:', error);
              }
            }
          }
        }, 2000);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('ICE connection successful with', peerId);
      }
    };

    // Create data channel for messaging (only if creating offer)
    if (createOffer) {
      try {
        const dataChannel = pc.createDataChannel('chat', {
          ordered: true,
          maxPacketLifeTime: 3000, // 3 seconds timeout
          maxRetransmits: 3
        });
        console.log('Created data channel for:', peerId);
        this.setupDataChannel(dataChannel, peerId);
      } catch (error) {
        console.error('Error creating data channel:', error);
      }
    }

    // Handle incoming data channels (when receiving offer)
    pc.ondatachannel = (event) => {
      console.log('Received data channel from:', peerId, 'channel:', event.channel.label);
      this.setupDataChannel(event.channel, peerId);
    };

    // Create and send offer if we're the initiator
    if (createOffer) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);

        if (this.socket?.connected) {
          console.log('Sending offer to:', peerId);
          this.socket.emit('offer', {
            targetId: peerId,
            offer: pc.localDescription
          });
        }
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    // Apply any pending ICE candidates
    const pendingCandidates = this.pendingCandidates.get(peerId);
    if (pendingCandidates) {
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding pending ICE candidate:', error);
        }
      }
      this.pendingCandidates.delete(peerId);
    }

    return pc;
  }

  // Handle incoming offer
  private async handleOffer(senderId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let pc = this.peerConnections.get(senderId);

    if (!pc) {
      pc = await this.createPeerConnection(senderId, false);
    }

    try {
      // Ensure local tracks are added before setting remote description
      const localStream = this.localStream();
      if (localStream) {
        const existingTracks = pc.getSenders().map(s => s.track);
        localStream.getTracks().forEach(track => {
          if (!existingTracks.includes(track)) {
            console.log('Adding local track to peer connection:', track.kind);
            pc.addTrack(track, localStream);
          }
        });
      }

      // Add screen share track if currently sharing
      if (this.screenStream) {
        const existingScreenTracks = pc.getSenders().map(s => s.track);
        this.screenStream.getTracks().forEach(track => {
          if (!existingScreenTracks.includes(track)) {
            console.log('Adding screen share track to peer connection');
            pc.addTrack(track, this.screenStream!);
          }
        });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(answer);

      if (this.socket?.connected) {
        console.log('Sending answer to:', senderId);
        this.socket.emit('answer', {
          targetId: senderId,
          answer: pc.localDescription
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  // Handle incoming answer
  private async handleAnswer(senderId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(senderId);

    if (!pc) {
      console.error('No peer connection found for:', senderId);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // Handle incoming ICE candidate
  private async handleIceCandidate(senderId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(senderId);

    if (!pc) {
      // Store candidate for later if peer connection doesn't exist yet
      if (!this.pendingCandidates.has(senderId)) {
        this.pendingCandidates.set(senderId, []);
      }
      this.pendingCandidates.get(senderId)!.push(candidate);
      console.log('Stored pending ICE candidate for:', senderId);
      return;
    }

    // Check if remote description is set
    if (pc.remoteDescription === null) {
      // Store candidate if remote description not set yet
      if (!this.pendingCandidates.has(senderId)) {
        this.pendingCandidates.set(senderId, []);
      }
      this.pendingCandidates.get(senderId)!.push(candidate);
      console.log('Stored pending ICE candidate (no remote description yet) for:', senderId);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate for:', senderId);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      // Don't throw - some candidates might fail but others might work
    }
  }

  // Setup data channel for messaging
  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    // Set binary type for file transfers
    channel.binaryType = 'arraybuffer';

    // Log channel state changes
    channel.onopen = () => {
      console.log('Data channel opened with:', peerId, 'readyState:', channel.readyState);
      this.dataChannels.set(peerId, channel);
    };

    channel.onbufferedamountlow = () => {
      console.log('Data channel buffer low for:', peerId);
    };

    channel.onmessage = (event) => {
      // Check if it's binary data (file chunk)
      if (event.data instanceof ArrayBuffer) {
        this.handleFileChunk(peerId, event.data);
        return;
      }

      // Try to parse as JSON message
      try {
        const data = JSON.parse(event.data);

        // Handle file transfer metadata ONLY
        // Text messages are handled via Socket.IO to avoid duplicates
        if (data.type === 'file-start') {
          this.handleFileStart(peerId, data);
          return;
        }

        if (data.type === 'file-end') {
          this.handleFileEnd(peerId, data);
          return;
        }

        // Ignore other messages - they come from Socket.IO
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onclose = () => {
      console.log('Data channel closed with:', peerId);
      this.dataChannels.delete(peerId);
    };
  }

  // Send chat message
  sendMessage(text: string): void {
    if (!text.trim()) return;

    const message: ChatMessage = {
      id: this.generateUserId(),
      sender: this.localUserName,
      senderId: this.localUserId,
      text: text.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    // Add to local messages
    this.messages.update(msgs => [...msgs, message]);

    // Send via signaling server ONLY (to avoid duplicates)
    // DataChannel is now only used for file transfer
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('chat-message', {
        roomId: this.roomId(),
        message: text.trim()
      });
    }

    this.messageSubject.next(message);
  }

  // Add system message
  private addSystemMessage(text: string): void {
    const message: ChatMessage = {
      id: this.generateUserId(),
      sender: 'System',
      text,
      timestamp: new Date(),
      type: 'system'
    };
    this.messages.update(msgs => [...msgs, message]);
  }

  // ==================== FILE TRANSFER ====================

  // Send a file to all connected peers
  async sendFile(file: File): Promise<void> {
    if (!file) return;

    const fileId = this.generateUserId();
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // Create file message
    const fileMessage: ChatMessage = {
      id: fileId,
      sender: this.localUserName,
      senderId: this.localUserId,
      text: `Sent file: ${file.name}`,
      timestamp: new Date(),
      type: 'file',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'transferring',
        progress: 0
      }
    };

    // Add to local messages
    this.messages.update(msgs => [...msgs, fileMessage]);

    // Send file via data channels to each peer
    const arrayBuffer = await file.arrayBuffer();

    // Wait for data channels to be ready
    const sendPromises: Promise<void>[] = [];

    for (const [peerId, pc] of this.peerConnections.entries()) {
      // Get or wait for data channel
      let channel = this.dataChannels.get(peerId);

      if (!channel) {
        // Wait for data channel to be created (max 3 seconds)
        const waitForChannel = new Promise<RTCDataChannel | null>((resolve) => {
          let attempts = 0;
          const maxAttempts = 30; // 3 seconds

          const checkChannel = () => {
            const ch = this.dataChannels.get(peerId);
            if (ch) {
              resolve(ch);
              return;
            }

            attempts++;
            if (attempts >= maxAttempts) {
              console.warn('Data channel timeout for:', peerId);
              resolve(null);
              return;
            }

            setTimeout(checkChannel, 100);
          };

          checkChannel();
        });

        channel = await waitForChannel as any;
        if (!channel) {
          console.warn('Data channel not available for:', peerId);
          continue;
        }
      }

      // Wait for channel to be open
      if (channel.readyState === 'open') {
        sendPromises.push(this.sendFileToPeer(channel, fileId, file, arrayBuffer, totalChunks));
      } else if (channel.readyState === 'connecting') {
        // Wait for channel to open
        const waitForOpen = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Data channel open timeout for:', peerId);
            resolve();
          }, 5000);

          const originalOnOpen = channel.onopen as any;
          channel.onopen = () => {
            clearTimeout(timeout);
            if (originalOnOpen) originalOnOpen();
            console.log('Data channel opened, sending file to:', peerId);
            this.sendFileToPeer(channel, fileId, file, arrayBuffer, totalChunks).then(() => resolve());
          };
        });
        sendPromises.push(waitForOpen);
      } else {
        console.warn('Data channel not ready for:', peerId, 'state:', channel.readyState);
      }
    }

    // Wait for all sends to complete
    await Promise.allSettled(sendPromises);

    // Update file message status
    this.messages.update(msgs =>
      msgs.map(msg => {
        if (msg.id === fileId && msg.file) {
          return {
            ...msg,
            file: {
              ...msg.file,
              status: 'completed' as const,
              progress: 100,
              url: URL.createObjectURL(file)
            }
          };
        }
        return msg;
      })
    );

    this.addSystemMessage(`You shared: ${file.name}`);
  }

  // Send file to a specific peer via data channel
  private async sendFileToPeer(
    channel: RTCDataChannel,
    fileId: string,
    file: File,
    arrayBuffer: ArrayBuffer,
    totalChunks: number
  ): Promise<void> {
    try {
      // Send file metadata first
      channel.send(JSON.stringify({
        type: 'file-start',
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks,
        senderId: this.localUserId,
        senderName: this.localUserName
      }));

      // Send file in chunks
      await this.sendFileChunks(channel, fileId, arrayBuffer, totalChunks);

      console.log('File sent successfully via data channel');
    } catch (error) {
      console.error('Error sending file via data channel:', error);
    }
  }

  // Send file chunks via data channel
  private async sendFileChunks(
    channel: RTCDataChannel,
    fileId: string,
    arrayBuffer: ArrayBuffer,
    totalChunks: number
  ): Promise<void> {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, arrayBuffer.byteLength);
      const chunk = arrayBuffer.slice(start, end);

      // Wait for buffer to be available
      while (channel.bufferedAmount > 65535) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (channel.readyState === 'open') {
        channel.send(chunk);
      }
    }

    // Send end signal
    channel.send(JSON.stringify({
      type: 'file-end',
      fileId
    }));
  }

  // Handle incoming file start
  private handleFileStart(peerId: string, data: any): void {
    const transfer: FileTransfer = {
      id: data.fileId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      senderId: data.senderId,
      senderName: data.senderName,
      chunks: [],
      receivedSize: 0,
      totalChunks: data.totalChunks,
      status: 'transferring'
    };

    this.fileTransfers.set(data.fileId, transfer);

    // Add pending file message
    const fileMessage: ChatMessage = {
      id: data.fileId,
      sender: data.senderName,
      senderId: data.senderId,
      text: `Sent file: ${data.fileName}`,
      timestamp: new Date(),
      type: 'file',
      file: {
        name: data.fileName,
        size: data.fileSize,
        type: data.fileType,
        progress: 0,
        status: 'transferring'
      }
    };

    this.messages.update(msgs => [...msgs, fileMessage]);
  }

  // Handle incoming file chunk
  private handleFileChunk(peerId: string, chunk: ArrayBuffer): void {
    // Find the active transfer for this peer
    let activeTransfer: FileTransfer | undefined;

    this.fileTransfers.forEach((transfer) => {
      if (transfer.status !== 'completed') {
        activeTransfer = transfer;
      }
    });

    if (!activeTransfer) {
      console.warn('Received chunk but no active transfer');
      return;
    }

    activeTransfer.chunks.push(chunk);
    activeTransfer.receivedSize += chunk.byteLength;

    // Update progress
    const progress = Math.round((activeTransfer.receivedSize / activeTransfer.fileSize) * 100);

    this.messages.update(msgs =>
      msgs.map(msg => {
        if (msg.id === activeTransfer!.id && msg.file) {
          return {
            ...msg,
            file: {
              ...msg.file,
              progress,
              status: 'transferring' as const
            }
          };
        }
        return msg;
      })
    );
  }

  // Handle file transfer end
  private handleFileEnd(peerId: string, data: any): void {
    const transfer = this.fileTransfers.get(data.fileId);

    if (!transfer) {
      console.warn('File end received but no transfer found');
      return;
    }

    // Combine all chunks
    const blob = new Blob(transfer.chunks, { type: transfer.fileType });
    const url = URL.createObjectURL(blob);

    // Update message with completed status and URL
    this.messages.update(msgs =>
      msgs.map(msg => {
        if (msg.id === transfer.id && msg.file) {
          return {
            ...msg,
            file: {
              ...msg.file,
              url,
              progress: 100,
              status: 'completed' as const
            }
          };
        }
        return msg;
      })
    );

    // Cleanup transfer
    this.fileTransfers.delete(data.fileId);

    console.log(`File transfer completed: ${transfer.fileName}`);
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get file icon based on type
  getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📑';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) return '📦';
    if (fileType.includes('text')) return '📃';
    return '📎';
  }

  // ==================== END FILE TRANSFER ====================

  // ==================== TYPING INDICATOR ====================

  // Called when user starts typing
  startTyping(): void {
    if (!this.socket?.connected || !this.roomId()) return;

    // Only emit if not already typing
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.socket.emit('typing', {
        roomId: this.roomId(),
        isTyping: true
      });
    }

    // Reset the timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Stop typing after 2 seconds of no activity
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  // Called when user stops typing
  stopTyping(): void {
    if (!this.socket?.connected || !this.roomId()) return;

    if (this.isCurrentlyTyping) {
      this.isCurrentlyTyping = false;
      this.socket.emit('typing', {
        roomId: this.roomId(),
        isTyping: false
      });
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  // Handle remote user typing
  private handleRemoteTyping(userId: string, userName: string, isTyping: boolean): void {
    // Clear existing timeout for this user
    const existingTimeout = this.typingTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    if (isTyping) {
      // Add user to typing list
      this.typingUsers.update(users => {
        const newUsers = new Map(users);
        newUsers.set(userId, userName);
        return newUsers;
      });

      // Auto-remove after 3 seconds if no update
      const timeout = setTimeout(() => {
        this.typingUsers.update(users => {
          const newUsers = new Map(users);
          newUsers.delete(userId);
          return newUsers;
        });
        this.typingTimeouts.delete(userId);
      }, 3000);

      this.typingTimeouts.set(userId, timeout);
    } else {
      // Remove user from typing list
      this.typingUsers.update(users => {
        const newUsers = new Map(users);
        newUsers.delete(userId);
        return newUsers;
      });
      this.typingTimeouts.delete(userId);
    }
  }

  // Get typing users as array
  getTypingUsersArray(): string[] {
    return Array.from(this.typingUsers().values());
  }

  // ==================== END TYPING INDICATOR ====================

  // Update participants list
  private updateParticipantsList(): void {
    const participantsList: Participant[] = [];

    this.remoteStreams().forEach((stream, oderId) => {
      const name = this.participantNames.get(oderId) || 'Unknown';
      participantsList.push({
        id: oderId,
        name,
        stream,
        videoEnabled: true,
        audioEnabled: true
      });
    });

    // Also add participants without streams yet
    this.participantNames.forEach((name, oderId) => {
      if (!participantsList.find(p => p.id === oderId)) {
        participantsList.push({
          id: oderId,
          name,
          videoEnabled: true,
          audioEnabled: true
        });
      }
    });

    this.participants.set(participantsList);
  }

  // Get participant name by ID
  getParticipantName(oderId: string): string {
    return this.participantNames.get(oderId) || 'Participant';
  }

  // Check if participant's video is enabled
  isParticipantVideoEnabled(oderId: string): boolean {
    const state = this.participantMediaStates.get(oderId);
    return state?.videoEnabled ?? true; // Default to true if unknown
  }

  // Check if participant's audio is enabled
  isParticipantAudioEnabled(oderId: string): boolean {
    const state = this.participantMediaStates.get(oderId);
    return state?.audioEnabled ?? true; // Default to true if unknown
  }

  // ==================== LIVE CAPTIONS (CC) ====================

  // Check if browser supports speech recognition
  isSpeechRecognitionSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  // Start live captions
  startCaptions(language: string = 'vi-VN'): boolean {
    if (!this.isSpeechRecognitionSupported()) {
      this.addSystemMessage('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return false;
    }

    if (this.isRecognitionActive) {
      return true;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.speechRecognition = new SpeechRecognition();

      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = language;
      this.speechRecognition.maxAlternatives = 1;

      this.speechRecognition.onstart = () => {
        console.log('Speech recognition started');
        this.isRecognitionActive = true;
        this.isCaptionsEnabled.set(true);
      };

      this.speechRecognition.onresult = (event: any) => {
        this.handleSpeechResult(event);
      };

      this.speechRecognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // No speech detected, restart
          this.restartRecognition();
        } else if (event.error === 'aborted') {
          // Aborted usually means mic was disabled, wait for it to be enabled again
          console.log('Speech recognition aborted (likely mic disabled)');
          this.isRecognitionActive = false;
          // Don't stop captions, just wait for audio to be enabled again
          // The toggleAudio handler will restart it
        } else if (event.error === 'audio-capture') {
          // Only stop if audio is actually disabled
          if (!this.isAudioEnabled()) {
            console.log('Audio capture error - mic disabled, will restart when enabled');
            this.isRecognitionActive = false;
          } else {
            this.addSystemMessage('Microphone not available for captions.');
            this.stopCaptions();
          }
        } else if (event.error === 'not-allowed') {
          this.addSystemMessage('Microphone permission denied for captions.');
          this.stopCaptions();
        } else {
          // For other errors, try to restart if captions are still enabled
          if (this.isCaptionsEnabled() && this.isAudioEnabled()) {
            console.log('Attempting to restart recognition after error:', event.error);
            setTimeout(() => {
              this.restartCaptionsIfNeeded();
            }, 1000);
          }
        }
      };

      this.speechRecognition.onend = () => {
        console.log('Speech recognition ended');
        // Auto-restart if still enabled and audio is available
        if (this.isCaptionsEnabled() && this.isRecognitionActive && this.isAudioEnabled()) {
          this.restartRecognition();
        } else if (this.isCaptionsEnabled() && !this.isAudioEnabled()) {
          // Audio disabled, mark as inactive but keep captions enabled
          this.isRecognitionActive = false;
          console.log('Speech recognition paused - audio disabled');
        }
      };

      this.speechRecognition.start();
      this.addSystemMessage('Live captions enabled');
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.addSystemMessage('Failed to start live captions.');
      return false;
    }
  }

  // Stop live captions
  stopCaptions(): void {
    this.isRecognitionActive = false;
    this.isCaptionsEnabled.set(false);

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      this.speechRecognition = null;
    }

    // Clear current caption after a delay
    setTimeout(() => {
      this.currentCaption.set(null);
    }, 2000);

    this.addSystemMessage('Live captions disabled');
  }

  // Restart recognition (for continuous listening)
  private restartRecognition(): void {
    if (this.isCaptionsEnabled() && this.speechRecognition && this.isAudioEnabled()) {
      try {
        setTimeout(() => {
          if (this.isCaptionsEnabled() && this.isAudioEnabled()) {
            this.speechRecognition.start();
          }
        }, 100);
      } catch (e) {
        console.error('Error restarting recognition:', e);
      }
    }
  }

  // Restart captions if needed (when audio is re-enabled)
  private restartCaptionsIfNeeded(): void {
    if (this.isCaptionsEnabled() && this.isAudioEnabled() && !this.isRecognitionActive) {
      console.log('Restarting captions after audio re-enabled');
      // Get current language from the recognition instance or use default
      const language = this.speechRecognition?.lang || 'vi-VN';

      // Stop and restart fresh
      if (this.speechRecognition) {
        try {
          this.speechRecognition.stop();
        } catch (e) {
          // Ignore errors
        }
        this.speechRecognition = null;
      }

      // Start fresh
      setTimeout(() => {
        this.startCaptions(language);
      }, 300);
    }
  }

  // Handle speech recognition results
  private handleSpeechResult(event: any): void {
    const results = event.results;
    const latestResult = results[results.length - 1];
    const transcript = latestResult[0].transcript.trim();
    const isFinal = latestResult.isFinal;

    if (!transcript) return;

    const caption: Caption = {
      id: this.generateUserId(),
      speakerId: this.localUserId,
      speakerName: this.localUserName,
      text: transcript,
      timestamp: new Date(),
      isFinal
    };

    // Update current caption (for display)
    this.currentCaption.set(caption);

    // Broadcast ALL captions (both interim and final) for real-time display
    this.broadcastCaption(caption);

    // If final, add to captions history
    if (isFinal) {
      this.captions.update(caps => {
        const newCaps = [...caps, caption];
        // Keep only last 50 captions
        return newCaps.slice(-50);
      });
    }
  }

  // Broadcast caption to other participants
  private broadcastCaption(caption: Caption): void {
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('caption', {
        roomId: this.roomId(),
        caption
      });
    }
  }

  // Handle caption received from remote participant
  private handleRemoteCaption(caption: Caption): void {
    // Get speaker name from our records if available
    const speakerName = this.participantNames.get(caption.speakerId) || caption.speakerName;

    const remoteCaption: Caption = {
      ...caption,
      speakerName,
      timestamp: new Date(caption.timestamp)
    };

    // Update current caption for display (both interim and final)
    this.currentCaption.set(remoteCaption);

    // If final, add to captions history
    if (remoteCaption.isFinal) {
      this.captions.update(caps => {
        const newCaps = [...caps, remoteCaption];
        // Keep only last 50 captions
        return newCaps.slice(-50);
      });
    }
  }

  // Toggle captions on/off
  toggleCaptions(language: string = 'vi-VN'): void {
    if (this.isCaptionsEnabled()) {
      this.stopCaptions();
    } else {
      this.startCaptions(language);
    }
  }

  // ==================== END LIVE CAPTIONS ====================

  // Reconnect to a peer when connection fails
  private async reconnectPeer(peerId: string): Promise<void> {
    console.log('Attempting to reconnect to peer:', peerId);
    
    const participantName = this.participantNames.get(peerId);
    if (!participantName) {
      console.warn('Cannot reconnect - participant name not found for:', peerId);
      return;
    }
    
    // Close old connection
    const oldPc = this.peerConnections.get(peerId);
    if (oldPc) {
      try {
        oldPc.close();
      } catch (e) {
        // Ignore errors when closing
      }
      this.peerConnections.delete(peerId);
    }
    
    // Clear related data
    this.dataChannels.delete(peerId);
    this.pendingCandidates.delete(peerId);
    this.peerStreamIds.delete(peerId);
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if we're still in the room
    if (!this.roomId() || !this.socket?.connected) {
      console.log('Not in room anymore, skipping reconnect');
      return;
    }
    
    // Create new peer connection
    try {
      await this.createPeerConnection(peerId, true);
      console.log('Reconnected to peer:', peerId);
      this.addSystemMessage(`Reconnected to ${participantName}`);
    } catch (error) {
      console.error('Error reconnecting to peer:', error);
      this.addSystemMessage(`Failed to reconnect to ${participantName}`);
    }
  }

  // Handle peer disconnection
  private handlePeerDisconnect(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {
        // Ignore errors when closing
      }
      this.peerConnections.delete(peerId);
    }

    this.dataChannels.delete(peerId);
    this.pendingCandidates.delete(peerId);
    this.participantMediaStates.delete(peerId);
    this.peerStreamIds.delete(peerId);
    this.remoteAnalysers.delete(peerId);

    this.remoteStreams.update(streams => {
      const newStreams = new Map(streams);
      newStreams.delete(peerId);
      return newStreams;
    });

    // Remove screen share from this peer
    this.remoteScreenShares.update(shares => {
      const newShares = new Map(shares);
      newShares.delete(peerId);
      return newShares;
    });

    // Update participants list
    this.updateParticipantsList();
  }

  // Leave room and cleanup
  leaveRoom(): void {
    // Notify server
    if (this.socket?.connected) {
      this.socket.emit('leave-room');
    }

    // Close all peer connections
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.pendingCandidates.clear();
    this.peerStreamIds.clear();

    // Stop local stream
    const localStream = this.localStream();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    this.localStream.set(null);

    // Stop screen share
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Clear remote streams
    this.remoteStreams.set(new Map());

    // Clear screen share state
    this.localScreenStream.set(null);
    this.remoteScreenShares.set(new Map());
    this.screenSharerName.set(null);

    // Stop captions
    this.stopCaptions();

    // Reset state
    this.connectionStatus.set('disconnected');
    this.roomId.set('');
    this.messages.set([]);
    this.isScreenSharing.set(false);
    this.participants.set([]);
    this.participantNames.clear();
    this.participantMediaStates.clear();
    this.receivedMessageIds.clear();
    this.captions.set([]);
    this.currentCaption.set(null);
  }

  // Cleanup on service destroy
  cleanup(): void {
    this.leaveRoom();

    // Stop voice activity monitoring
    if (this.voiceActivityInterval) {
      clearInterval(this.voiceActivityInterval);
      this.voiceActivityInterval = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.localAnalyser = null;
    this.remoteAnalysers.clear();

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
