export const MY_TRUSTHUB_GUEST_VERSION = "mytrusthub-guest/v1" as const;
export const MY_TRUSTHUB_GUEST_MAX_BYTES = 256 * 1024;
export const MY_TRUSTHUB_GUEST_MAX_AGE_DAYS = 90;

export type TrustHub =
  | "move"
  | "lender"
  | "insurance"
  | "contractor"
  | "senior"
  | "investor";

export type LifeEventType =
  | "buying_home"
  | "moving"
  | "aging_parent"
  | "contractor"
  | "protecting"
  | "adviser_research"
  | "blank";

export type ProjectStatus = "active" | "completed" | "archived";
export type IdentityResolutionState = "accepted" | "review_required";

export interface GuestSavedEntityItem {
  client_item_id: string;
  item_type: "saved_entity";
  hub: TrustHub;
  specialist_entity_type: string;
  specialist_entity_id: string;
}

export interface GuestPayloadV1 {
  version: typeof MY_TRUSTHUB_GUEST_VERSION;
  generated_at: string;
  expires_at: string;
  items: GuestSavedEntityItem[];
}

export type GuestPreviewStatus =
  | "accepted"
  | "duplicate"
  | "review_required"
  | "unresolved"
  | "invalid";

export interface GuestImportPreviewItem {
  client_item_id: string;
  item_status: GuestPreviewStatus;
  valid: boolean;
  importable: boolean;
  binding_id: string | null;
  network_entity_id: string | null;
  existing_saved_entity_id: string | null;
  project_assignment_eligible: boolean;
}

export interface SaveEntityInput {
  bindingId: string;
  sourceHub?: TrustHub;
  sourceContext?: Record<string, unknown>;
}

export interface CreateProjectInput {
  idempotencyKey: string;
  name: string;
  lifeEventType: LifeEventType;
  locationContext?: Record<string, string>;
  targetDate?: string;
}

export interface CommitGuestImportInput {
  payload: GuestPayloadV1;
  selectedItemIds: string[];
  idempotencyKey: string;
  projectId?: string;
}

/**
 * Parent control-plane contract for P12. Implementations call the narrow
 * consumer-schema functions from a same-origin server. No specialist browser
 * receives broad consumer-table or service-role access.
 */
export interface MyTrustHubResearchService {
  saveEntity(input: SaveEntityInput): Promise<string>;
  removeSavedEntity(savedEntityId: string, expectedVersion: number): Promise<number>;
  listSavedEntities(): Promise<unknown[]>;
  createProject(input: CreateProjectInput): Promise<string>;
  listProjects(): Promise<unknown[]>;
  addMembership(projectId: string, savedEntityId: string, role?: string): Promise<boolean>;
  removeMembership(projectId: string, savedEntityId: string): Promise<boolean>;
  createNote(input: {
    idempotencyKey: string;
    projectId?: string;
    savedEntityId?: string;
    noteType: "general" | "research" | "reminder";
    body: string;
  }): Promise<string>;
  updateNote(noteId: string, expectedVersion: number, noteType: "general" | "research" | "reminder", body: string): Promise<number>;
  deleteNote(noteId: string): Promise<boolean>;
  previewGuestImport(payload: GuestPayloadV1): Promise<GuestImportPreviewItem[]>;
  commitGuestImport(input: CommitGuestImportInput): Promise<{
    importId: string;
    submitted: number;
    imported: number;
    duplicates: number;
    rejected: number;
  }>;
}
