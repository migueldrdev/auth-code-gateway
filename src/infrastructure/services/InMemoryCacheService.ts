import { ICacheService } from '../../domain/interfaces/ICacheService';

export class InMemoryCacheService implements ICacheService {
    private activeRequests = new Set<number>();
    private cooldowns = new Map<number, number>();

    hasActiveRequest(userId: number): boolean {
        return this.activeRequests.has(userId);
    }

    addActiveRequest(userId: number): void {
        this.activeRequests.add(userId);
    }

    removeActiveRequest(userId: number): void {
        this.activeRequests.delete(userId);
    }

    getLastClickTime(userId: number): number {
        return this.cooldowns.get(userId) || 0;
    }

    setLastClickTime(userId: number, timestamp: number): void {
        this.cooldowns.set(userId, timestamp);
    }
}