import { Readable } from 'stream';
/**
 * Convert an array of objects to CSV string
 */
export declare function objectsToCSV<T extends Record<string, unknown>>(data: T[], columns?: string[]): string;
/**
 * Parse CSV string to array of objects
 */
export declare function csvToObjects<T extends Record<string, unknown>>(csvContent: string): T[];
/**
 * Convert a readable stream to string
 */
export declare function streamToString(stream: Readable): Promise<string>;
