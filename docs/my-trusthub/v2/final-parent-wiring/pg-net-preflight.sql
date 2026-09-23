-- READ ONLY. Run on an independently pinned xkkiicsassizmakcvxml connection.
-- Any exception is a STOP. The result contains counts only, never request data.
begin isolation level serializable read only;
set local row_security=off;
do $$ declare cron_dep boolean:=false; begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Independently pinned isolated project attestation required'; end if;
 if (select count(*) from pg_extension where extname='pg_net')<>1 or to_regnamespace('net') is null then
   raise exception 'Expected installed pg_net baseline is absent or ambiguous'; end if;
 if to_regclass('net.http_request_queue') is null or to_regclass('net._http_response') is null then
   raise exception 'Expected pg_net queue/response relations missing'; end if;
 if (select count(*) from net.http_request_queue)<>0 then
   raise exception 'Pending pg_net requests must drain before disable'; end if;
 -- pg_get_functiondef raises 42809 for aggregates and window functions. CASE calls it
 -- only for ordinary functions and procedures, whose bodies this gate can inspect.
 if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where not t.tgisinternal and (case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end
     or n.nspname='supabase_functions' and p.proname='http_request')) then
   raise exception 'Database webhook or non-internal trigger depends on pg_net'; end if;
 if to_regclass('cron.job') is not null then
   execute $q$select exists(select 1 from cron.job where command ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)')$q$ into cron_dep;
 end if;
 if cron_dep then
   raise exception 'Scheduled job depends on pg_net'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','auth','consumer','network','ops','v23_private')
   and case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end) then
   raise exception 'Application-owned function depends on pg_net'; end if;
 -- Ownership is catalog membership, not the net schema name. A pg_class column
 -- (objsubid > 0) is owned when its parent relation (objsubid 0) is a direct member.
 -- A composite type's backing pg_class is internal to that member type, so its
 -- columns are owned too. A pg_attrdef is owned only when it is the automatic or
 -- internal default of one of those relations. Any other normal dependency remains fatal.
 if exists(select 1 from pg_extension ext
   join pg_depend member on member.refclassid='pg_extension'::regclass and member.refobjid=ext.oid and member.deptype='e'
   join pg_depend dependent on dependent.refclassid=member.classid and dependent.refobjid=member.objid and dependent.deptype='n'
   where ext.extname='pg_net'
     and not (
       exists(select 1 from pg_depend owned_parent
         where owned_parent.classid=dependent.classid and owned_parent.objid=dependent.objid and owned_parent.objsubid=0
           and owned_parent.refclassid='pg_extension'::regclass and owned_parent.refobjid=ext.oid and owned_parent.deptype='e')
       or (dependent.classid='pg_class'::regclass and exists(select 1 from pg_depend internal_rel
         join pg_type composite_type on composite_type.oid=internal_rel.refobjid and composite_type.typtype='c'
         join pg_depend type_member on type_member.classid='pg_type'::regclass and type_member.objid=composite_type.oid
           and type_member.objsubid=0 and type_member.refclassid='pg_extension'::regclass
           and type_member.refobjid=ext.oid and type_member.deptype='e'
         where internal_rel.classid='pg_class'::regclass and internal_rel.objid=dependent.objid and internal_rel.objsubid=0
           and internal_rel.refclassid='pg_type'::regclass and internal_rel.deptype='i'))
       or (dependent.classid='pg_attrdef'::regclass and exists(select 1 from pg_depend attr_column
         where attr_column.classid=dependent.classid and attr_column.objid=dependent.objid and attr_column.objsubid=0
           and attr_column.refclassid='pg_class'::regclass and attr_column.refobjsubid>0 and attr_column.deptype in ('a','i')
           and (
             exists(select 1 from pg_depend owned_parent
               where owned_parent.classid='pg_class'::regclass and owned_parent.objid=attr_column.refobjid and owned_parent.objsubid=0
                 and owned_parent.refclassid='pg_extension'::regclass and owned_parent.refobjid=ext.oid and owned_parent.deptype='e')
             or exists(select 1 from pg_depend internal_rel
               join pg_type composite_type on composite_type.oid=internal_rel.refobjid and composite_type.typtype='c'
               join pg_depend type_member on type_member.classid='pg_type'::regclass and type_member.objid=composite_type.oid
                 and type_member.objsubid=0 and type_member.refclassid='pg_extension'::regclass
                 and type_member.refobjid=ext.oid and type_member.deptype='e'
               where internal_rel.classid='pg_class'::regclass and internal_rel.objid=attr_column.refobjid and internal_rel.objsubid=0
                 and internal_rel.refclassid='pg_type'::regclass and internal_rel.deptype='i')
           )))
     )) then
   raise exception 'External catalog dependency would make DROP EXTENSION unsafe'; end if;
end $$;
select (select count(*) from net.http_request_queue) pending_requests,
       (select count(*) from net._http_response) transient_responses,
       (select extversion from pg_extension where extname='pg_net') installed_version,
       'V23_PG_NET_PREFLIGHT_PASS' result;
rollback;
