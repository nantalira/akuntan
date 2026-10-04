import {
  AlertCircle,
  Bot,
  Camera,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  User,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAiQuota } from '../hooks/useAiQuota';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { ReceiptScannerModal } from './ReceiptScannerModal';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isSuccess?: boolean;
}

interface ChatDrawerProps {
  onTransactionAdded: () => void;
}

interface FrequentItem {
  name: string;
  amount: number;
  category: string;
  frequency: number;
}

const getCategoryEmoji = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'makan':
      return '🍜';
    case 'jajan':
      return '☕';
    case 'primer':
      return '🛒';
    case 'motor':
      return '⛽';
    case 'olga':
      return '🏸';
    case 'belanja':
      return '🛍️';
    default:
      return '💰';
  }
};

const formatAmountShort = (amount: number) => {
  if (amount >= 1000) {
    const inK = amount / 1000;
    return Number.isInteger(inK) ? `${inK}k` : `${inK.toFixed(1)}k`;
  }
  return String(amount);
};

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ onTransactionAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { quota, refetch: refetchQuota } = useAiQuota();
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    try {
      const rawShared =
        localStorage.getItem('akuntan_shared_receipt') ||
        sessionStorage.getItem('akuntan_shared_receipt');
      if (rawShared) {
        localStorage.removeItem('akuntan_shared_receipt');
        sessionStorage.removeItem('akuntan_shared_receipt');
        if (window.location.search.includes('shared_receipt=1')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        const parsed = JSON.parse(rawShared) as {
          imageBase64?: string;
          text?: string;
          title?: string;
        };
        if (parsed.imageBase64) {
          setSharedImage(parsed.imageBase64);
          setIsReceiptModalOpen(true);
        } else if (parsed.text || parsed.title) {
          const combined = [parsed.title, parsed.text].filter(Boolean).join(' - ');
          setIsOpen(true);
          setInput(`QRIS ${combined}`);
        }
      }
    } catch (err) {
      console.error('Failed to process shared receipt:', err);
    }
  }, []);

  const fetchFrequentItems = useCallback(async () => {
    try {
      const res = await api.api.transactions.frequent.$get({
        query: { limit: '15' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setFrequentItems(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch frequent items:', err);
    }
  }, []);

  const triggerCooldown = useCallback(() => {
    setIsCooldown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setIsCooldown(false);
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const {
    isListening,
    isSupported,
    toggleListening,
    error: speechError,
    setError: setSpeechError
  } = useSpeechRecognition({
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-adjust height dynamically: 1 line (~42px) when short, up to 3-4 lines (~115px) when long
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Recalculate height and manage scrollbar display dynamically
    if (input !== undefined) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      if (scrollHeight > 115) {
        textarea.style.height = '115px';
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${Math.max(scrollHeight, 36)}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      refetchQuota();
      fetchFrequentItems();
    }
  }, [isOpen, scrollToBottom, refetchQuota, fetchFrequentItems]);

  const trimmedInput = input.trim().toLowerCase();
  const displayedChips = useMemo(() => {
    if (!trimmedInput) {
      return frequentItems.slice(0, 6);
    }
    return frequentItems
      .filter((item) => item.name.toLowerCase().includes(trimmedInput))
      .slice(0, 6);
  }, [frequentItems, trimmedInput]);

  const handleChipClick = (item: FrequentItem) => {
    const textToFill = `${item.category} ${item.name} ${formatAmountShort(item.amount)}`;
    setInput(textToFill);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading || isCooldown) return;

    triggerCooldown();

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
          fetchFrequentItems();
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
      refetchQuota();
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">Akuntan AI</h3>
                    {quota && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                          quota.status === 'exceeded'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : quota.status === 'warning'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={`Model: ${quota.model} | Terpakai: ${quota.used}/${quota.limit}`}
                      >
                        {quota.status === 'exceeded' ? (
                          <>
                            ⛔ Kuota AI Habis ({quota.used}/{quota.limit})
                          </>
                        ) : (
                          <>
                            ✨ AI: {quota.used}/{quota.limit} ({quota.remaining} sisa)
                          </>
                        )}
                      </span>
                    )}
                  </div>
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

            {/* Smart Hybrid Chips / Autocomplete */}
            {showSuggestions && displayedChips.length > 0 && (
              <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 select-none mr-0.5">
                    {trimmedInput ? 'Saran:' : 'Sering:'}
                  </span>
                  {displayedChips.map((item) => (
                    <button
                      key={`${item.name}-${item.amount}`}
                      type="button"
                      onClick={() => handleChipClick(item)}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-xs bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-full transition-all shrink-0 shadow-xs cursor-pointer group"
                      title={`${item.category} | Sering diinput ${item.frequency}x (Klik untuk mengisi)`}
                    >
                      <span>{getCategoryEmoji(item.category)}</span>
                      <span className="font-medium text-slate-700 group-hover:text-emerald-700">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-slate-400 group-hover:text-emerald-600 font-semibold">
                        {formatAmountShort(item.amount)}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-200/60 transition-colors shrink-0"
                  title="Sembunyikan saran"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tombol Tampilkan Saran (jika sedang disembunyikan) */}
            {!showSuggestions && frequentItems.length > 0 && (
              <div className="px-3 pt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSuggestions(true)}
                  className="text-[10px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-emerald-500" /> Tampilkan saran favorit
                </button>
              </div>
            )}

            {/* Speech Error Banner */}
            {speechError && (
              <div className="mx-3 mt-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between animate-fade-in shadow-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {speechError}
                </span>
                <button
                  type="button"
                  onClick={() => setSpeechError(null)}
                  className="text-rose-400 hover:text-rose-600 p-0.5 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar (Unified Card - Approach 1) */}
            <div className="p-3 bg-white border-t border-slate-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className={`bg-slate-50 border rounded-2xl p-2.5 transition-all flex flex-col focus-within:bg-white focus-within:ring-2 ${
                  isListening
                    ? 'border-rose-400 ring-1 ring-rose-200'
                    : 'border-slate-200 focus-within:ring-emerald-300 focus-within:border-emerald-400'
                }`}
              >
                {/* 100% Full-Width Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isListening
                      ? 'Mendengarkan suara Anda...'
                      : "Ketik pengeluaran (misal: 'Makan ayam 18k')..."
                  }
                  className="w-full bg-transparent border-0 px-1 py-1 text-sm focus:outline-none resize-none leading-relaxed custom-scrollbar placeholder:text-slate-400"
                  style={{ maxHeight: '115px' }}
                  disabled={isLoading}
                />

                {/* Bottom Action Toolbar */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/50">
                  <div className="flex items-center gap-1.5">
                    {isSupported && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCooldown) return;
                          toggleListening();
                        }}
                        disabled={isCooldown}
                        title={
                          isCooldown
                            ? 'Jeda cooldown 1.5 detik...'
                            : isListening
                              ? 'Berhenti mendengarkan'
                              : 'Bicara (Input Suara)'
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          isListening
                            ? 'bg-rose-500 text-white ring-2 ring-rose-300 animate-pulse shadow-sm shadow-rose-200'
                            : isCooldown
                              ? 'bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed opacity-60'
                              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 shadow-xs'
                        }`}
                      >
                        {isListening ? (
                          <MicOff className="w-3.5 h-3.5" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[11px]">{isListening ? 'Merekam...' : 'Bicara'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsReceiptModalOpen(true)}
                      title="Scan Struk Kasir (Foto/Galeri)"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200/80 text-xs font-medium transition-all shadow-xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Scan Struk</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || isCooldown}
                    title={isCooldown ? 'Tunggu jeda 1.5 detik' : 'Kirim Catatan'}
                    className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm shadow-emerald-200"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal OCR Struk Belanjaan */}
      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        initialSharedImage={sharedImage}
        onClearSharedImage={() => setSharedImage(null)}
        onSuccess={() => {
          onTransactionAdded();
          refetchQuota();
          fetchFrequentItems();
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: 'bot',
              text: '✅ Transaksi dari struk / bukti QRIS berhasil dicatat ke database!',
              isSuccess: true
            }
          ]);
        }}
      />
    </>
  );
};
