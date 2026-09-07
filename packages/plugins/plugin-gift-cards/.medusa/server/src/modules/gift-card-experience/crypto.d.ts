export declare function hashGiftCardToken(token: string): string;
export declare function encryptGiftCardToken(token: string): string;
export declare function decryptGiftCardToken(value: string): string;
export declare function createGiftCardToken(): {
    token: string;
    hash: string;
    encrypted: string;
};
