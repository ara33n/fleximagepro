import { Injectable } from '@angular/core';
import { ImageJob, ToolConfig } from '../models/image-job.model';

interface StoredImageJob {
  id: string;
  name: string;
  type: string;
  originalBlob: Blob;
  originalSize: number;
  width: number;
  height: number;
  status: ImageJob['status'];
  resultBlob?: Blob;
  resultName?: string;
  resultSize?: number;
  resultWidth?: number;
  resultHeight?: number;
  error?: string;
}

interface StoredImageSession {
  id: string;
  toolId: string;
  createdAt: number;
  updatedAt: number;
  jobs: StoredImageJob[];
}

@Injectable({ providedIn: 'root' })
export class ImageSessionService {
  private readonly dbName = 'pixelpress-image-sessions';
  private readonly storeName = 'sessions';
  private readonly version = 1;
  private dbPromise?: Promise<IDBDatabase>;

  createSessionId(): string {
    return crypto.randomUUID();
  }

  async save(sessionId: string, tool: ToolConfig, jobs: ImageJob[]): Promise<void> {
    const session: StoredImageSession = {
      id: sessionId,
      toolId: tool.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        type: job.type,
        originalBlob: job.file,
        originalSize: job.originalSize,
        width: job.width,
        height: job.height,
        status: job.status === 'processing' ? 'queued' : job.status,
        resultBlob: job.resultBlob,
        resultName: job.resultName,
        resultSize: job.resultSize,
        resultWidth: job.resultWidth,
        resultHeight: job.resultHeight,
        error: job.error,
      })),
    };

    const db = await this.openDb();
    await this.request<void>(
      db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(session),
    );
  }

  async restore(sessionId: string, tool: ToolConfig): Promise<ImageJob[]> {
    const db = await this.openDb();
    const session = await this.request<StoredImageSession | undefined>(
      db.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(sessionId),
    );

    if (!session || session.toolId !== tool.id) {
      return [];
    }

    return session.jobs.map((stored) => {
      const file = new File([stored.originalBlob], stored.name, {
        type: stored.type || stored.originalBlob.type,
        lastModified: session.updatedAt,
      });

      return {
        id: stored.id,
        file,
        name: stored.name,
        type: stored.type,
        originalUrl: URL.createObjectURL(stored.originalBlob),
        originalSize: stored.originalSize,
        width: stored.width,
        height: stored.height,
        status: stored.status,
        resultBlob: stored.resultBlob,
        resultUrl: stored.resultBlob ? URL.createObjectURL(stored.resultBlob) : undefined,
        resultName: stored.resultName,
        resultSize: stored.resultSize,
        resultWidth: stored.resultWidth,
        resultHeight: stored.resultHeight,
        error: stored.error,
      };
    });
  }

  async remove(sessionId: string): Promise<void> {
    const db = await this.openDb();
    await this.request<void>(
      db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).delete(sessionId),
    );
  }

  private openDb(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(this.dbName, this.version);

      openRequest.onupgradeneeded = () => {
        openRequest.result.createObjectStore(this.storeName, { keyPath: 'id' });
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () =>
        reject(openRequest.error || new Error('Could not open image session storage.'));
    });

    return this.dbPromise;
  }

  // Accept any IDBRequest result type to avoid incorrect "this" typing between different IDBRequest generic instantiations
  private request<T>(request: IDBRequest<any>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error || new Error('Image session storage failed.'));
    });
  }
}
