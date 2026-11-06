import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Volume2, X, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../../types/index.ts';
import { sounds } from '../../services/soundEffects.ts';

interface ChatPanelProps {
  chat: ChatMessage[];
  currentParticipantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

const EMOJIS = ['🔥', '❤️', '😂', '🎉', '🍿', '🚀', '👏', '💀'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  chat,
  currentParticipantId,
  isOpen,
  onClose,
  onSendMessage,
  onSendReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleEmojiClick = (emoji: string) => {
    onSendReaction(emoji);
    sounds.playReactionSound();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 bg-[#0d0f19] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Lounge Chat & Reactions
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat panel"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Floating Reaction Bar */}
      <div className="p-2 border-b border-white/5 bg-white/[0.01] flex items-center justify-between gap-1 overflow-x-auto">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            aria-label={`Send ${emoji} reaction`}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base transition-transform hover:scale-125 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {chat.map((msg) => {
          const isMe = msg.senderId === currentParticipantId;

          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="p-2 rounded-xl bg-white/5 border border-white/5 text-center text-[11px] text-slate-300 font-medium"
              >
                <span>{msg.text}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-xs">{msg.senderAvatar}</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                  isMe
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-xs'
                    : 'bg-[#181b2c] border border-white/5 text-slate-200 rounded-bl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-[#0b0d16] flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message room..."
          className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
