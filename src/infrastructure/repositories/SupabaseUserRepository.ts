import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';
import { log } from 'node:console';

export class SupabaseUserRepository implements IUserRepository {
    private supabase: SupabaseClient;

    constructor() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY;

        if (!url || !key) {
            throw new Error('❌ Las variables SUPABASE_URL y SUPABASE_KEY son obligatorias en el .env');
        }

        this.supabase = createClient(url, key);
    }

    async findByExternalId(externalId: string | number): Promise<User | null> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('telegram_id', externalId)
            .maybeSingle();

        if (error || !data) return null;

        return {
            id: data.id,
            externalId: data.telegram_id,
            externalUsername: data.telegram_username,
            createdAt: new Date(data.created_at)
        };
    }

    async findByExternalUsername(username: string): Promise<User | null> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .ilike('telegram_username', `%${username}%`)
            .maybeSingle();

        if (error || !data) return null;
        
        return {
            id: data.id,
            externalId: data.telegram_id,
            externalUsername: data.telegram_username,
            createdAt: new Date(data.created_at)
        };
    }

    async linkExternalId(userId: string, externalId: string | number): Promise<void> {
        const { error } = await this.supabase
            .from('users')
            .update({ telegram_id: externalId })
            .eq('id', userId);

        if (error) {
            throw new Error(`❌ Error al vincular external_id: ${error.message}`);
        }
    }

    
    async checkSubscription(userId: string, serviceName: string): Promise<boolean> {
        // Consulta relacional: busca si existe una suscripción activa vinculando las 3 tablas
        const { data, error } = await this.supabase
            .from('subscriptions')
            .select(`
                is_active,
                expires_at,
                services!inner(name)
            `)
            .eq('user_id', userId)
            .eq('services.name', serviceName)
            .eq('is_active', true)
            .maybeSingle();
            
        if (error || !data) return false;

        // Validar si la suscripción tiene fecha de expiración y si ya venció
        const subscriptionData = data as any;
        if (subscriptionData.expires_at) {
            const expirationDate = new Date(subscriptionData.expires_at);
            if (expirationDate < new Date()) {
                return false; // Suscripción vencida
            }
        }

        return true;
    }

    async obtenerIdentidadesPermitidas(): Promise<{ ids: number[], usernames: string[] }> {
        const { data, error } = await this.supabase
            .from('users')
            .select('telegram_id, telegram_username');
            
        if (error || !data) {
            console.error('❌ Error obteniendo lista blanca de Supabase:', error?.message);
            return { ids: [], usernames: [] };
        }

        const ids = data.filter(u => u.telegram_id !== null).map(u => Number(u.telegram_id));
        const usernames = data.map(u => u.telegram_username);

        return { ids, usernames };
    }
}