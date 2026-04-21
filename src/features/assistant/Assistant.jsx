import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/api/supabase';
import { useUiContext } from '../ui/UiContext';
import { useChatMessages } from './useChatMessages';
import { usePaginatedTransactions } from '../transactions/useTransactions';
import { useAuth } from '../auth/AuthContext';
import { useTaxonomy } from '../taxonomy/useTaxonomy';
import { buildApiUrl } from '../../shared/api/apiUrl';

import { MessageSquare, Send, Trash2, Mic, MicOff } from 'lucide-react';
import { filterAssistantTransactions, buildAssistantResponse } from './assistantService.js';

const Assistant = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { language, selectedMonth, selectedYear } = useUiContext();
  const { chatMessages, addChatMessage, clearChat } = useChatMessages(currentUser?.id);
  const { data: txPages } = usePaginatedTransactions(currentUser?.id, {
    month: selectedMonth,
    year: selectedYear,
    pageSize: 500,
  });
  const transactions = txPages?.pages?.flat() ?? [];
  const { taxonomy } = useTaxonomy(currentUser?.id);
  const { session } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Poll for background job completion and refetch chat messages
  useEffect(() => {
    let interval;
    if (activeJobId) {
      interval = setInterval(async () => {
        try {
          // Refetch chat messages periodically to show user transcript as soon as it appears
          queryClient.invalidateQueries({ queryKey: ['chatMessages', currentUser?.id] });

          const { data, error } = await supabase
            .from('jobs')
            .select('status, error')
            .eq('id', activeJobId)
            .single();

          if (error) throw error;

          if (data.status === 'completed' || data.status === 'failed') {
            setActiveJobId(null);
            setIsTyping(false);
            // Final invalidation to ensure everything is up to date
            queryClient.invalidateQueries({ queryKey: ['chatMessages', currentUser?.id] });
            if (data.status === 'failed') {
              alert(
                language === 'ru'
                  ? `Ошибка обработки: ${data.error}`
                  : `Processing error: ${data.error}`
              );
            }
          }
        } catch (err) {
          console.error('Job polling failed:', err);
          setActiveJobId(null);
          setIsTyping(false);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [activeJobId, currentUser?.id, queryClient, language]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = { type: 'user', text: inputText };
    addChatMessage(userMsg);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const lowerText = currentInput.toLowerCase();

      const { filtered, effectivePeriod, matchedCat } = filterAssistantTransactions({
        transactions,
        lowerText,
        language,
        taxonomy,
      });

      const responseText = buildAssistantResponse({
        filtered,
        effectivePeriod,
        matchedCat,
        lowerText,
        language,
      });

      addChatMessage({ type: 'bot', text: responseText });
      setIsTyping(false);
    }, 1000);
  };

  // Deepgram-powered voice recognition
  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert(
        language === 'ru'
          ? 'Голосовой ввод не поддерживается на этом устройстве'
          : 'Voice input is not supported on this device'
      );
      setIsListening(false);
      return;
    }

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recognitionRef.current = mediaRecorder;
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

        const originalText = inputText;
        setInputText('🤖 ' + (language === 'ru' ? 'Распознавание...' : 'Transcribing...'));
        setIsListening(false);

        try {
          const base64Audio = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
          });

          const accessToken = session?.access_token;
          const res = await fetch(buildApiUrl('/api/speech'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              audioBase64: base64Audio,
              language,
              mimeType: mediaRecorder.mimeType,
              selectedMonth,
              selectedYear,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'API Error');
          }

          const data = await res.json();
          if (data.jobId) {
            setActiveJobId(data.jobId);
            setIsTyping(true);
            setInputText('');
          } else if (data.text) {
            setInputText(data.text);
          } else {
            setInputText(originalText);
            alert(
              language === 'ru'
                ? 'Речь не распознана. Пожалуйста, говорите четче.'
                : 'Speech not recognized. Please speak more clearly.'
            );
          }
        } catch (err) {
          console.error(err);
          setInputText(originalText);
          alert(language === 'ru' ? `Ошибка: ${err.message}` : `Error: ${err.message}`);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
      alert(language === 'ru' ? 'Нет доступа к микрофону' : 'Microphone access denied');
      setIsListening(false);
    }
  };

  return (
    <div
      className="container"
      style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1.25rem',
            fontWeight: '800',
          }}
        >
          <MessageSquare className="text-primary" />
          {language === 'ru' ? 'Ассистент' : 'Assistant'}
        </h2>
        <button onClick={clearChat} className="text-danger" style={{ background: 'none' }}>
          <Trash2 size={20} />
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '0 4px',
        }}
      >
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: '16px',
              background: msg.type === 'user' ? 'var(--primary)' : 'var(--surface)',
              color: msg.type === 'user' ? 'white' : 'var(--text)',
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'pre-wrap',
              fontSize: '0.925rem',
              lineHeight: '1.5',
            }}
          >
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: 'var(--surface)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', position: 'relative' }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={language === 'ru' ? 'Спросите что-нибудь...' : 'Ask something...'}
          style={{
            flex: 1,
            padding: '14px 44px 14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        <button
          type="button"
          onClick={startVoice}
          style={{
            position: 'absolute',
            right: '56px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isListening ? 'var(--danger)' : 'var(--text-muted)',
            background: 'none',
          }}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          type="submit"
          disabled={!inputText.trim()}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: inputText.trim() ? 1 : 0.6,
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default Assistant;
