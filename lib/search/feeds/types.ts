import type { NetworkDiscoveryEntity } from '../discovery/types';
import type { SearchHubId } from '../types';

export type FeedLoadStatus = 'ok' | 'failed';

export type FeedProvenance = {
  hub: SearchHubId;
  local_path: string;
  source_repository: string;
  source_sha: string;
  /** Specialist receiving-contract SHA (SENIOR-002 / INVESTOR-002), when recorded */
  receiving_sha?: string;
  source_artifact: string;
  source_amendment?: string;
  entity_count: number;
  fingerprint: string;
  projection?: string;
  ask_filter?: string;
};

export type FeedValidationIssue = { path: string; message: string };

export type LoadedFeed = {
  hub: SearchHubId;
  status: FeedLoadStatus;
  provenance: FeedProvenance;
  entity_count: number;
  fingerprint: string;
  entities: NetworkDiscoveryEntity[];
  issues: FeedValidationIssue[];
};

export type ActiveDiscoveryBundle = {
  feeds: LoadedFeed[];
  entities: NetworkDiscoveryEntity[];
  counts: Record<string, number>;
  contractor_imported: number;
  contractor_fl_active: number;
};
