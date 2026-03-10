import { useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hi! How can I help you with EV charging today?", sender: "bot" }
  ]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    const newMessage: Message = { id: Date.now(), text: message, sender: "user" };
    setMessages([...messages, newMessage]);
    setMessage("");
    
    // Simple bot response
    setTimeout(() => {
      const botResponse: Message = { 
        id: Date.now() + 1, 
        text: "Thanks for your message! I'm here to help with charging stations and bookings.", 
        sender: "bot" 
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="
          fixed
          bottom-24
          right-5
          z-[9999]
          flex
          items-center
          justify-center
          w-14
          h-14
          rounded-full
          bg-green-500
          text-white
          shadow-lg
          hover:scale-110
          transition-transform
          duration-200
          focus:outline-none
          focus:ring-4
          focus:ring-green-300
        "
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="
              fixed
              bottom-24
              right-4
              w-[340px]
              h-[440px]
              bg-white
              rounded-xl
              shadow-2xl
              z-[9999]
              flex
              flex-col
              border
              border-gray-200
              overflow-hidden
              md:w-[360px]
              md:h-[480px]
            "
          >
            {/* Header */}
            <div className="bg-green-500 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={20} />
                  <h3 className="font-semibold">EV Assistant</h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-green-600 rounded-full p-1 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-green-100 text-xs mt-1">Online • Ask me about charging stations</p>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[75%] 
                      p-3 
                      rounded-lg 
                      text-sm
                      ${msg.sender === 'user' 
                        ? 'bg-green-500 text-white rounded-br-sm' 
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }
                    `}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="
                    flex-1 
                    px-3 
                    py-2 
                    border 
                    border-gray-300 
                    rounded-lg 
                    focus:outline-none 
                    focus:ring-2 
                    focus:ring-green-500 
                    focus:border-transparent
                    text-sm
                  "
                />
                <button
                  onClick={handleSendMessage}
                  className="
                    bg-green-500 
                    text-white 
                    p-2 
                    rounded-lg 
                    hover:bg-green-600 
                    transition-colors
                    focus:outline-none
                    focus:ring-2
                    focus:ring-green-500
                  "
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}