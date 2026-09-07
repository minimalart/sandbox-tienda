import type { GiftCardConfigV1 } from '../../lib/gift-cards-shared';
import type { GiftCardSettingsRow } from './types';
/** Converts a store-local wall clock value to an instant without adding a runtime dependency. */
export declare function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date;
export declare function resolveScheduledAt(delivery: GiftCardConfigV1['delivery'], settings: GiftCardSettingsRow, now?: Date): Date | null;
