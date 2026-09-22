/** Assembly interface for a separately reviewed isolated deployment. This module
 * never opens a connection, reads credentials, or selects a fixture backend. */
import {AuthorizedPostgresBackend,type AuthorizedPostgresPorts} from './authorized-postgres.ts';
import {PostgresConfirmationStore} from './confirmation-store.ts';
import {ParentProfileSaveRuntime,type VerifiedCaller} from './runtime.ts';
import type {BrowserBindings,Confirmation,BrowserParent} from './browser.ts';
import type {TrustedOriginRegistry} from '../contracts/v2-3-profile-transfer.ts';
import {deploymentEnabled} from './isolated-config.ts';
export type IsolatedAdapterPorts={
  approvedParentOrigin:string;
  registry:TrustedOriginRegistry;
  /** Operator must verify dedicated/session affinity; transaction poolers are
   * incompatible with the cross-transaction browser serialization lock. */
  sessionAffinity:'dedicated';
  postgres:AuthorizedPostgresPorts;
  source:BrowserBindings['source'];
  parent:BrowserBindings['parent'];
  projects:BrowserBindings['projects'];
  acknowledge:BrowserBindings['acknowledge'];
  authenticate(request:Request,confirmation:Confirmation,parent:BrowserParent):Promise<VerifiedCaller|null>;
  store?: BrowserBindings['store'];
};
export function isolatedBrowserBindings(env:Record<string,string|undefined>,p:IsolatedAdapterPorts|null):BrowserBindings|null{
  if(!p||!deploymentEnabled(env)||p.registry.environment!=='isolated'||!p.registry.isolatedBackendVerified||
    p.approvedParentOrigin!==env.MY_TRUSTHUB_TEST_ORIGIN||p.sessionAffinity!=='dedicated')return null;
  const backend=new AuthorizedPostgresBackend(p.postgres);
  return {origin:p.approvedParentOrigin,registry:p.registry,source:p.source,parent:p.parent,projects:p.projects,
    acknowledge:p.acknowledge,store:p.store??new PostgresConfirmationStore(p.postgres.pool,p.sessionAffinity),now:Date.now,
    runtime:async(request,c,parent)=>new ParentProfileSaveRuntime({enabled:true,backend,registry:p.registry,
      authenticate:async()=>{
        const current=await p.parent(request);
        if(current?.subject!==parent.subject||current.session!==parent.session)return null;
        const caller=await p.authenticate(request,c,parent);
        if(caller?.parent?.subject!==parent.subject||caller.parent.sessionBinding!==parent.session)return null;
        return {...caller,selectionConfirmed:true,confirmedTransferRef:c.source.transferRef,confirmedAccountContextRef:c.contextCandidateRef};
      }})};
}
