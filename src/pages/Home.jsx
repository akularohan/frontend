import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()
  const [showTips, setShowTips] = useState(false)

  return (
    <div className="app">
      <button className="tips-btn" onClick={() => setShowTips(true)}>
        💡 Tips
      </button>

      {showTips && (
        <div className="modal-overlay" onClick={() => setShowTips(false)}>
          <div className="tips-modal" onClick={(e) => e.stopPropagation()}>
            <h3>💡 Quick Tip</h3>
            <p className="tips-title">Send info between devices easily!</p>
            <div className="tips-content">
              <p>Want to send a link from an unknown computer to your device without logging into Gmail or WhatsApp?</p>
              <ul>
                <li>Create a room on the unknown computer</li>
                <li>Paste your link or text in the chat</li>
                <li>Leave the room (or keep it open)</li>
                <li>Join the same room from your device</li>
                <li>Access your link instantly - Voilà!</li>
              </ul>
              <p className="tips-note">Perfect for quick file transfers, links, or notes between your devices!</p>
            </div>
            <button className="btn" onClick={() => setShowTips(false)}>Got it!</button>
          </div>
        </div>
      )}

      <div className="container">
        <h1 className="title">ANONYMOUSLY</h1>
        <p className="subtitle">Secure • Private • Ephemeral</p>
        <p className="tagline">Talk to anyone, anonymously.<br />Like it never existed.</p>
        
        <div className="button-group">
          <button 
            className="btn" 
            onClick={() => navigate('/join-room')}
          >
            Join Room
          </button>
          <button 
            className="btn" 
            onClick={() => navigate('/create-room')}
          >
            Create Room
          </button>
        </div>
      </div>

      <footer className="footer">
        Made with ❤️ by Rohan Akula
      </footer>
    </div>
  )
}

export default Home