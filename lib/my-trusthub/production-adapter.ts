import "server-only";

import type { User } from "@supabase/supabase-js";
import { hasMyTrustHubCanaryAccess } from "@/lib/my-trusthub/canary-access";
import { createMyTrustHubSupabaseClient } from "@/lib/supabase/server";

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
type QueryResult = PromiseLike<RpcResult>;
type SelectQuery = QueryResult & { eq(column: string, value: unknown): QueryResult };

interface SchemaApi {
  rpc(name: string, args?: Record<string, unknown>): Promise<RpcResult>;
  from(table: string): {
    select(columns?: string): SelectQuery;
  };
}

interface RuntimeClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: unknown }>;
  };
  schema(name: string): SchemaApi;
}

export interface ProjectListRow {
  project_id: string;
  name: string;
  life_event_type: string;
  status: "active" | "completed" | "archived";
  saved_count: number;
  updated_at: string;
}

export interface SavedEntityRow {
  saved_entity_id: string;
  stored_network_entity_id: string;
  resolved_network_entity_id: string;
  canonical_name: string;
  primary_hub: string;
  identity_resolution_state: "accepted" | "review_required";
  saved_at: string;
  removed_at: string | null;
  project_ids: string[];
}

export interface PrivateNoteRow {
  id: string;
  project_id: string | null;
  saved_entity_id: string | null;
  note_type: "general" | "research" | "reminder";
  body: string;
  row_version: number;
  created_at: string;
  updated_at: string;
}

export interface GuestImportPreviewRow {
  client_item_id: string;
  item_status: "accepted" | "duplicate" | "review_required" | "unresolved" | "invalid";
  valid: boolean;
  importable: boolean;
  binding_id: string | null;
  network_entity_id: string | null;
  existing_saved_entity_id: string | null;
  project_assignment_eligible: boolean;
}

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? (value as T) : null;
}

function fail(error: RpcResult["error"]): never {
  const code = error?.code ? `${error.code}: ` : "";
  throw new Error(
    `My TrustHub data request failed (${code}${error?.message ?? "unknown"})`,
  );
}

export class ProductionMyTrustHubAdapter {
  constructor(private readonly client: RuntimeClient) {}

  static async create(): Promise<ProductionMyTrustHubAdapter | null> {
    const client = await createMyTrustHubSupabaseClient();
    return client
      ? new ProductionMyTrustHubAdapter(client as unknown as RuntimeClient)
      : null;
  }

  async getUser(): Promise<User | null> {
    const result = await this.client.auth.getUser();
    const user = result.data.user;
    return user && hasMyTrustHubCanaryAccess(user) ? user : null;
  }

