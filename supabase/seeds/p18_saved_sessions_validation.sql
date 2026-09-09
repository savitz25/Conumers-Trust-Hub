-- Deterministic, non-production P18 schema contracts. No real consumer data.
begin;

-- The validation executor must be able to assume each least-privilege service
-- role while proposing fixtures. Keep this membership transaction-scoped and
-- remove it before commit so the seed does not widen steady-state access.
grant myth_session_governor,myth_bff_move,myth_bff_lender,myth_bff_insurance,
  myth_bff_contractor,myth_bff_senior,myth_bff_investor to postgres;

set local role myth_bff_move;
select network.propose_consumer_session_schema('move.comparison/v1',1,'move','comparison',65536,
  array['mover_refs','origin_zip','destination_zip'],array['mover_refs'],array['title','item_count','label'],
  'comparison','/my-move','non_sensitive','Provider references and route ZIPs only; no payment or credential data.','Retain until consumer archive or workspace deletion.');
select network.propose_consumer_session_schema('move.inventory/v1',1,'move','inventory',65536,
  array['room_counts','estimated_cubic_feet'],array['estimated_cubic_feet'],array['title','primary_value','unit','label'],
  'inventory','/my-move','restricted_household','Aggregate room and volume counts only; no household-member identity.','Retain until consumer archive or workspace deletion.');
select network.propose_consumer_session_schema('move.route-plan/v1',1,'move','plan',32768,
  array['origin_zip','destination_zip'],array['origin_zip','destination_zip'],array['title','label'],
  'plan','/my-move','non_sensitive','Route endpoints only; no precise household address.','Draft validation schema; not creatable until approved.');

set local role myth_bff_lender;
select network.propose_consumer_session_schema('lender.piti/v1',1,'lender','calculator',65536,
  array['home_price','down_payment','interest_rate','term_years','tax_monthly','insurance_monthly'],
  array['home_price','down_payment'],array['title','primary_value','unit','label'],
  'calculator','/my-lending','restricted_financial','Minimum scenario inputs only; never income, debt, SSN, accounts, or credentials.','Retain until consumer archive or workspace deletion.');
select network.propose_consumer_session_schema('lender.piti/v2',2,'lender','calculator',65536,
  array['home_price','down_payment','interest_rate','term_years','tax_monthly','insurance_monthly','hoa_monthly'],
  array['home_price','down_payment'],array['title','primary_value','unit','label'],
  'calculator','/my-lending','restricted_financial','Minimum scenario inputs only; never income, debt, SSN, accounts, or credentials.','Retain until consumer archive or workspace deletion.');
select network.propose_consumer_session_schema('lender.closing-cost/v1',1,'lender','worksheet',32768,
  array['purchase_price','closing_cost_estimate'],array['purchase_price'],array['title','primary_value','unit','label'],
  'worksheet','/my-lending','restricted_financial','Scenario totals only; no application, credit, or account data.','Retain until consumer archive or workspace deletion.');
select network.propose_consumer_session_schema('lender.legacy-budget/v1',1,'lender','worksheet',32768,
  array['scenario_total'],array['scenario_total'],array['title','primary_value','unit','label'],
  'worksheet','/my-lending','restricted_financial','Legacy aggregate scenario only; no identity or credentials.','Retired fixture remains visible and exportable.');

set local role myth_bff_contractor;
select network.propose_consumer_session_schema('contractor.bid-comparison/v1',1,'contractor','comparison',32768,
  array['bid_refs','trade','project_zip'],array['bid_refs'],array['title','item_count','label'],
  'comparison','/contractors','non_sensitive','Opaque bid references and general job context only.','Retain until consumer archive or workspace deletion.');

set local role myth_bff_insurance;
select network.propose_consumer_session_schema('insurance.coverage-plan/v1',1,'insurance','plan',32768,
  array['coverage_types','property_zip'],array['coverage_types'],array['title','item_count','label'],
  'plan','/my-insurance','restricted_household','Coverage categories and general ZIP only; no policy or account numbers.','Retain until consumer archive or workspace deletion.');

set local role myth_bff_senior;
select network.propose_consumer_session_schema('senior.shortlist-plan/v1',1,'senior','plan',32768,
  array['provider_refs','care_class','care_zip'],array['provider_refs'],array['title','item_count','label'],
  'plan','/providers','restricted_household','Provider references, care class, and ZIP only; no diagnoses or medical records.','Retain until consumer archive or workspace deletion.');

set local role myth_bff_investor;
select network.propose_consumer_session_schema('investor.fee-research/v1',1,'investor','worksheet',32768,
  array['adviser_refs','fee_scenarios','research_only'],array['research_only'],array['title','item_count','label'],
  'worksheet','/advisers','restricted_financial','Research-only fee scenarios; no brokerage credentials, authorization, returns, or recommendations.','Retain until consumer archive or workspace deletion.');

set local role myth_session_governor;
select network.set_consumer_session_schema_status(schema_key,version,'approved')
from network.consumer_session_schemas
where schema_key in (
  'move.comparison/v1','move.inventory/v1','lender.piti/v1','lender.piti/v2',
  'lender.closing-cost/v1','lender.legacy-budget/v1','contractor.bid-comparison/v1',
  'insurance.coverage-plan/v1','senior.shortlist-plan/v1','investor.fee-research/v1'
)
order by schema_key;

select network.register_consumer_session_schema_migration(
  (select id from network.consumer_session_schemas where schema_key='lender.piti/v1' and version=1),
  (select id from network.consumer_session_schemas where schema_key='lender.piti/v2' and version=2),
  'lender.piti.v1-to-v2/v1','approved'
);

reset role;
revoke myth_session_governor,myth_bff_move,myth_bff_lender,myth_bff_insurance,
  myth_bff_contractor,myth_bff_senior,myth_bff_investor from postgres;
commit;
