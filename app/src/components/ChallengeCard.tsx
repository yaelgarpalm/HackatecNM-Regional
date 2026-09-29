import { router } from 'expo-router';

import { label, money, shortDate } from '@/lib/format';
import type { Challenge } from '@/lib/types';
import { Badge, Body, Card, H2, Muted, Row, StatusBadge, Tags } from './ui';

export function ChallengeCard({ ch, children }: { ch: Challenge; children?: React.ReactNode }) {
  return (
    <Card onPress={() => router.push(`/reto/${ch.id}`)}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <H2 style={{ flex: 1 }}>{ch.title}</H2>
        <StatusBadge status={ch.status} />
      </Row>
      <Muted style={{ marginTop: 2 }}>
        {ch.organization_name} · {ch.category}
      </Muted>
      <Body style={{ marginTop: 6 }} numberOfLines={3}>
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
        {ch.deadline && <Badge text={`Cierra ${shortDate(ch.deadline)}`} icon="calendar-outline" />}
        <Badge text={`${ch.proposals_count} postulaciones`} icon="people-outline" />
      </Row>
      <Tags items={ch.tags} />
      {children}
    </Card>
  );
}
