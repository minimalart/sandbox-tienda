import { guessCountryByPartialPhoneNumber } from "react-international-phone";

export function extractPhoneParts(phone: string): {
  dialCode: string;
  nationalNumber: string;
} {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return { dialCode: "54", nationalNumber: "" };
  }
  const guess = guessCountryByPartialPhoneNumber({ phone });
  if (guess.country) {
    const dc = guess.country.dialCode;
    const national = digits.startsWith(dc) ? digits.slice(dc.length) : digits;
    return { dialCode: dc, nationalNumber: national };
  }
  return { dialCode: "54", nationalNumber: digits };
}
