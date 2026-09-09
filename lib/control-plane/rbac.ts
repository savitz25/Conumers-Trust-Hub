export const ADMIN_ROLES=['SUPER_ADMIN','TRUST_OPS','DATA_OPS','GROWTH','READ_ONLY'] as const;
export type AdminRole=(typeof ADMIN_ROLES)[number];
export const ADMIN_PERMISSIONS=['ADMIN_VIEW','AUDIT_VIEW','STAFF_MANAGE','CONTROL_FLAG_MANAGE','ADMIN_COMMAND_EXECUTE','CLAIM_OPS','DATA_OPS','GROWTH_OPS','BREAK_GLASS_REQUEST'] as const;
export type AdminPermission=(typeof ADMIN_PERMISSIONS)[number];
const grants:Record<AdminRole,readonly AdminPermission[]>={
  SUPER_ADMIN:ADMIN_PERMISSIONS,
  TRUST_OPS:['ADMIN_VIEW','AUDIT_VIEW','CLAIM_OPS','BREAK_GLASS_REQUEST'],
  DATA_OPS:['ADMIN_VIEW','AUDIT_VIEW','CONTROL_FLAG_MANAGE','DATA_OPS','BREAK_GLASS_REQUEST'],
  GROWTH:['ADMIN_VIEW','AUDIT_VIEW','GROWTH_OPS'],
  READ_ONLY:['ADMIN_VIEW','AUDIT_VIEW'],
};
export function hasAdminPermission(role:AdminRole,permission:AdminPermission):boolean{return grants[role].includes(permission)}

export type AdminStaffStatus='ACTIVE'|'DISABLED';
export type AdminIdentity={staffId:string;userId:string;email:string;role:AdminRole;status:AdminStaffStatus;sessionId:string;lastAuthorizedAt:string|null};
