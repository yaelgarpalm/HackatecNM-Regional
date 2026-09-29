import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/theme';
import { Button, Card, ErrorView, Field, Muted } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const DEMO = [
  ['Estudiante', 'ana@tessfp.edu.mx'],
  ['Empresa', 'laura@laespiga.mx'],
  ['Universidad', 'vinculacion@tessfp.edu.mx'],
  ['Académico', 'dra.martinez@tessfp.edu.mx'],
  ['Gobierno', 'innovacion@sanfelipe.gob.mx'],
  ['Admin', 'admin@vinculatec.mx'],
];

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
      <View style={s.wrap}>
        <View style={s.brand}>
          <Ionicons name="git-network-outline" size={44} color="#fff" />
          <Text style={s.logo}>VinculaTec</Text>
          <Text style={s.tagline}>Problemáticas reales de empresas, resueltos por equipos universitarios</Text>
        </View>

        <Card style={{ padding: 20 }}>
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

        <Card>
          <Muted style={{ marginBottom: 8 }}>Cuentas de demostración (contraseña Demo12345):</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {DEMO.map(([role, mail]) => (
              <Button key={mail} small variant="secondary" title={role}
                onPress={() => { setEmail(mail); setPassword('Demo12345'); }} />
            ))}
          </View>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center' },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 20 },
  brand: { alignItems: 'center', marginBottom: 20, gap: 4 },
  logo: { color: '#fff', fontSize: 32, fontWeight: '900' },
  tagline: { color: '#D6E4F0', textAlign: 'center', fontSize: 14 },
});