  private async rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const result = await this.client.schema("consumer").rpc(name, args);
    if (result.error) fail(result.error);
    return result.data as T;
  }

  async listProjects(): Promise<ProjectListRow[]> {
    return rows<ProjectListRow>(await this.rpc("list_projects"));
  }

  async listSavedEntities(): Promise<SavedEntityRow[]> {
    return rows<SavedEntityRow>(await this.rpc("list_saved_entities"));
  }

  async saveEntity(bindingId: string): Promise<string> {
    const result = one<{ saved_entity_id: string }>(
      await this.rpc("save_entity", {
        p_binding_id: bindingId,
        p_source_hub: null,
        p_source_context: {
          purpose: "internal_canary",
          surface: "ask_trust_hub_parent",
        },
      }),
    );
    if (!result?.saved_entity_id) {
      throw new Error("My TrustHub Save returned no identifier");
    }
    return result.saved_entity_id;
  }

  async getProject(projectId: string): Promise<Record<string, unknown> | null> {
    const result = await this.client
      .schema("consumer")
      .from("consumer_projects")
      .select(
        "id,name,life_event_type,status,location_context,target_date,completed_at,archived_at,row_version,created_at,updated_at",
      )
      .eq("id", projectId);
    if (result.error) fail(result.error);
    return one<Record<string, unknown>>(result.data);
  }

  async getProjectMemberships(
    projectId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.client
      .schema("consumer")
      .from("consumer_project_saved_entities")
      .select("project_id,saved_entity_id,project_role,added_at,removed_at")
      .eq("project_id", projectId);
    if (result.error) fail(result.error);
    return rows<Record<string, unknown>>(result.data);
  }

  async createProject(input: {
    creationKey: string;
    name: string;
    lifeEventType: string;
    locationContext?: Record<string, string>;
    targetDate?: string;
  }): Promise<string> {
    return this.rpc("create_project", {
      p_creation_key: input.creationKey,
      p_name: input.name,
      p_life_event_type: input.lifeEventType,
      p_location_context: input.locationContext ?? null,
      p_target_date: input.targetDate ?? null,
    });
  }

  async updateProject(input: {
    projectId: string;
    rowVersion: number;
    name: string;
    locationContext?: Record<string, string>;
    targetDate?: string;
  }): Promise<number> {
    return this.rpc("update_project", {
      p_project_id: input.projectId,
      p_expected_row_version: input.rowVersion,
      p_name: input.name,
      p_location_context: input.locationContext ?? null,
      p_target_date: input.targetDate ?? null,
    });
  }

  async archiveProject(projectId: string, rowVersion: number): Promise<number> {
    return this.rpc("archive_project", {
      p_project_id: projectId,
      p_expected_row_version: rowVersion,
    });
  }

  async restoreProject(projectId: string, rowVersion: number): Promise<number> {
    return this.rpc("restore_project", {
      p_project_id: projectId,
      p_expected_row_version: rowVersion,
    });
  }

  async addSavedEntityToProject(
    projectId: string,
    savedEntityId: string,
  ): Promise<boolean> {
    return this.rpc("add_saved_entity_to_project", {
      p_project_id: projectId,
      p_saved_entity_id: savedEntityId,
      p_project_role: null,
    });
  }

  async removeSavedEntityFromProject(
    projectId: string,
    savedEntityId: string,
  ): Promise<boolean> {
    return this.rpc("remove_saved_entity_from_project", {
      p_project_id: projectId,
      p_saved_entity_id: savedEntityId,
    });
  }


  async listNotes(): Promise<PrivateNoteRow[]> {
    const result = await this.client
      .schema("consumer")
      .from("consumer_notes")
      .select("id,project_id,saved_entity_id,note_type,body,row_version,created_at,updated_at");
    if (result.error) fail(result.error);
    return rows<PrivateNoteRow>(result.data);
  }

  async createNote(input: {
    requestId: string;
    projectId?: string;
    savedEntityId?: string;
    noteType: "general" | "research" | "reminder";
    body: string;
  }): Promise<string> {
    return this.rpc("create_note", {
      p_client_request_id: input.requestId,
      p_project_id: input.projectId ?? null,
      p_saved_entity_id: input.savedEntityId ?? null,
      p_note_type: input.noteType,
      p_body: input.body,
    });
  }

  async updateNote(input: {
    noteId: string;
    rowVersion: number;
    noteType: "general" | "research" | "reminder";
    body: string;
  }): Promise<number> {
    return this.rpc("update_note", {
      p_note_id: input.noteId,
      p_expected_row_version: input.rowVersion,
      p_note_type: input.noteType,
      p_body: input.body,
    });
  }

  async deleteNote(noteId: string): Promise<boolean> {
    return this.rpc("delete_note", { p_note_id: noteId });
  }

  async previewGuestImport(payload: Record<string, unknown>): Promise<GuestImportPreviewRow[]> {
    return rows<GuestImportPreviewRow>(
      await this.rpc("preview_guest_import", { p_payload: payload }),
    );
  }

  async commitGuestImport(input: {
    payload: Record<string, unknown>;
    selectedItemIds: string[];
    idempotencyKey: string;
    projectId?: string;
  }): Promise<Record<string, unknown> | null> {
    return one<Record<string, unknown>>(
      await this.rpc("commit_guest_import", {
        p_payload: input.payload,
        p_selected_item_ids: input.selectedItemIds,
        p_idempotency_key: input.idempotencyKey,
        p_project_id: input.projectId ?? null,
      }),
    );
  }
}
