const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Get allowed origins from environment or allow all
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  }
  // Default: allow all origins for easy setup
  return true;
};

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Enable CORS for Express
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true
}));

app.use(express.json());

// Store active rooms and participants
const rooms = new Map();
const users = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WebRTC Signaling Server is running',
    version: '1.0.0',
    activeRooms: rooms.size,
    activeUsers: users.size
  });
});

// API to get room info
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId,
    participantCount: room.participants.size,
    createdAt: room.createdAt
  });
});

// API to create a room
app.post('/api/rooms', (req, res) => {
  const roomId = generateRoomId();
  
  rooms.set(roomId, {
    id: roomId,
    participants: new Map(),
    createdAt: new Date().toISOString()
  });
  
  res.json({ roomId });
});

// Generate a human-readable room ID
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`);
  
  // Store user info
  users.set(socket.id, {
    id: socket.id,
    roomId: null,
    userName: null,
    joinedAt: new Date().toISOString()
  });

  // Join room
  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`[${new Date().toISOString()}] ${userName} (${socket.id}) joining room: ${roomId}`);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        createdAt: new Date().toISOString()
      });
    }
    
    const room = rooms.get(roomId);
    
    // Add participant to room
    room.participants.set(socket.id, {
      id: socket.id,
      userName,
      joinedAt: new Date().toISOString()
    });
    
    // Update user info
    const user = users.get(socket.id);
    if (user) {
      user.roomId = roomId;
      user.userName = userName;
    }
    
    // Join socket room
    socket.join(roomId);
    
    // Get existing participants (excluding the new user)
    const existingParticipants = [];
    room.participants.forEach((participant, id) => {
      if (id !== socket.id) {
        existingParticipants.push({
          id: participant.id,
          userName: participant.userName
        });
      }
    });
    
    // Notify the new user about existing participants
    socket.emit('room-joined', {
      roomId,
      participants: existingParticipants,
      userId: socket.id
    });
    
    // Notify existing participants about the new user
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName
    });
    
    console.log(`[${new Date().toISOString()}] Room ${roomId} now has ${room.participants.size} participants`);
  });

  // Handle WebRTC signaling: Offer
  socket.on('offer', ({ targetId, offer }) => {
    console.log(`[${new Date().toISOString()}] Offer from ${socket.id} to ${targetId}`);
    
    io.to(targetId).emit('offer', {
      senderId: socket.id,
      senderName: users.get(socket.id)?.userName || 'Unknown',
      offer
    });
  });

  // Handle WebRTC signaling: Answer
  socket.on('answer', ({ targetId, answer }) => {
    console.log(`[${new Date().toISOString()}] Answer from ${socket.id} to ${targetId}`);
    
    io.to(targetId).emit('answer', {
      senderId: socket.id,
      answer
    });
  });

  // Handle WebRTC signaling: ICE Candidate
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    console.log(`[${new Date().toISOString()}] ICE candidate from ${socket.id} to ${targetId}`);
    
    io.to(targetId).emit('ice-candidate', {
      senderId: socket.id,
      candidate
    });
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, message }) => {
    const user = users.get(socket.id);
    
    if (!user || user.roomId !== roomId) {
      return;
    }
    
    const chatMessage = {
      id: uuidv4(),
      sender: user.userName,
      senderId: socket.id,
      text: message,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    
    // Broadcast to all users in the room (including sender)
    io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`[${new Date().toISOString()}] Chat message in room ${roomId} from ${user.userName}`);
  });

  // Handle user leaving room
  socket.on('leave-room', () => {
    handleUserLeave(socket);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] User disconnected: ${socket.id}`);
    handleUserLeave(socket);
    users.delete(socket.id);
  });

  // Toggle media state (for UI sync)
  socket.on('media-state-change', ({ roomId, video, audio, screenShare }) => {
    socket.to(roomId).emit('media-state-change', {
      userId: socket.id,
      video,
      audio,
      screenShare
    });
  });

  // Handle live captions
  socket.on('caption', ({ roomId, caption }) => {
    const user = users.get(socket.id);
    
    if (!user || user.roomId !== roomId) {
      return;
    }
    
    // Broadcast caption to all other users in the room
    socket.to(roomId).emit('caption', {
      ...caption,
      speakerId: socket.id,
      speakerName: user.userName
    });
    
    console.log(`[${new Date().toISOString()}] Caption in room ${roomId} from ${user.userName}: "${caption.text.substring(0, 50)}..."`);
  });

  // Handle screen share start
  socket.on('screen-share-start', ({ roomId }) => {
    const user = users.get(socket.id);
    
    if (!user || user.roomId !== roomId) {
      return;
    }
    
    // Notify all other users in the room
    socket.to(roomId).emit('screen-share-start', {
      userId: socket.id,
      userName: user.userName
    });
    
    console.log(`[${new Date().toISOString()}] Screen share started by ${user.userName} in room ${roomId}`);
  });

  // Handle screen share stop
  socket.on('screen-share-stop', ({ roomId }) => {
    const user = users.get(socket.id);
    
    if (!user || user.roomId !== roomId) {
      return;
    }
    
    // Notify all other users in the room
    socket.to(roomId).emit('screen-share-stop', {
      userId: socket.id,
      userName: user.userName
    });
    
    console.log(`[${new Date().toISOString()}] Screen share stopped by ${user.userName} in room ${roomId}`);
  });
});

// Helper function to handle user leaving
function handleUserLeave(socket) {
  const user = users.get(socket.id);
  
  if (!user || !user.roomId) {
    return;
  }
  
  const roomId = user.roomId;
  const room = rooms.get(roomId);
  
  if (room) {
    // Remove participant from room
    room.participants.delete(socket.id);
    
    // Leave socket room
    socket.leave(roomId);
    
    // Notify other participants
    socket.to(roomId).emit('user-left', {
      userId: socket.id,
      userName: user.userName
    });
    
    console.log(`[${new Date().toISOString()}] ${user.userName} left room ${roomId}. Remaining: ${room.participants.size}`);
    
    // Clean up empty rooms
    if (room.participants.size === 0) {
      rooms.delete(roomId);
      console.log(`[${new Date().toISOString()}] Room ${roomId} deleted (empty)`);
    }
  }
  
  // Clear user's room info
  user.roomId = null;
}

// Clean up stale rooms periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  rooms.forEach((room, roomId) => {
    const roomAge = now - new Date(room.createdAt).getTime();
    
    if (room.participants.size === 0 && roomAge > maxAge) {
      rooms.delete(roomId);
      console.log(`[${new Date().toISOString()}] Cleaned up stale room: ${roomId}`);
    }
  });
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3007;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 WebRTC Signaling Server                                   ║
║                                                                ║
║   Server running on port ${PORT}                                  ║
║   Health check: http://localhost:${PORT}/                         ║
║                                                                ║
║   Environment:                                                 ║
║   - NODE_ENV: ${process.env.NODE_ENV || 'development'}                               ║
║   - ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || 'localhost'}           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  io.close(() => {
    console.log('Socket.IO server closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});
