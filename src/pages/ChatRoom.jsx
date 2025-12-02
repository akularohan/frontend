import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import './ChatRoom.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

function ChatRoom() {
  const { code: roomNameParam } = useParams()
  const roomName = decodeURIComponent(roomNameParam)
  const location = useLocation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [users, setUsers] = useState([])
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const [expireAt, setExpireAt] = useState(null)
  const [showUsers, setShowUsers] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [showImageModal, setShowImageModal] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef(null)
  const wsRef = useRef(null)
  const fileInputRef = useRef(null)
  
  const username = location.state?.username

  useEffect(() => {
    if (!username) {
      navigate('/join-room')
      return
    }

    fetchRoomInfo()
    connectWebSocket()

    // Handle visibility change to prevent disconnection on mobile
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        connectWebSocket()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [roomName, username])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!expireAt) return

    const updateTimer = () => {
      const now = new Date()
      const diff = expireAt - now

      if (diff <= 0) {
        setTimeLeft('Expired')
        setTimeout(() => {
          navigate('/')
        }, 2000)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expireAt, navigate])

  const fetchRoomInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/room/${encodeURIComponent(roomName)}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        if (data.expire_at) {
          const expireDate = new Date(data.expire_at)
          setExpireAt(expireDate)
        }
      } else if (response.status === 410 || response.status === 404) {
        navigate('/')
      }
    } catch (error) {
      console.error('Failed to fetch room info:', error)
    }
  }

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(roomName)}/${username}`)
    
    ws.onopen = () => {
      setConnected(true)
      console.log('Connected to WebSocket')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('WebSocket message received:', data.type, data)
      
      if (data.type === 'history') {
        console.log('Loading history:', data.messages.length, 'messages')
        setMessages(data.messages.map((msg, idx) => ({
          id: `history-${idx}`,
          username: msg.username,
          content: msg.content,
          message_type: msg.message_type || 'text',
          timestamp: msg.timestamp,
          type: 'message',
          reply_to: msg.reply_to
        })))
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          username: data.username,
          content: data.content,
          message_type: data.message_type || 'text',
          timestamp: data.timestamp,
          type: 'message',
          reply_to: data.reply_to
        }])
      } else if (data.type === 'user_joined') {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          content: `${data.username} joined the room`,
          timestamp: data.timestamp,
          type: 'system'
        }])
        fetchRoomInfo()
      } else if (data.type === 'user_left') {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          content: `${data.username} left the room`,
          timestamp: data.timestamp,
          type: 'system'
        }])
        fetchRoomInfo()
      }
    }
    
    ws.onclose = () => {
      setConnected(false)
      console.log('Disconnected from WebSocket')
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnected(false)
    }
    
    wsRef.current = ws
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (newMessage.trim() && wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({
        type: 'text',
        content: newMessage.trim(),
        reply_to: replyTo
      }))
      setNewMessage('')
      setReplyTo(null)
    }
  }

  const handleFileSelect = (file) => {
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      if (wsRef.current && connected) {
        wsRef.current.send(JSON.stringify({
          type: 'image',
          content: event.target.result,
          reply_to: replyTo
        }))
        setReplyTo(null)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    handleFileSelect(file)
    e.target.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const leaveRoom = async () => {
    try {
      await fetch(`${API_BASE}/api/leave-room/${encodeURIComponent(roomName)}/${username}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Failed to leave room:', error)
    } finally {
      if (wsRef.current) {
        wsRef.current.close()
      }
      navigate('/')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  }

  const copyRoomName = () => {
    navigator.clipboard.writeText(roomName)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReply = (message) => {
    setReplyTo({
      username: message.username,
      content: message.content,
      message_type: message.message_type
    })
  }

  const cancelReply = () => {
    setReplyTo(null)
  }

  const openImageModal = (src) => {
    setShowImageModal(src)
  }

  const closeImageModal = () => {
    setShowImageModal(null)
  }

  return (
    <div 
      className="chat-room"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            📎 Drop image here
          </div>
        </div>
      )}

      <div className="chat-header">
        <div className="room-info">
          <h2>{roomName}</h2>
          <button 
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={copyRoomName}
          >
            {copied ? 'Copied!' : 'Copy Name'}
          </button>
        </div>
        <div className="room-actions">
          {timeLeft && (
            <span className="timer">⏱ {timeLeft}</span>
          )}
          <span className="user-count" onClick={() => setShowUsers(true)} style={{cursor: 'pointer'}}>
            {users.length} online
          </span>
          <button className="leave-btn" onClick={leaveRoom}>
            Exit
          </button>
        </div>
      </div>

      {showUsers && (
        <div className="modal-overlay" onClick={() => setShowUsers(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Users in Room</h3>
            <div className="users-list">
              {users.map((user, index) => (
                <div key={index} className="user-item">
                  {user} {user === username && '(you)'}
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => setShowUsers(false)}>Close</button>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content">
            <button className="close-modal-btn" onClick={closeImageModal}>✕</button>
            <img src={showImageModal} alt="Full size" />
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.type} ${message.username === username ? 'own' : ''}`}
            >
              {message.type === 'message' ? (
                <>
                  <div className="message-header">
                    <span className="username">{message.username}</span>
                    <span className="timestamp">{formatTime(message.timestamp)}</span>
                  </div>
                  
                  {message.reply_to && (
                    <div className="reply-preview">
                      <div className="reply-bar"></div>
                      <div className="reply-content">
                        <span className="reply-username">{message.reply_to.username}</span>
                        {message.reply_to.message_type === 'image' ? (
                          <img 
                            src={message.reply_to.content} 
                            alt="Reply preview" 
                            className="reply-image-preview"
                          />
                        ) : (
                          <span className="reply-text">{message.reply_to.content.substring(0, 50)}{message.reply_to.content.length > 50 ? '...' : ''}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {message.message_type === 'image' ? (
                    <img 
                      src={message.content} 
                      alt="Shared image" 
                      className="message-image"
                      onClick={() => openImageModal(message.content)}
                    />
                  ) : (
                    <div className="message-content">{message.content}</div>
                  )}
                  
                  <button 
                    className="reply-btn" 
                    onClick={() => handleReply(message)}
                    title="Reply"
                  >
                    ↩
                  </button>
                </>
              ) : (
                <div className="system-message">{message.content}</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {replyTo && (
          <div className="reply-bar-container">
            <div className="reply-bar-content">
              <span className="reply-label">Replying to {replyTo.username}</span>
              {replyTo.message_type === 'image' ? (
                <img 
                  src={replyTo.content} 
                  alt="Reply preview" 
                  className="reply-image-preview-small"
                />
              ) : (
                <span className="reply-preview-text">
                  {replyTo.content.substring(0, 50)}
                </span>
              )}
            </div>
            <button className="cancel-reply-btn" onClick={cancelReply}>✕</button>
          </div>
        )}

        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={!connected}
            maxLength={500}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
            id="image-upload"
            disabled={!connected}
          />
          <label 
            htmlFor="image-upload" 
            className={`image-btn ${!connected ? 'disabled' : ''}`}
            title="Send image"
          >
            🖼️
          </label>
          <button type="submit" disabled={!connected || !newMessage.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatRoom
