-- Deterministic P16 presentation configuration only. These rows do not send
-- notifications, expose live source links, or connect regulator adapters.

insert into network.consumer_alert_templates(
  template_key,version,headline,body,disclosure,governance_status,approved_by,effective_from
) values
('license.suspended.v1',1,'Public license status changed','The supported public license-status field changed to Suspended.','Extracts can lag. This is not a TrustHub verdict.','approved','validation-fixture','2026-09-01 00:00:00+00'),
('status.changed.v1',1,'Public status record changed','A supported public status field included in this Watch changed.','Extracts can lag. This is not a TrustHub verdict.','approved','validation-fixture','2026-09-01 00:00:00+00'),
('discipline.new_record.v1',1,'New disciplinary record posted','The public source posted a new supported disciplinary row.','Extracts can lag. This is not a TrustHub verdict.','approved','validation-fixture','2026-09-01 00:00:00+00'),
('ownership.changed.v1',1,'Public ownership record changed','A supported ownership field in the public record changed.','Extracts can lag. This is not a TrustHub verdict.','approved','validation-fixture','2026-09-01 00:00:00+00'),
('form_adv.material_change.v1',1,'Material Form ADV change observed','A supported material field in the public Form ADV record changed.','Extracts can lag. This is not a TrustHub verdict.','approved','validation-fixture','2026-09-01 00:00:00+00');

insert into network.consumer_source_presentations(
  source_key,display_name,confirmation_ref,governance_status,approved_by
) values
('fl.dbpr','Florida DBPR','official-source:fl-dbpr','approved','validation-fixture'),
('fl.sunbiz','Florida Division of Corporations','official-source:fl-sunbiz','approved','validation-fixture'),
('fmcsa','FMCSA','official-source:fmcsa','approved','validation-fixture'),
('nmls','NMLS Consumer Access','official-source:nmls','approved','validation-fixture'),
('fl.dfs','Florida DFS','official-source:fl-dfs','approved','validation-fixture'),
('cms','CMS','official-source:cms','approved','validation-fixture'),
('sec.form_adv','SEC Investment Adviser Public Disclosure','official-source:sec-iapd','approved','validation-fixture');
