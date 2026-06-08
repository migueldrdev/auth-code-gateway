import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IAccessLogRepository } from '../../domain/interfaces/IAccessLogRepository';

export class SupabaseAccessLogRepository implements IAccessLogRepository {
    private supabase: SupabaseClient;

    constructor() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY; // Recuerda que usamos el service_role key

        if (!url || !key) {
            throw new Error('❌ Variables de Supabase no definidas.');
        }

        this.supabase = createClient(url, key);
    }

    async crearLog(userId: string, serviceName: string): Promise<string> {
        // Primero necesitamos el ID del servicio (Netflix)
        const { data: service } = await this.supabase
            .from('services')
            .select('id')
            .eq('name', serviceName)
            .single();

        if (!service) throw new Error(`Servicio ${serviceName} no encontrado en la BD.`);

        // Insertamos el log en estado PENDING
        const { data, error } = await this.supabase
            .from('access_logs')
            .insert({
                user_id: userId,
                service_id: service.id,
                status: 'PENDING'
            })
            .select('id')
            .single();

        if (error || !data) {
            throw new Error(`Error creando log de acceso: ${error?.message}`);
        }

        return data.id;
    }

    async actualizarLog(logId: string, status: 'SUCCESS' | 'TIMEOUT' | 'ERROR', otpCode?: string, emailUid?: number): Promise<void> {
        const payload: any = { 
            status, 
            resolved_at: new Date().toISOString() 
        };

        if (otpCode) payload.otp_code = otpCode;
        if (emailUid) payload.email_uid = emailUid;

        const { error } = await this.supabase
            .from('access_logs')
            .update(payload)
            .eq('id', logId);

        if (error) {
            console.error(`❌ Error actualizando el log ${logId}:`, error.message);
        }
    }

    async obtenerConteoExitosHoy(userId: string, serviceName: string): Promise<number> {
        // Obtenemos la fecha de hoy a las 00:00:00
        const inicioDeHoy = new Date();
        inicioDeHoy.setHours(0, 0, 0, 0);

        const { data: service } = await this.supabase
            .from('services')
            .select('id')
            .eq('name', serviceName)
            .single();

        if (!service) return 0;

        const { count, error } = await this.supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('service_id', service.id)
            .eq('status', 'SUCCESS')
            .gte('created_at', inicioDeHoy.toISOString());

        if (error) {
            console.error('❌ Error contando accesos de hoy:', error.message);
            return 0;
        }

        return count || 0;
    }

    async fueCorreoUsado(emailUid: number): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('access_logs')
            .select('id')
            .eq('email_uid', emailUid)
            .limit(1);

        if (error) return false;
        return data !== null && data.length > 0;
    }
}