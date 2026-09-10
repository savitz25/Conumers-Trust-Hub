begin;

insert into network.consumer_notification_templates(
  template_key,version,channel,use_case,severity,subject_template,body_template,
  disclosure,enabled,governance_status,approved_by,effective_from
) values
('p0.material-change.email',1,'email','p0_immediate','P0',
 'My TrustHub alert: public record changed for {{entity_name}}',
 '{{what_changed}} Review the sourced observation and confirm it with the official source. You received this because you asked My TrustHub to Watch this public-record grain.',
 'This reflects a change in the watched public record. It is not a recommendation or verdict.',true,'approved','stage6_parent_closeout',statement_timestamp()),
('p1.digest.email',1,'email','p1_digest','P1',
 'My TrustHub: important public-record updates',
 'Your digest contains sourced important updates for public-record grains you chose to Watch.',
 'This reflects changes in watched public records. It is not a recommendation or verdict.',true,'approved','stage6_parent_closeout',statement_timestamp()),
('p2.digest.email',1,'email','p2_digest','P2',
 'My TrustHub: informational public-record updates',
 'Your digest contains sourced informational updates for public-record grains you chose to Watch.',
 'This reflects changes in watched public records. It is not a recommendation or verdict.',true,'approved','stage6_parent_closeout',statement_timestamp()),
('watch.summary.email',1,'email','watch_summary',null,
 'My TrustHub Watch summary',
 'Review current Watch coverage, source health, qualified no-change checks, and surfaced material Alerts.',
 'No-change statements apply only to healthy public records included in Watch coverage.',true,'approved','stage6_parent_closeout',statement_timestamp()),
('source.correction.email',1,'email','correction',null,
 'My TrustHub: source correction recorded',
 'A source corrected a previously surfaced event. Review the correction in My TrustHub.',
 'This reflects a change in the watched public record. It is not a recommendation or verdict.',false,'approved','stage6_parent_closeout',statement_timestamp())
on conflict (template_key,version) do nothing;

create or replace function ops.pending_alert_delivery_candidates(p_limit integer default 50)
returns table(alert_id uuid,idempotency_key uuid)
language sql stable security definer set search_path=pg_catalog,network,consumer,ops
as $$
  select a.id,md5(a.id::text||':email')::uuid
  from consumer.consumer_alerts a
  join consumer.consumer_watches w on w.id=a.watch_id and w.status='active'
  join network.network_change_events e on e.id=a.change_event_id and e.status='active'
  where not exists (select 1 from ops.consumer_alert_deliveries d where d.alert_id=a.id and d.channel='email')
  order by a.surfaced_at,a.id limit greatest(coalesce(p_limit,50),1);
$$;

create or replace function ops.get_email_recipient(p_delivery_id uuid)
returns text
language sql stable security definer set search_path=pg_catalog,ops,auth
as $$ select u.email from ops.consumer_alert_deliveries d join auth.users u on u.id=d.user_id where d.id=p_delivery_id; $$;

create or replace function ops.pending_p0_deliveries(p_limit integer default 50)
returns table(delivery_id uuid)
language sql stable security definer set search_path=pg_catalog,ops
as $$ select id from ops.consumer_alert_deliveries where status='pending' and delivery_type='p0_immediate' order by created_at,id limit greatest(coalesce(p_limit,50),1); $$;

create or replace function ops.process_email_result(
  p_delivery_id uuid,p_outcome text,p_provider_ref text default null,p_error_code text default null,
  p_worker_ref text default 'my-trusthub-email-worker',p_now timestamptz default statement_timestamp()
)
returns table(delivery_status text,process_outcome text,attempt_number integer)
language plpgsql security definer set search_path=pg_catalog,network,consumer,ops
as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  d ops.consumer_alert_deliveries%rowtype; gate record; attempt integer; terminal boolean;
  failure text; outcome text;
