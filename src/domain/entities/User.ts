export interface User {
    id: string;
    externalId: string | number | null; // Antes telegramId
    externalUsername: string;           // Antes telegramUsername
    createdAt: Date;
}