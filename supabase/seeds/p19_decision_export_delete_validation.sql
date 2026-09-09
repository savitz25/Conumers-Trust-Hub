-- Deterministic P19 validation governance only. No real consumer data.
begin;
grant myth_session_governor to postgres;
set local role myth_session_governor;

select network.set_consumer_session_export_policy('move.comparison/v1',1,'full','{}');
select network.set_consumer_session_export_policy('move.inventory/v1',1,'full','{}');
select network.set_consumer_session_export_policy('move.route-plan/v1',1,'full','{}');
select network.set_consumer_session_export_policy('lender.piti/v1',1,'summary_only','{}');
select network.set_consumer_session_export_policy('lender.piti/v2',2,'summary_only','{}');
select network.set_consumer_session_export_policy('lender.closing-cost/v1',1,'redacted',array['loan_amount']);
select network.set_consumer_session_export_policy('lender.legacy-budget/v1',1,'summary_only','{}');
select network.set_consumer_session_export_policy('contractor.bid-comparison/v1',1,'full','{}');
select network.set_consumer_session_export_policy('insurance.coverage-plan/v1',1,'redacted',array['zip']);
select network.set_consumer_session_export_policy('senior.shortlist-plan/v1',1,'summary_only','{}');
select network.set_consumer_session_export_policy('investor.fee-research/v1',1,'full','{}');

reset role;
revoke myth_session_governor from postgres;
commit;
