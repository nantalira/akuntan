import { Bot, CheckCircle2, Mic, MicOff, Send, Sparkles, User, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isSuccess?: boolean;
}

interface ChatDrawerProps {
  onTransactionAdded: () => void;
}

const QUICK_SUGGESTIONS = [
  'Makan soto 15k',
  'Bensin 30rb motor',
  'Nalangi Dian 20rb',
  'Patungan listrik 100rb berdua sama Dian, Dian yang bayar',
  'Kemarin malam beli pulsa 25rb primer',
  'Bayar hutang Dian 61rb'
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ onTransactionAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isListening, isSupported, toggleListening } = useSpeechRecognition({
    onTranscriptChange: (text) => {
      setInput(text);
    }
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Halo! Saya Akuntan AI. Ketik pengeluaranmu dalam bahasa santai, misalnya: "Makan soto 15k" atau "Nalangi Dian 20rb".'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, scrollToBottom]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.api.chat.$post({
        json: { message: text }
      });
      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: data.reply,
            isSuccess: data.recorded
          }
        ]);
        if (data.recorded) {
          onTransactionAdded();
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: data.error || 'Maaf, gagal memproses catatan.'
          }
        ]);
      }
    } catch (_err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'Terjadi kendala koneksi ke server.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-full shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-105 active:scale-95 transition-all z-40 flex items-center gap-2 group"
          title="Buka Chat AI"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="font-semibold text-sm pr-1">Catat Cepat</span>
        </button>
      )}

      {/* Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Akuntan AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[11px] text-slate-400">Siap mencatat</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80 shadow-sm'
                    }`}
                  >
                    {m.isSuccess && (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-semibold mb-1 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Transaksi Masuk D1</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 items-center text-xs text-slate-400 pl-9">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-200" />
                  <span>Sedang memproses...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Chips Carousel */}
            <div className="p-3 border-t border-slate-100 bg-white overflow-x-auto no-scrollbar flex gap-2">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="whitespace-nowrap text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Mendengarkan suara...' : "Ketik: 'Makan ayam 18k'..."}
                className={`flex-1 bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  isListening
                    ? 'border-rose-400 focus:ring-rose-200 ring-2 ring-rose-100'
                    : 'border-slate-200 focus:ring-emerald-300'
                }`}
                disabled={isLoading}
              />

              {isSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Berhenti mendengarkan' : 'Bicara (Input Suara)'}
                  className={`p-2.5 rounded-xl transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md shadow-emerald-200"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
