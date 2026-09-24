/** Cleanup statement preparation ONLY; no worker, cron or automatic execution.
 * A separately approved isolated operator must supply the narrow cleanup role. */
export function retentionBatch(now:number,limit=100){
  if(!Number.isSafeInteger(now)||now<0||!Number.isInteger(limit)||limit<1||limit>500)throw new Error('invalid retention batch');
  return {sql:`with expired as (
    select kind,key_hash from ops.v23_profile_runtime_records
    where (kind in ('stage','continuation','grant') and created_at < to_timestamp($1/1000.0)-interval '1 hour')
       or (kind='receipt' and created_at < to_timestamp($1/1000.0)-interval '30 days')
    order by created_at limit $2
  ) delete from ops.v23_profile_runtime_records r using expired e
    where r.kind=e.kind and r.key_hash=e.key_hash`,values:[now,limit]};
}
export function quotaRetentionBatch(now:number,limit=100){
  retentionBatch(now,limit);
  return {sql:`with expired as (select bucket from ops.v23_profile_runtime_quota
    where window_start < $1 order by window_start limit $2)
    delete from ops.v23_profile_runtime_quota q using expired e where q.bucket=e.bucket`,
    values:[Math.floor(now/60000)-1440,limit]};
}
export function confirmationRetentionBatch(now:number,limit=100){
  retentionBatch(now,limit);
  return {sql:`with expired as (select key_hash from v23_private.browser_confirmations
    where created_at < to_timestamp($1/1000.0)-interval '1 hour' order by created_at limit $2)
    delete from v23_private.browser_confirmations b using expired e where b.key_hash=e.key_hash`,values:[now,limit]};
}
// DELETE takes row locks itself. Do not use SELECT FOR UPDATE: that requires an
// UPDATE privilege the cleanup role deliberately lacks. Run batches with bounded
// statement/lock timeouts; concurrent deletes are safe and may retry on timeout.
