import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class BlogCacheService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly dbName = 'fleximagepro-blog-cache';
  private readonly storeName = 'entries';
  private dbPromise?: Promise<IDBDatabase>;

  async get<T>(key: string): Promise<T | null> {
    if (!this.browser) return null;
    const db = await this.openDb();
    return new Promise((resolve) => {
      const request = db.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(key);
      request.onsuccess = () => resolve((request.result?.value as T) ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.browser) return;
    const db = await this.openDb();
    await new Promise<void>((resolve) => {
      const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put({
        key,
        value,
        updatedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }
}
