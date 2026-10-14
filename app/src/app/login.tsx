import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/components/theme';
import { Button, Card, ErrorView, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.bg}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
       <View style={s.wrap}>
        <View style={s.brand}>
          <View style={s.brandMark}>
            <Ionicons name="git-network-outline" size={28} color={colors.primary} />
          </View>
          <Text style={s.logo}>VinculaTec</Text>
        </View>

        <Card style={s.form}>
          <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" placeholder="tu@correo.mx" />
          <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry
            onSubmitEditing={submit} placeholder="••••••••" />
          {!!error && <ErrorView error={error} />}
          <Button title="Iniciar sesión" onPress={submit} loading={loading} icon="log-in-outline" />
          <Link href="/registro" asChild>
            <Pressable style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>¿No tienes cuenta? Regístrate</Text>
            </Pressable>
          </Link>
        </Card>
       </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 22 },
  brand: { alignItems: 'center', marginBottom: 24, gap: 10 },
  brandMark: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  form: { padding: 22, borderRadius: 26, boxShadow: '0px 12px 24px rgba(23, 61, 58, 0.08)' },
});
