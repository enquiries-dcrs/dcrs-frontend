/**
 * DCRS Production Offline Sync Engine
 * Phase B: PWA Offline Foundation
 * * Handles IndexedDB queueing, idempotency, background syncing, 
 * and spec-compliant conflict resolution for the React frontend.
 */

export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

/** Arbitrary JSON-shaped payload stored for queued mutations. */
export type SyncPayload = Record<string, unknown>;

/** Minimal 409 conflict body shape from POST /api/v1/sync. */
type ConflictServerBody = {
  current_state?: { status?: string };
};

export interface SyncJob {
  client_generated_id: string; // Idempotency key
  entity_type: 'Note' | 'Observation' | 'Task' | 'MedicationAdmin' | 'ResidentDemographics' | 'Incident';
  entity_id: string | null;
  operation_type: OperationType;
  payload_json: SyncPayload;
  sync_status: SyncStatus;
  queued_at: string;
  synced_at: string | null;
  failed_at: string | null;
  conflict_reason?: string;
}

const DB_NAME = 'DCRS_Offline_DB';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync_queue';
const STORE_CACHE = 'read_cache';

class OfflineSyncEngine {
  private db: IDBDatabase | null = null;
  private isSyncing: boolean = false;
  private started: boolean = false;

  constructor() {
    // Intentionally do not touch `window` / `indexedDB` here.
    // Next.js will evaluate modules on the server during render/build.
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) return;
    if (typeof window === "undefined") return;

