-- Deterministic P15 validation configuration only. This does not connect a live
-- source, poll a regulator, create a consumer Alert, or activate production.

insert into network.watch_capability_observation_contracts(
  capability_id,capability_version,normalized_schema_version,material_field_keys,
  allowed_material_values,classifier_key,classifier_version,freshness_grace,
  minimum_completeness_ratio,mass_change_threshold,monitoring_status
)
select id,version,'monitoring/v1',
  case capability_key
    when 'contractor.fl.dbpr.discipline' then array['record_keys']
    when 'senior.cms.ownership' then array['owner_id']
    when 'investor.sec.form_adv.material_change' then array['material_filing_hash']
    else array['status'] end,
  case when capability_key in (
    'contractor.fl.dbpr.license_status','contractor.fl.sunbiz.entity_status',
    'move.federal.fmcsa.operating_authority','lender.nmls.public_status',
    'insurance.fl.dfs.agency_status'
  ) then '{"status":["Active","Suspended","Revoked","Expired","Inactive","Authorized","Not authorized"]}'::jsonb
  else '{}'::jsonb end,
  case capability_key
    when 'contractor.fl.dbpr.discipline' then 'set.addition'
    when 'senior.cms.ownership' then 'ownership.transition'
    when 'investor.sec.form_adv.material_change' then 'filing.material_change'
    else 'status.transition' end,
  1,interval '2 hours',0.95000,
  case when capability_key='contractor.fl.dbpr.license_status' then 2 else 1000 end,
  'current'
from network.watch_capabilities
where id between '51000000-0000-4000-8000-000000000001' and '51000000-0000-4000-8000-000000000008'
   or id='51000000-0000-4000-8000-000000000016';

insert into network.alert_severity_rules(
  id,capability_id,capability_version,classifier_key,rule_version,rule_priority,
  previous_material_value,new_material_value,event_type,severity,safe_template_key,
  governance_status,enabled,effective_from,approved_by
)
select
  ('61000000-0000-4000-8000-'||lpad(row_number() over(order by id)::text,12,'0'))::uuid,
  id,version,
  case capability_key
    when 'contractor.fl.dbpr.discipline' then 'set.addition'
    when 'senior.cms.ownership' then 'ownership.transition'
    when 'investor.sec.form_adv.material_change' then 'filing.material_change'
    else 'status.transition' end,
  1,100,null,null,
  case capability_key
    when 'contractor.fl.dbpr.discipline' then 'disciplinary_record_added'
    when 'senior.cms.ownership' then 'ownership_record_changed'
    when 'investor.sec.form_adv.material_change' then 'form_adv_material_change'
    else 'public_status_changed' end,
  case capability_key
    when 'contractor.fl.dbpr.discipline' then 'P0'
    when 'senior.cms.ownership' then 'P1'
    else 'P2' end,
  case capability_key
    when 'contractor.fl.dbpr.discipline' then 'discipline.new_record.v1'
    when 'senior.cms.ownership' then 'ownership.changed.v1'
    when 'investor.sec.form_adv.material_change' then 'form_adv.material_change.v1'
    else 'status.changed.v1' end,
  'approved',true,timestamptz '2026-09-01 00:00:00+00','validation-fixture'
from network.watch_capabilities
where id between '51000000-0000-4000-8000-000000000001' and '51000000-0000-4000-8000-000000000008'
   or id='51000000-0000-4000-8000-000000000016';

-- A specific reviewed P0 transition wins over the generic P2 status rule.
insert into network.alert_severity_rules(
  id,capability_id,capability_version,classifier_key,rule_version,rule_priority,
  previous_material_value,new_material_value,event_type,severity,safe_template_key,
  governance_status,enabled,effective_from,approved_by
) values (
  '61000000-0000-4000-8000-000000000100',
  '51000000-0000-4000-8000-000000000001',1,'status.transition',1,10,
  '{"status":"Active"}','{"status":"Suspended"}',
  'license_status_suspended','P0','license.suspended.v1',
  'approved',true,timestamptz '2026-09-01 00:00:00+00','validation-fixture'
);
