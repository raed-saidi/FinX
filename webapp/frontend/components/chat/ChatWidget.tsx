'use client';

// components/chat/ChatWidget.tsx - Floating chat widget

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';

export default function ChatWidget() {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { chatOpen, toggleChat, chatMessages, sendChatMessage, clearChat } = useDashboardStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    const msg = message;
    setMessage('');
    await sendChatMessage(msg);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggleChat}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg flex items-center justify-center text-white hover:shadow-xl hover:shadow-emerald-500/20 transition-shadow z-50"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`
              fixed z-50 bg-background border border-border shadow-2xl overflow-hidden
              ${isExpanded 
                ? 'bottom-0 right-0 w-full h-full md:bottom-6 md:right-6 md:w-[500px] md:h-[700px]' 
                : 'bottom-6 right-6 w-[380px] h-[550px]'
              }
            `}
          >
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Aria - AI Advisor</h3>
                  <p className="text-xs text-profit flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-profit rounded-full animate-pulse"></span>
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="w-8 h-8 bg-muted flex items-center justify-center text-muted-foreground hover:text-red-400 transition"
                    title="Clear chat history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-8 h-8 bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleChat}
                  className="w-8 h-8 bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 140px)' }}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">Hi, I'm Aria</h4>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your AI Research & Investment Advisor. I have access to real-time market data and our XGBoost model predictions.
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {[
                      "What's your top pick today?",
                      'Analyze my portfolio',
                      'Market outlook',
                      'How does the AI work?',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => sendChatMessage(suggestion)}
                        className="px-3 py-2 text-sm bg-muted border border-border rounded text-muted-foreground hover:text-foreground hover:border-muted-foreground transition text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {msg.id === 'typing' ? (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                          <div className="bg-muted px-4 py-3 rounded">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${
                              msg.role === 'user'
                                ? 'bg-neutral-800 dark:bg-neutral-200'
                                : 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              <User className="w-4 h-4 text-white dark:text-neutral-900" />
                            ) : (
                              <Bot className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div
                            className={`max-w-[75%] px-4 py-3 ${
                              msg.role === 'user'
                                ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-neutral-400 dark:text-neutral-600' : 'text-muted-foreground'}`}>
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="h-20 px-4 py-3 border-t border-border bg-card">
              <div className="flex items-center gap-3 h-full">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 h-12 px-4 bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-muted-foreground transition"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="w-12 h-12 bg-neutral-800 dark:bg-neutral-200 flex items-center justify-center text-white dark:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
