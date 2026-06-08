export interface ExtractorResult {
    codigo: string;
    emailUid: number;
}

export interface IExtractorStrategy {
    providerName: string;
    extractOTP(): Promise<ExtractorResult | null>;
}