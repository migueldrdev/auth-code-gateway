export interface IAccessLogRepository {
    // 1. Inicia el registro cuando el usuario pide el código
    createLog(userId: string, serviceName: string): Promise<string>; 
    
    // 2. Actualiza el resultado final
    updateLog(logId: string, status: 'SUCCESS' | 'TIMEOUT' | 'ERROR', otpCode?: string, emailUid?: number): Promise<void>;
    
    // 3. Verifica cuántos códigos ha pedido hoy (Límite de negocio)
    getSuccessCountToday(userId: string, serviceName: string): Promise<number>;
    
    // 4. Verifica si un correo ya fue leído y entregado a otra persona (Anticolisión)
    wasEmailUsed(emailUid: number): Promise<boolean>;
}