    this.started = true;
    await this.initDB();
    this.setupNetworkListeners();
  }

  /**
   * Quick queue summary for UI/debug panels.
   */
  public async getQueueCounts(): Promise<Record<SyncStatus, number>> {
    await this.ensureStarted();
    if (!this.db) return { PENDING: 0, SYNCED: 0, CONFLICT: 0, FAILED: 0 };

    const statuses: SyncStatus[] = ["PENDING", "SYNCED", "CONFLICT", "FAILED"];
    const entries = await Promise.all(
      statuses.map(async (s) => [s, (await this.getJobsByStatus(s)).length] as const),
    );
    return Object.fromEntries(entries) as Record<SyncStatus, number>;
  }

  /**
   * Initializes the IndexedDB instance for local queuing and caching.
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Outbound mutation queue
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'client_generated_id' });
          queueStore.createIndex('sync_status', 'sync_status', { unique: false });
          queueStore.createIndex('queued_at', 'queued_at', { unique: false });
        }

        // Inbound read-only cache (for Residents, Beds, etc. during offline mode)
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'cache_key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB initialization failed:", event);
        reject();
      };
    });
  }

  /**
   * Listens for browser network events to automatically trigger synchronization.
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log("[Sync Engine] Device online. Processing offline queue...");
      this.syncPendingMutations();
    });
  }

  /**
   * Queues a mutation locally when the app is offline or optimistically saving.
   * Uses crypto.randomUUID() for replay-safe idempotency.
   */
  public async queueMutation(
    entity_type: SyncJob['entity_type'],
    entity_id: string | null,
    operation_type: OperationType,
    payload_json: SyncPayload
  ): Promise<string> {
    await this.ensureStarted();
    if (!this.db) {
      throw new Error("Offline sync engine not available (IndexedDB not initialized).");
    }

    const jobId = crypto.randomUUID();
    const job: SyncJob = {
      client_generated_id: jobId,
      entity_type,
      entity_id,
      operation_type,
      payload_json,
      sync_status: 'PENDING',
      queued_at: new Date().toISOString(),
      synced_at: null,
      failed_at: null
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORE_QUEUE);
      const request = store.add(job);

      request.onsuccess = () => {
        window.dispatchEvent(
          new CustomEvent("dcrs-sync-queued", {
            detail: { client_generated_id: jobId, entity_type, entity_id, operation_type },
          }),
        );

        // Attempt immediate sync if we believe we are online
        if (navigator.onLine) this.syncPendingMutations();
        resolve(jobId);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Processes all pending jobs in the IndexedDB queue.
   */
  public async syncPendingMutations(): Promise<void> {
    await this.ensureStarted();
    if (typeof navigator === "undefined") return;
    if (this.isSyncing || !navigator.onLine || !this.db) return;
    this.isSyncing = true;

    try {
      const pendingJobs = await this.getJobsByStatus('PENDING');
      
      // Sort chronologically to maintain event order
      pendingJobs.sort((a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime());

      for (const job of pendingJobs) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error("[Sync Engine] Sync cycle failed:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sends an individual job to the backend API and handles the response.
   */
  private async processJob(job: SyncJob): Promise<void> {
    try {
      // DCRS Production API endpoint for processing sync envelopes
      // Default to the Express backend port used in this project.
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_BASE_URL}/api/v1/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': job.client_generated_id,
          // 'Authorization': `Bearer ${token}` -> Handled by generic API interceptor in reality
        },
        body: JSON.stringify(job)
      });

      if (response.ok) {
        await this.updateJobStatus(job.client_generated_id, 'SYNCED');
      } else if (response.status === 409) {
        // 409 Conflict: Trigger the Spec-compliant conflict resolution
        const serverState = (await response.json()) as ConflictServerBody;
        await this.handleConflict(job, serverState);
      } else {
        // 5xx or 4xx other errors (Bad Request)
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      console.warn(`[Sync Engine] Job ${job.client_generated_id} failed. Will retry.`, error);
      const message =
        error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(job.client_generated_id, 'FAILED', message);
    }
  }

  /**
   * Implements the strict conflict resolution rules defined in Spec Section 5.3.
   */
  private async handleConflict(localJob: SyncJob, serverResponse: ConflictServerBody): Promise<void> {
    let resolutionAction: 'APPEND_SAFELY' | 'LATEST_WINS' | 'MANUAL_INTERVENTION' | 'EXPLICIT_DIALOG' = 'MANUAL_INTERVENTION';

    switch (localJob.entity_type) {
      case 'Note':
      case 'Observation':
      case 'Incident':
        // Spec: "Notes/Observations: append safely." (Never silently merge/overwrite historical logs)
        resolutionAction = 'APPEND_SAFELY';
        break;

      case 'Task':
        // Spec: "Tasks: last valid completion wins unless already completed by another actor"
        const serverTaskStatus = serverResponse.current_state?.status;
        if (serverTaskStatus === 'Completed') {
          resolutionAction = 'MANUAL_INTERVENTION'; // Already done by someone else
        } else {
          resolutionAction = 'LATEST_WINS';
        }
        break;

      case 'MedicationAdmin':
        // Spec: "Medication administration: never silent-merge; must reconcile if server has competing write"
        resolutionAction = 'MANUAL_INTERVENTION';
        break;

      case 'ResidentDemographics':
        // Spec: "Resident demographics: server-authoritative, explicit conflict dialog"
        resolutionAction = 'EXPLICIT_DIALOG';
        break;
    }

    if (resolutionAction === 'APPEND_SAFELY' || resolutionAction === 'LATEST_WINS') {
      // Modify payload to force an overwrite or append, and re-queue
      console.log(`[Sync Engine] Auto-resolving conflict for ${localJob.entity_type} via ${resolutionAction}`);
      localJob.payload_json = {
        ...localJob.payload_json,
        _force_resolution: resolutionAction,
      };
      await this.processJob(localJob); // Retry immediately with override flags
    } else {
      // Push to the UI's Conflict Resolution Queue for human review
      console.warn(`[Sync Engine] Manual conflict resolution required for ${localJob.entity_type}`);
      await this.updateJobStatus(localJob.client_generated_id, 'CONFLICT', 'Requires clinical human review');
      
      // Dispatch custom event to React to show the UI Warning Toast
      window.dispatchEvent(new CustomEvent('dcrs-sync-conflict', { detail: localJob }));
    }
  }

  // --- IndexedDB Utility Wrappers ---

  private async getJobsByStatus(status: SyncStatus): Promise<SyncJob[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_QUEUE], 'readonly');
      const store = transaction.objectStore(STORE_QUEUE);
      const index = store.index('sync_status');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async updateJobStatus(jobId: string, status: SyncStatus, errorReason?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORE_QUEUE);
      const getRequest = store.get(jobId);

      getRequest.onsuccess = () => {
        const job: SyncJob = getRequest.result;
        job.sync_status = status;
        if (status === 'SYNCED') job.synced_at = new Date().toISOString();
        if (status === 'FAILED' || status === 'CONFLICT') {
           job.failed_at = new Date().toISOString();
           job.conflict_reason = errorReason;
        }
        
        const putRequest = store.put(job);
        putRequest.onsuccess = () => {
          window.dispatchEvent(
            new CustomEvent("dcrs-sync-status", {
              detail: { client_generated_id: jobId, sync_status: status, conflict_reason: errorReason },
            }),
          );
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

// Export a singleton instance to be used across the React app
export const SyncEngine = new OfflineSyncEngine();