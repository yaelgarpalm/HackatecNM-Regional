import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { label, money, plural, shortDate } from '@/lib/format';
import type { Challenge } from '@/lib/types';
import { colors } from './theme';
import { Badge, Body, Card, H2, Muted, Row, StatusBadge } from './ui';

const MAX_TAGS = 3;

export function ChallengeCard({ ch, children }: { ch: Challenge; children?: React.ReactNode }) {
  const extraTags = ch.tags.length - MAX_TAGS;
  return (
    <Card onPress={() => router.push(`/reto/${ch.id}`)}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <H2 style={{ flex: 1 }}>{ch.title}</H2>
        <StatusBadge status={ch.status} />
      </Row>
      <Muted style={{ marginTop: 2 }}>
        {ch.organization_name} · {ch.category}
      </Muted>
      <Body style={{ marginTop: 6 }} numberOfLines={3}>
        {ch.summary}
      </Body>

      {/* Lo que decide si me postulo: apoyo, validez académica y confidencialidad */}
      <Row gap={6} style={{ marginTop: 8 }}>
        {(ch.offers_stipend || !!ch.budget_mxn) && (
          <Badge text={ch.budget_mxn ? money(ch.budget_mxn) : 'Con apoyo económico'} tone="success" icon="cash-outline" />
        )}
        {ch.modalities.map((m) => <Badge key={m} text={label(m)} tone="accent" />)}
        {ch.confidentiality === 'confidencial' && <Badge text="Requiere NDA" tone="warning" icon="lock-closed" />}
        {ch.tags.slice(0, MAX_TAGS).map((t) => <Badge key={t} text={t} tone="primary" />)}
        {extraTags > 0 && <Badge text={`+${extraTags}`} />}
      </Row>

      <Row gap={12} style={{ marginTop: 10, flexWrap: 'nowrap' }}>
        <Row gap={4} style={{ flex: 1 }}>
          {!!ch.deadline && (
            <>
              <Ionicons name="calendar-outline" size={14} color={colors.muted} />
              <Muted>Cierra {shortDate(ch.deadline)} · </Muted>
            </>
          )}
          <Muted>{plural(ch.proposals_count, 'postulación', 'postulaciones')}</Muted>
        </Row>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Row>
      {children}
    </Card>
  );
}
