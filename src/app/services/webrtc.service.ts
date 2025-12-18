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
  type: 'text' | 'system';
}

export interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  connection?: RTCPeerConnection;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
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
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  };
  
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private localUserId = '';
  private localUserName = '';
  private screenStream: MediaStream | null = null;
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  
  constructor() {
    this.localUserName = `User_${this.generateUserId().slice(0, 4)}`;
  }
  
  ngOnDestroy(): void {
    this.cleanup();
  }
  
  private generateUserId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
  
  getLocalUserId(): string {
    return this.localUserId;
  }
  
  getLocalUserName(): string {
    return this.localUserName;
  }
  
  setLocalUserName(name: string): void {
    this.localUserName = name || `User_${this.generateUserId().slice(0, 4)}`;
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
      
      // Create peer connections for existing participants
      for (const participant of participants) {
        await this.createPeerConnection(participant.id, true);
      }
    });
    
    // New user joined
    this.socket.on('user-joined', async ({ userId, userName }) => {
      console.log('User joined:', userName, userId);
      this.addSystemMessage(`${userName} joined the room`);
      
      // Create peer connection and send offer
      await this.createPeerConnection(userId, false);
    });
    
    // User left
    this.socket.on('user-left', ({ userId, userName }) => {
      console.log('User left:', userName, userId);
      this.addSystemMessage(`${userName} left the room`);
      this.handlePeerDisconnect(userId);
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
      if (message.senderId !== this.localUserId) {
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
      const participant = this.participants().find(p => p.id === userId);
      if (participant) {
        participant.videoEnabled = video;
        participant.audioEnabled = audio;
        this.participants.set([...this.participants()]);
      }
    });
  }
  
  // Initialize local media stream
  async initLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });
      
      this.localStream.set(stream);
      this.isVideoEnabled.set(video);
      this.isAudioEnabled.set(audio);
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      this.addSystemMessage('Failed to access camera/microphone. Please check permissions.');
      return null;
    }
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
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioEnabled.set(audioTrack.enabled);
        
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
      
      // Replace video track in all peer connections
      const videoTrack = this.screenStream.getVideoTracks()[0];
      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      this.isScreenSharing.set(true);
      this.notifyMediaStateChange();
      
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
  
  // Stop screen sharing
  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    // Restore camera video track
    const localStream = this.localStream();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.peerConnections.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
    }
    
    this.isScreenSharing.set(false);
    this.notifyMediaStateChange();
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
    
    // Add local stream tracks
    const localStream = this.localStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from:', peerId);
      const remoteStream = event.streams[0];
      this.remoteStreams.update(streams => {
        const newStreams = new Map(streams);
        newStreams.set(peerId, remoteStream);
        return newStreams;
      });
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket?.connected) {
        console.log('Sending ICE candidate to:', peerId);
        this.socket.emit('ice-candidate', {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state with', peerId, ':', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.handlePeerDisconnect(peerId);
      }
    };
    
    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state with', peerId, ':', pc.iceConnectionState);
    };
    
    // Create data channel for messaging
    if (createOffer) {
      const dataChannel = pc.createDataChannel('chat', {
        ordered: true
      });
      this.setupDataChannel(dataChannel, peerId);
    }
    
    // Handle incoming data channels
    pc.ondatachannel = (event) => {
      console.log('Received data channel from:', peerId);
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
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
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
      return;
    }
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
  
  // Setup data channel for messaging
  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.onopen = () => {
      console.log('Data channel opened with:', peerId);
      this.dataChannels.set(peerId, channel);
    };
    
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        message.timestamp = new Date(message.timestamp);
        this.messages.update(msgs => [...msgs, message]);
        this.messageSubject.next(message);
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
    
    // Send via signaling server (for reliability)
    if (this.socket?.connected && this.roomId()) {
      this.socket.emit('chat-message', {
        roomId: this.roomId(),
        message: text.trim()
      });
    }
    
    // Also send via data channels (for low latency when connected)
    this.dataChannels.forEach(channel => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    });
    
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
  
  // Handle peer disconnection
  private handlePeerDisconnect(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    
    this.dataChannels.delete(peerId);
    this.pendingCandidates.delete(peerId);
    
    this.remoteStreams.update(streams => {
      const newStreams = new Map(streams);
      newStreams.delete(peerId);
      return newStreams;
    });
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
    
    // Reset state
    this.connectionStatus.set('disconnected');
    this.roomId.set('');
    this.messages.set([]);
    this.isScreenSharing.set(false);
    this.participants.set([]);
  }
  
  // Cleanup on service destroy
  cleanup(): void {
    this.leaveRoom();
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
