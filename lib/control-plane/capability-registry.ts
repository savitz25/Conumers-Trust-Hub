import type {ControlPlaneHub} from './contracts/common.ts';
export const CAPABILITY_CATEGORIES=['IDENTITY','CREDENTIAL','DISCIPLINE','ENFORCEMENT','INSPECTION','COMPLAINT','OWNERSHIP','FINANCIAL','PUBLICATION','MONITORING','ALERT_PIPELINE'] as const;
export type CapabilityCategory=(typeof CAPABILITY_CATEGORIES)[number];
export type CapabilityDefinition={key:string;hub:ControlPlaneHub;category:CapabilityCategory;sourceSystem:string;sourceDataset:string;jurisdiction:string|null;profileClass:string|null;criticality:'CRITICAL'|'HIGH'|'STANDARD';owner:string;checkCadenceMinutes:number|null;freshnessMinutes:number|null;publicationExpected:boolean;monitoringExpected:boolean;adapter:'ASK_DATABASE'|'SIGNED_CONTRACTOR_FEED'|'CHECKED_IN_ARTIFACT'|'NOT_INSTRUMENTED';reference:string};
const c=(key:string,hub:ControlPlaneHub,category:CapabilityCategory,sourceSystem:string,sourceDataset:string,opts:Partial<CapabilityDefinition>={}):CapabilityDefinition=>({key,hub,category,sourceSystem,sourceDataset,jurisdiction:null,profileClass:null,criticality:'HIGH',owner:`${hub} specialist`,checkCadenceMinutes:null,freshnessMinutes:null,publicationExpected:true,monitoringExpected:false,adapter:'NOT_INSTRUMENTED',reference:'docs/control-plane/DATA_OPERATIONS.md',...opts});
export const NETWORK_CAPABILITIES:readonly CapabilityDefinition[]=[
 c('CONTRACTOR_FL_DBPR_IDENTITY','contractor','IDENTITY','fl_dbpr','licenses',{jurisdiction:'FL',profileClass:'contractor',criticality:'CRITICAL',checkCadenceMinutes:1440,freshnessMinutes:2880,monitoringExpected:true,adapter:'SIGNED_CONTRACTOR_FEED'}),
 c('CONTRACTOR_FL_DBPR_DISCIPLINE','contractor','DISCIPLINE','fl_dbpr','discipline_actions',{jurisdiction:'FL',profileClass:'contractor',criticality:'CRITICAL',checkCadenceMinutes:1440,freshnessMinutes:2880,monitoringExpected:true,adapter:'SIGNED_CONTRACTOR_FEED'}),
 c('CONTRACTOR_PUBLICATION','contractor','PUBLICATION','contractor_publication','published_profiles',{profileClass:'contractor',criticality:'HIGH'}),
 c('MOVE_FMCSA_AUTHORITY','move','CREDENTIAL','fmcsa','carrier_authority',{profileClass:'mover',criticality:'CRITICAL'}),
 c('MOVE_FL_FDACS','move','CREDENTIAL','fl_fdacs','intrastate_movers',{jurisdiction:'FL',profileClass:'mover'}),
 c('MOVE_PUBLICATION','move','PUBLICATION','move_publication','published_movers',{profileClass:'mover'}),
 c('LENDER_NMLS_IDENTITY','lender','IDENTITY','nmls','institutions',{profileClass:'institution',criticality:'CRITICAL'}),
 c('LENDER_HMDA','lender','FINANCIAL','cfpb_hmda','hmda_snapshot',{profileClass:'institution',adapter:'CHECKED_IN_ARTIFACT'}),
 c('LENDER_PUBLICATION','lender','PUBLICATION','lender_publication','public_profiles',{profileClass:'institution'}),
 c('INSURANCE_NAIC_IDENTITY','insurance','IDENTITY','naic','legal_insurers',{profileClass:'legal_insurer',criticality:'CRITICAL'}),
 c('INSURANCE_PUBLICATION','insurance','PUBLICATION','insurance_publication','public_legal_insurers',{profileClass:'legal_insurer'}),
 c('SENIOR_CMS_NURSING_HOME','senior','INSPECTION','cms','nursing_home',{profileClass:'nursing_home',criticality:'CRITICAL'}),
 c('SENIOR_CMS_HOME_HEALTH','senior','INSPECTION','cms','home_health',{profileClass:'home_health',criticality:'CRITICAL'}),
 c('SENIOR_CMS_HOSPICE','senior','INSPECTION','cms','hospice',{profileClass:'hospice',criticality:'CRITICAL'}),
 c('SENIOR_PUBLICATION','senior','PUBLICATION','senior_publication','provider_classes',{}),
 c('INVESTOR_SEC_ADV','investor','IDENTITY','sec_iard','form_adv',{profileClass:'firm',criticality:'CRITICAL',adapter:'CHECKED_IN_ARTIFACT'}),
 c('INVESTOR_PUBLICATION','investor','PUBLICATION','investor_publication','indexable_firms',{profileClass:'firm'}),
 c('ASK_CONTRACTOR_MONITORING','ask','MONITORING','contractor_signed_feed','fl_dbpr_changes',{jurisdiction:'FL',profileClass:'contractor',criticality:'CRITICAL',checkCadenceMinutes:1440,freshnessMinutes:1560,publicationExpected:false,monitoringExpected:true,adapter:'ASK_DATABASE'}),
 c('ASK_NOTIFICATION_GENERATION','ask','ALERT_PIPELINE','ask','ath_notifications',{criticality:'HIGH',publicationExpected:false,monitoringExpected:true,adapter:'ASK_DATABASE'}),
 c('ASK_EMAIL_DISPATCH','ask','ALERT_PIPELINE','resend','ath_notification_deliveries',{criticality:'HIGH',publicationExpected:false,monitoringExpected:true,adapter:'ASK_DATABASE'}),
] as const;
export function capabilityByKey(key:string){return NETWORK_CAPABILITIES.find(c=>c.key===key)}
