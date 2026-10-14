import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { label, money, shortDate } from '@/lib/format';
import type { Challenge } from '@/lib/types';
import { Badge, Body, Card, H2, Muted, Row, StatusBadge, Tags } from './ui';

export function ChallengeCard({ ch, children }: { ch: Challenge; children?: React.ReactNode }) {
  return (
    <Card onPress={() => router.push(`/reto/${ch.id}`)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge text={ch.category} tone="primary" icon="sparkles-outline" />
        <StatusBadge status={ch.status} />
      </Row>
      <H2 style={{ marginTop: 10, fontSize: 21, lineHeight: 27 }}>{ch.title}</H2>
      <Row gap={6} style={{ marginTop: 3, flexWrap: 'nowrap' }}>
        <Ionicons name="business-outline" size={15} color="#5A7074" />
        <Muted numberOfLines={1} style={{ flex: 1 }}>{ch.organization_name}</Muted>
      </Row>
      <Body style={{ marginTop: 10 }} numberOfLines={3}>
        {ch.summary}
      </Body>
      <Row gap={6} style={{ marginTop: 8 }}>
        {ch.confidentiality === 'confidencial' && <Badge text="NDA" tone="warning" icon="lock-closed" />}
        {(ch.offers_stipend || !!ch.budget_mxn) && (
          <Badge text={ch.budget_mxn ? money(ch.budget_mxn) : 'Con apoyo'} tone="success" icon="cash-outline" />
        )}
        {ch.modalities.map((m) => (
          <Badge key={m} text={label(m)} tone="accent" />
        ))}
        {!!ch.deadline && <Badge text={`Cierra ${shortDate(ch.deadline)}`} icon="calendar-outline" />}
        <Badge text={`${ch.proposals_count} postulaciones`} icon="people-outline" />
      </Row>
      <Tags items={ch.tags} />
      {children}
      <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <Muted style={{ fontWeight: '700', color: '#0D716B' }}>Ver detalles</Muted>
        <Ionicons name="arrow-forward" size={15} color="#0D716B" />
      </View>
    </Card>
  );
}
