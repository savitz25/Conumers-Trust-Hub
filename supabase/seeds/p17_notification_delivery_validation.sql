-- Deterministic P17 notification templates for isolated validation only.
-- No external provider, SMTP endpoint, API key, or consumer address is used.

insert into network.consumer_notification_templates(
  template_key,version,channel,use_case,severity,subject_template,body_template,
  disclosure,enabled,governance_status,approved_by,effective_from
) values
('p0.material-change.email',1,'email','p0_immediate','P0',
 'My TrustHub alert: public record changed for {{entity_name}}',
 '{{what_changed}} Review the sourced observation and confirm it with the official source. You received this because you asked My TrustHub to Watch this public-record grain.',
 'Extracts can lag. This is not a TrustHub verdict.',true,'approved','validation-fixture','2026-09-01 00:00:00+00'),
('p1.digest.email',1,'email','p1_digest','P1',
 'My TrustHub: important public-record updates',
 'Your digest contains sourced important updates for public-record grains you chose to Watch.',
 'Extracts can lag. This is not a TrustHub verdict.',true,'approved','validation-fixture','2026-09-01 00:00:00+00'),
('p2.digest.email',1,'email','p2_digest','P2',
 'My TrustHub: informational public-record updates',
 'Your digest contains sourced informational updates for public-record grains you chose to Watch.',
 'Extracts can lag. This is not a TrustHub verdict.',true,'approved','validation-fixture','2026-09-01 00:00:00+00'),
('watch.summary.email',1,'email','watch_summary',null,
 'My TrustHub Watch summary',
 'Review current Watch coverage, source health, qualified no-change checks, and surfaced material Alerts.',
 'No-change statements apply only to healthy public records included in Watch coverage.',true,'approved','validation-fixture','2026-09-01 00:00:00+00'),
('source.correction.email',1,'email','correction',null,
 'My TrustHub: source correction recorded',
 'A source corrected a previously surfaced event. Review the correction in My TrustHub.',
 'Extracts can lag. This is not a TrustHub verdict.',false,'approved','validation-fixture','2026-09-01 00:00:00+00');
