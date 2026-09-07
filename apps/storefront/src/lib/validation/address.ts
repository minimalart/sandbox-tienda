import { z } from "zod";
import { phoneSchema } from "./phone";

/**
 * Schema del formulario de dirección (con mapa). Es la fuente de verdad de la
 * validación; el componente sigue manejando su estado de forma imperativa
 * (Google Maps escribe address1/city/province/postalCode/lat/lng), pero la
 * decisión "¿se puede enviar?" la toma este schema vía safeParse.
 *
 * `addressName` viene de un selector (Casa/Trabajo/Otro) + input custom: "Otro"
 * es el estado intermedio sin nombre real, por eso se rechaza.
 */
const baseAddressSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  addressName: z
    .string()
    .min(1, "Elegí o ingresá un nombre para la dirección")
    .refine((v) => v !== "Otro", "Ingresá un nombre personalizado"),
  address1: z.string().min(1, "Ingresá una dirección"),
  address2: z.string(),
  city: z.string().min(1, "Ingresá la ciudad"),
  province: z.string(),
  postalCode: z.string().min(1, "Ingresá el código postal"),
  countryCode: z.string(),
  phone: phoneSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

/**
 * En el checkout los nombres se piden en el paso de info personal, así que el
 * formulario de dirección los oculta (`hideNameFields`) y no deben exigirse.
 */
export const makeAddressSchema = (hideNameFields: boolean) =>
  hideNameFields
    ? baseAddressSchema
    : baseAddressSchema.refine(
        (data) => !!data.firstName && !!data.lastName,
        { message: "Ingresá nombre y apellido", path: ["firstName"] },
      );

export type AddressSchemaInput = z.infer<typeof baseAddressSchema>;
