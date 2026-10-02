-- READ ONLY. Run on an independently pinned xkkiicsassizmakcvxml connection.
-- Any exception is a STOP. The result contains counts only, never request data.
begin isolation level serializable read only;
set local row_security=off;
do $$ declare
 cron_dep boolean:=false;
 ext_oid oid;
 c_class oid[]:=array[]::oid[];
 c_obj oid[]:=array[]::oid[];
 c_sub integer[]:=array[]::integer[];
 c_n integer:=0;
 expand_at integer;
 scan_at integer;
 seen boolean;
 rec record;
 blocker text;
begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Independently pinned isolated project attestation required'; end if;
 if (select count(*) from pg_extension where extname='pg_net')<>1 or to_regnamespace('net') is null then
   raise exception 'Expected installed pg_net baseline is absent or ambiguous'; end if;
 if to_regclass('net.http_request_queue') is null or to_regclass('net._http_response') is null then
   raise exception 'Expected pg_net queue/response relations missing'; end if;
 if (select count(*) from net.http_request_queue)<>0 then
   raise exception 'Pending pg_net requests must drain before disable'; end if;
 -- pg_get_functiondef raises 42809 (wrong object type) for aggregates (prokind a),
 -- which have no inspectable body. CASE evaluates it only for ordinary functions,
 -- procedures and window functions (prokind f, p, w); CASE arms with non-constant
 -- arguments are never pre-evaluated by the planner, unlike WHERE-clause order.
 if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where not t.tgisinternal and (case when p.prokind in ('f','p','w') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end
     or n.nspname='supabase_functions' and p.proname='http_request')) then
   raise exception 'Database webhook or non-internal trigger depends on pg_net'; end if;
 if to_regclass('cron.job') is not null then
   execute $q$select exists(select 1 from cron.job where command ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)')$q$ into cron_dep;
 end if;
 if cron_dep then
   raise exception 'Scheduled job depends on pg_net'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','auth','consumer','network','ops','v23_private')
   and case when p.prokind in ('f','p','w') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end) then
   raise exception 'Application-owned function depends on pg_net'; end if;
 -- V23_PG_NET_OWNERSHIP_CLOSURE_START
 -- Catalog identity is (classid, objid, objsubid). Seed direct pg_net members
 -- (deptype e). Expand, until a fixed point, dependents reached by i, a, x, P, or S
 -- when the referenced identity is already owned. Honor refobjsubid. A pg_class
 -- column (objsubid > 0) is owned only when that same relation at objsubid 0 is owned.
 -- Schema net is located by name and then every occupant outside this closure fails.
 select oid into ext_oid from pg_extension where extname='pg_net';
 for rec in
   select m.classid, m.objid, m.objsubid
   from pg_depend m
   where m.refclassid='pg_extension'::regclass and m.refobjid=ext_oid and m.deptype='e'
 loop
   seen:=false;
   for scan_at in 1..c_n loop
     if c_class[scan_at]=rec.classid and c_obj[scan_at]=rec.objid and c_sub[scan_at]=rec.objsubid then
       seen:=true; exit; end if;
   end loop;
   if not seen then
     c_n:=c_n+1; c_class:=c_class||rec.classid; c_obj:=c_obj||rec.objid; c_sub:=c_sub||rec.objsubid;
   end if;
 end loop;
 expand_at:=1;
 while expand_at<=c_n loop
   if c_n>100000 then raise exception 'pg_net ownership closure did not reach a fixed point'; end if;
   for rec in
     select d.classid, d.objid, d.objsubid
     from pg_depend d
     where d.refclassid=c_class[expand_at] and d.refobjid=c_obj[expand_at]
       and d.deptype in ('i','a','x','P','S')
       and (d.refobjsubid=c_sub[expand_at]
         or (c_class[expand_at]='pg_class'::regclass and c_sub[expand_at]=0 and d.refobjsubid>0))
   loop
     seen:=false;
     for scan_at in 1..c_n loop
       if c_class[scan_at]=rec.classid and c_obj[scan_at]=rec.objid and c_sub[scan_at]=rec.objsubid then
         seen:=true; exit; end if;
     end loop;
     if not seen then
       c_n:=c_n+1; c_class:=c_class||rec.classid; c_obj:=c_obj||rec.objid; c_sub:=c_sub||rec.objsubid;
     end if;
   end loop;
   expand_at:=expand_at+1;
 end loop;
 select string_agg(item, '; ' order by item) into blocker from (
   select format('%s depends on %s',
     pg_describe_object(d.classid, d.objid, d.objsubid),
     pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid)) as item
   from pg_depend d
   where d.deptype='n'
     and exists(select 1 from generate_series(1, c_n) g(i)
       where c_class[g.i]=d.refclassid and c_obj[g.i]=d.refobjid
         and (c_sub[g.i]=d.refobjsubid
           or (d.refclassid='pg_class'::regclass and c_class[g.i]='pg_class'::regclass
             and c_sub[g.i]=0 and d.refobjsubid>0)))
     and not exists(select 1 from generate_series(1, c_n) g(i)
       where c_class[g.i]=d.classid and c_obj[g.i]=d.objid
         and (c_sub[g.i]=d.objsubid
           or (d.classid='pg_class'::regclass and c_class[g.i]='pg_class'::regclass
             and c_sub[g.i]=0 and d.objsubid>0)))
 ) blockers;
 if blocker is not null then
   raise exception 'External catalog dependency would make DROP EXTENSION unsafe: %', blocker; end if;
 select string_agg(item, '; ' order by item) into blocker from (
   select pg_describe_object(occupant.classid, occupant.objid, occupant.objsubid) as item
   from (
     select 'pg_class'::regclass as classid, c.oid as objid, 0 as objsubid
       from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net'
     union all
     select 'pg_proc'::regclass, p.oid, 0
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net'
     union all
     select 'pg_type'::regclass, t.oid, 0
       from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='net'
     union all
     select 'pg_operator'::regclass, o.oid, 0
       from pg_operator o join pg_namespace n on n.oid=o.oprnamespace where n.nspname='net'
     union all
     select 'pg_opclass'::regclass, oc.oid, 0
       from pg_opclass oc join pg_namespace n on n.oid=oc.opcnamespace where n.nspname='net'
     union all
     select 'pg_opfamily'::regclass, opf.oid, 0
       from pg_opfamily opf join pg_namespace n on n.oid=opf.opfnamespace where n.nspname='net'
   ) occupant
   where not exists(select 1 from generate_series(1, c_n) g(i)
     where c_class[g.i]=occupant.classid and c_obj[g.i]=occupant.objid and c_sub[g.i]=occupant.objsubid)
 ) occupants;
 if blocker is not null then
   raise exception 'Object in schema net is outside pg_net ownership closure: %', blocker; end if;
 -- V23_PG_NET_OWNERSHIP_CLOSURE_END
end $$;
select (select count(*) from net.http_request_queue) pending_requests,
       (select count(*) from net._http_response) transient_responses,
       (select extversion from pg_extension where extname='pg_net') installed_version,
       'V23_PG_NET_PREFLIGHT_PASS' result;
rollback;
