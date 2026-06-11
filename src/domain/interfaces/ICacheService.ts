export interface ICacheService {
    hasActiveRequest(userId: number): boolean;
    addActiveRequest(userId: number): void;
    removeActiveRequest(userId: number): void;
    getLastClickTime(userId: number): number;
    setLastClickTime(userId: number, timestamp: number): void;
}