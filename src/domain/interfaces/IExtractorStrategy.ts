export interface ExtractorResult {
    code: string;
    emailUid: number;
}

export interface IExtractorStrategy {
    providerName: string;
    extractOTP(): Promise<ExtractorResult | null>;
}