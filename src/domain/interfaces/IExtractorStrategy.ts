export interface IExtractorStrategy {
    providerName: string;
    extractOTP(): Promise<string | null>;
}