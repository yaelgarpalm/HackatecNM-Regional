import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAction, useApi } from '@/components/hooks';
import { colors, MAX_WIDTH } from '@/components/theme';
import { Button, Empty, ErrorView, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { label, timeAgo } from '@/lib/format';
import type { ChatMessage } from '@/lib/types';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  // Polling cada 5 s (el backend soporta after_id para versiones incrementales)
  const q = useApi<ChatMessage[]>(`/challenges/${id}/messages`, undefined, { refetchInterval: 5000 });
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  const send = useAction((body: string) => api.post(`/challenges/${id}/messages`, { body }), {
    invalidate: [[`/challenges/${id}/messages`]],
    onSuccess: () => setText(''),
  });

  useEffect(() => {
    if (q.data?.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [q.data?.length]);

  if (q.isLoading) return <Loading />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: 'Mensajes' }} />
      <View style={s.wrap}>
        {q.error ? <ErrorView error={q.error} /> : (
          <FlatList
            ref={list}
            data={q.data}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={<Empty text="Inicien la conversación: dudas, visitas, acuerdos…" icon="chatbubbles-outline" />}
            renderItem={({ item: m }) => {
              const mine = m.author_id === user.id;
              return (
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {!mine && <Text style={s.author}>{m.author.full_name} · {label(m.author.role)}</Text>}
                  <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>{m.body}</Text>
                  <Text style={[s.time, mine && { color: '#CFE0F0' }]}>{timeAgo(m.created_at)}</Text>
                </View>
              );
            }}
          />
        )}
        <View style={s.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Escribe un mensaje…" placeholderTextColor="#98A2AD"
            style={s.input} multiline onSubmitEditing={() => text.trim() && send.mutate(text.trim())} />
          <Button title="Enviar" icon="send" disabled={!text.trim()} loading={send.isPending} onPress={() => send.mutate(text.trim())} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  author: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'flex-end' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text,
  },
});
