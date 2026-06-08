export interface IAccessLogRepository {
    // 1. Inicia el registro cuando el usuario pide el código
    crearLog(userId: string, serviceName: string): Promise<string>; 
    
    // 2. Actualiza el resultado final
    actualizarLog(logId: string, status: 'SUCCESS' | 'TIMEOUT' | 'ERROR', otpCode?: string, emailUid?: number): Promise<void>;
    
    // 3. Verifica cuántos códigos ha pedido hoy (Límite de negocio)
    obtenerConteoExitosHoy(userId: string, serviceName: string): Promise<number>;
    
    // 4. Verifica si un correo ya fue leído y entregado a otra persona (Anticolisión)
    fueCorreoUsado(emailUid: number): Promise<boolean>;
}