-- Indices para llaves foráneas que no están indexadas por los modelos SQLAlchemy.
CREATE INDEX ix_users_organization_id ON public.users (organization_id);
CREATE INDEX ix_careers_created_by_org_id ON public.careers (created_by_org_id);
CREATE INDEX ix_capabilities_contact_user_id ON public.capabilities (contact_user_id);
CREATE INDEX ix_challenges_created_by_id ON public.challenges (created_by_id);
CREATE INDEX ix_teams_university_id ON public.teams (university_id);
CREATE INDEX ix_teams_created_by_id ON public.teams (created_by_id);
CREATE INDEX ix_messages_author_id ON public.messages (author_id);
CREATE INDEX ix_reviews_reviewer_id ON public.reviews (reviewer_id);