begin
  if actor_role<>'myth_notification_delivery' then raise exception 'notification worker authorization required' using errcode='insufficient_privilege'; end if;
  if p_outcome not in ('success','transient_failure','permanent_failure','invalid_destination','provider_error','rate_limited') then raise exception 'invalid provider outcome' using errcode='invalid_parameter_value'; end if;
  select * into d from ops.consumer_alert_deliveries where id=p_delivery_id for update;
  if d.id is null then raise exception 'delivery not found' using errcode='no_data_found'; end if;
  if d.status='delivered' then delivery_status:=d.status;process_outcome:='already_delivered';attempt_number:=d.attempt_count;return next;return; end if;
  if d.status in ('suppressed','cancelled') then delivery_status:=d.status;process_outcome:='not_eligible';attempt_number:=d.attempt_count;return next;return; end if;
  select * into gate from ops.delivery_still_eligible(d.id);
  if not coalesce(gate.eligible,false) then
    update ops.consumer_alert_deliveries set status='suppressed',suppressed_at=p_now,next_attempt_at=null,failure_class='suppressed',error_code=gate.reason where id=d.id;
    delivery_status:='suppressed';process_outcome:=lower(gate.reason);attempt_number:=d.attempt_count;return next;return;
  end if;
  attempt:=d.attempt_count+1; terminal:=p_outcome in ('permanent_failure','invalid_destination') or attempt>=5;
  failure:=case p_outcome when 'transient_failure' then 'transient' when 'permanent_failure' then 'permanent' when 'invalid_destination' then 'invalid_destination' when 'provider_error' then 'provider_error' when 'rate_limited' then 'rate_limited' else null end;
  insert into ops.consumer_alert_delivery_attempts(delivery_id,attempt_number,outcome,failure_class,provider_message_ref,error_code,attempted_at,worker_ref)
  values(d.id,attempt,case when p_outcome='success' then 'delivered' else p_outcome end,failure,p_provider_ref,p_error_code,p_now,p_worker_ref);
  if p_outcome='success' then
    update ops.consumer_alert_deliveries set status='delivered',attempt_count=attempt,first_attempt_at=coalesce(first_attempt_at,p_now),last_attempt_at=p_now,delivered_at=p_now,failed_at=null,next_attempt_at=null,provider_message_ref=p_provider_ref,failure_class=null,error_code=null where id=d.id;
    delivery_status:='delivered';process_outcome:='sent';
  else
    update ops.consumer_alert_deliveries set status='failed',attempt_count=attempt,first_attempt_at=coalesce(first_attempt_at,p_now),last_attempt_at=p_now,failed_at=p_now,next_attempt_at=case when terminal then null else p_now+ops.notification_retry_delay(attempt) end,failure_class=case when terminal then failure else failure end,error_code=coalesce(p_error_code,upper(p_outcome)) where id=d.id;
    delivery_status:='failed';process_outcome:=case when terminal then 'terminal_failure' else 'retry_scheduled' end;
  end if;
  attempt_number:=attempt; return next;
end;
$$;

create or replace function ops.get_due_digest_batches(p_now timestamptz default statement_timestamp(),p_limit integer default 50)
returns table(user_id uuid,recipient text,delivery_ids uuid[],subject text,body text)
language sql stable security definer set search_path=pg_catalog,network,consumer,ops,auth
as $$
  with due as (
    select d.id,d.user_id,d.delivery_type,d.delivery_window_key,a.severity,a.observed_at,e.canonical_name,at.headline,
      coalesce(sp.display_name,cap.source_key) source_name,p.timezone,p.digest_time_local,u.email
    from ops.consumer_alert_deliveries d
    join consumer.consumer_alerts a on a.id=d.alert_id
    join network.network_change_events ce on ce.id=a.change_event_id and ce.status='active'
    join network.network_entities e on e.id=ce.network_entity_id
    join network.watch_capabilities cap on cap.id=ce.capability_id and cap.version=ce.capability_version
    join network.consumer_alert_templates at on at.template_key=a.template_key and at.version=a.template_version
    join consumer.consumer_notification_preferences p on p.user_id=d.user_id and p.p1_digest_enabled=true
    join auth.users u on u.id=d.user_id
    left join network.consumer_source_presentations sp on sp.source_key=cap.source_key and sp.governance_status='approved'
    join consumer.consumer_watches w on w.id=a.watch_id and w.status='active'
    where d.status='pending' and d.delivery_type in ('p1_digest','p2_digest')
      and d.delivery_window_key::date <= (p_now at time zone p.timezone)::date
      and (p_now at time zone p.timezone)::time >= p.digest_time_local
      and (d.delivery_type='p1_digest' or p.p2_digest_enabled=true)
  ), grouped as (
    select user_id,max(email) recipient,array_agg(id order by observed_at,id) delivery_ids,
      'My TrustHub: important public-record updates' subject,
      string_agg(format('%s — %s (%s)',canonical_name,headline,source_name),E'\n' order by observed_at,id) body
    from due group by user_id
  ) select user_id,recipient,delivery_ids,subject,body from grouped limit greatest(coalesce(p_limit,50),1);
$$;

grant execute on function ops.pending_alert_delivery_candidates(integer),ops.get_email_recipient(uuid),ops.pending_p0_deliveries(integer),ops.process_email_result(uuid,text,text,text,text,timestamptz),ops.get_due_digest_batches(timestamptz,integer) to myth_notification_delivery;
revoke all on function ops.pending_alert_delivery_candidates(integer),ops.get_email_recipient(uuid),ops.pending_p0_deliveries(integer),ops.process_email_result(uuid,text,text,text,text,timestamptz),ops.get_due_digest_batches(timestamptz,integer) from public;

commit;
