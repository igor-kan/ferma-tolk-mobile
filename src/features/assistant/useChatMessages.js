/**
 * src/hooks/useChatMessages.js
 * ----------------------------
 * FT-016: Shift server state management to TanStack Query.
 *
 * Owns:
 *   - chatMessages[]  loaded via useQuery from Supabase (last 200 messages)
 *
 * Public API:
 *   chatMessages    ChatMessage[]
 *   addChatMessage  (msg) => Promise<void>
 *   clearChat       () => Promise<void>
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/api/supabase';

const WELCOME_MESSAGE = 'Привет! Я ваш финансовый ассистент. Чем могу помочь?';

function dbRowToMsg(r) {
  return {
    id: r.id,
    role: r.role,
    type: r.role, // legacy alias
    content: r.content,
    text: r.content, // legacy alias
  };
}

/**
 * @param {string} userId
 */
export function useChatMessages(userId) {
  const queryClient = useQueryClient();

  // ── Chat Messages Query ───────────────────────────────────────────────────
  const chatQuery = useQuery({
    queryKey: ['chatMessages', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      if (data && data.length > 0) return data.map(dbRowToMsg);

      return [{ id: 1, role: 'bot', type: 'bot', content: WELCOME_MESSAGE, text: WELCOME_MESSAGE }];
    },
    enabled: !!userId,
  });

  const addChatMessageMutation = useMutation({
    mutationFn: async (msg) => {
      const row = {
        user_id: userId,
        role: msg.role || msg.type || 'user',
        content: msg.text || msg.content || '',
      };

      const { data, error } = await supabase.from('chat_messages').insert(row).select().single();

      if (error) {
        // We'll throw so TanStack handles it, but keep legacy fallback behavior
        // by returning a "locally generated" message if we wanted to be fancy.
        // For simplicity, we just throw.
        throw error;
      }
      return dbRowToMsg(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', userId] });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('chat_messages').delete().eq('user_id', userId);

      const welcomeContent = 'Чат очищен. Чем могу помочь?';
      await supabase
        .from('chat_messages')
        .insert({ user_id: userId, role: 'bot', content: welcomeContent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', userId] });
    },
  });

  // ── Public API Wrapper ────────────────────────────────────────────────────

  const addChatMessage = useCallback(
    async (msg) => {
      try {
        await addChatMessageMutation.mutateAsync(msg);
      } catch (err) {
        console.error('addChatMessage:', err);
      }
    },
    [addChatMessageMutation]
  );

  const clearChat = useCallback(async () => {
    try {
      await clearChatMutation.mutateAsync();
    } catch (err) {
      console.error('clearChat:', err);
    }
  }, [clearChatMutation]);

  return {
    chatMessages: chatQuery.data || [],
    addChatMessage,
    clearChat,
  };
}
