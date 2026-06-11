import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository';
import { SupabaseAccessLogRepository } from '../repositories/SupabaseAccessLogRepository';
import { NetflixExtractor } from '../services/NetflixExtractor';
import { PrimeVideoExtractor } from '../services/PrimeVideoExtractor';
import { InMemoryCacheService } from '../services/InMemoryCacheService';
import { AuthorizeUserUseCase } from '../../application/use-cases/AuthorizeUserUseCase';
import { GetAuthCodeUseCase } from '../../application/use-cases/GetAuthCodeUseCase';
import { ServiceController } from '../bot/controllers/ServiceController';

// 1. Repositories & Services
const userRepository = new SupabaseUserRepository();
const logRepository = new SupabaseAccessLogRepository();
const cacheService = new InMemoryCacheService();

// 2. Use Cases
const authorizeUseCase = new AuthorizeUserUseCase(userRepository);
const netflixUseCase = new GetAuthCodeUseCase(new NetflixExtractor(), logRepository);
const primeUseCase = new GetAuthCodeUseCase(new PrimeVideoExtractor(), logRepository);

// 3. Controllers
export const netflixController = new ServiceController(
    'netflix', 
    'Netflix', 
    authorizeUseCase, 
    netflixUseCase, 
    logRepository, 
    cacheService
);

export const primeController = new ServiceController(
    'prime_video', 
    'Prime Video', 
    authorizeUseCase, 
    primeUseCase, 
    logRepository, 
    cacheService
);