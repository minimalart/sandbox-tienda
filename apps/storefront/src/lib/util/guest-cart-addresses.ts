export type GuestCartAddress = {
  id: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  postal_code: string;
  city: string;
  country_code: string;
  province: string;
  phone: string;
  company: string;
  address_name: string;
  latitude?: string;
  longitude?: string;
};

export type GuestCartAddressComparable =
  | {
      id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      address_1?: string | null;
      address_2?: string | null;
      postal_code?: string | null;
      city?: string | null;
      country_code?: string | null;
      province?: string | null;
      phone?: string | null;
      company?: string | null;
    }
  | null
  | undefined;

export type GuestCartAddressesMetadata = {
  addresses: GuestCartAddress[];
  selected_address_id: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const normalizeComparableValue = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() || "";

export const sanitizeGuestCartAddress = (
  address: GuestCartAddress,
): GuestCartAddress => ({
  id: address.id.trim(),
  first_name: address.first_name.trim(),
  last_name: address.last_name.trim(),
  address_1: address.address_1.trim(),
  address_2: address.address_2.trim(),
  postal_code: address.postal_code.trim(),
  city: address.city.trim(),
  country_code: address.country_code.trim().toLowerCase(),
  province: address.province.trim(),
  phone: address.phone.trim(),
  company: address.company.trim(),
  address_name: address.address_name.trim(),
  ...(address.latitude ? { latitude: address.latitude.trim() } : {}),
  ...(address.longitude ? { longitude: address.longitude.trim() } : {}),
});

export const toGuestCartAddressKey = (
  address: GuestCartAddressComparable,
): string => {
  if (!address) {
    return "";
  }

  return [
    normalizeComparableValue(address.first_name),
    normalizeComparableValue(address.last_name),
    normalizeComparableValue(address.address_1),
    normalizeComparableValue(address.address_2),
    normalizeComparableValue(address.postal_code),
    normalizeComparableValue(address.city),
    normalizeComparableValue(address.country_code),
    normalizeComparableValue(address.province),
    normalizeComparableValue(address.phone),
    normalizeComparableValue(address.company),
  ].join("|");
};

export const areGuestCartAddressesEquivalent = (
  left: GuestCartAddressComparable,
  right: GuestCartAddressComparable,
): boolean => {
  const leftKey = toGuestCartAddressKey(left);
  const rightKey = toGuestCartAddressKey(right);

  return leftKey.length > 0 && leftKey === rightKey;
};

export const parseGuestCartAddressesMetadata = (
  metadata: unknown,
): GuestCartAddressesMetadata => {
  const metadataRecord = isRecord(metadata) ? metadata : {};
  const rawAddresses = Array.isArray(metadataRecord.addresses)
    ? metadataRecord.addresses
    : [];

  const addresses = rawAddresses.flatMap((rawAddress) => {
    if (!isRecord(rawAddress)) {
      return [];
    }

    const id = toStringValue(rawAddress.id).trim();
    if (!id) {
      return [];
    }

    return [
      sanitizeGuestCartAddress({
        id,
        first_name: toStringValue(rawAddress.first_name),
        last_name: toStringValue(rawAddress.last_name),
        address_1: toStringValue(rawAddress.address_1),
        address_2: toStringValue(rawAddress.address_2),
        postal_code: toStringValue(rawAddress.postal_code),
        city: toStringValue(rawAddress.city),
        country_code: toStringValue(rawAddress.country_code),
        province: toStringValue(rawAddress.province),
        phone: toStringValue(rawAddress.phone),
        company: toStringValue(rawAddress.company),
        address_name: toStringValue(rawAddress.address_name),
        latitude: toStringValue(rawAddress.latitude),
        longitude: toStringValue(rawAddress.longitude),
      }),
    ];
  });

  const selectedAddressId = toStringValue(
    metadataRecord.selected_address_id,
  ).trim();

  return {
    addresses,
    selected_address_id: selectedAddressId || null,
  };
};

export const buildGuestCartAddressesMetadata = (
  metadata: unknown,
  input: Partial<GuestCartAddressesMetadata>,
): Record<string, unknown> => {
  const metadataRecord = isRecord(metadata) ? metadata : {};
  const currentMetadata = parseGuestCartAddressesMetadata(metadataRecord);

  return {
    ...metadataRecord,
    addresses:
      input.addresses === undefined
        ? currentMetadata.addresses
        : input.addresses,
    selected_address_id:
      input.selected_address_id === undefined
        ? currentMetadata.selected_address_id
        : input.selected_address_id,
  };
};

export const upsertGuestCartAddress = (
  addresses: GuestCartAddress[],
  nextAddress: GuestCartAddress,
): GuestCartAddress[] => {
  const sanitizedAddress = sanitizeGuestCartAddress(nextAddress);
  const nextAddressKey = toGuestCartAddressKey(sanitizedAddress);

  return [
    ...addresses.filter(
      (address) =>
        address.id !== sanitizedAddress.id &&
        toGuestCartAddressKey(address) !== nextAddressKey,
    ),
    sanitizedAddress,
  ];
};

export const findMatchingGuestCartAddress = (
  addresses: GuestCartAddress[],
  targetAddress: GuestCartAddressComparable,
): GuestCartAddress | null =>
  addresses.find((address) =>
    areGuestCartAddressesEquivalent(address, targetAddress),
  ) || null;
