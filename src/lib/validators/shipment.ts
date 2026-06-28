import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Формат даты: ГГГГ-ММ-ДД")
  .nullable()
  .optional();

export const updateShipmentSchema = z.object({
  purchaseDate: optionalDate,
  shippingDate: optionalDate,
  expectedArrival: optionalDate,
  actualArrival: optionalDate,
  customsCompleted: optionalDate,
});

export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shipmentInputToData(input: UpdateShipmentInput) {
  return {
    purchaseDate: parseDate(input.purchaseDate),
    shippingDate: parseDate(input.shippingDate),
    expectedArrival: parseDate(input.expectedArrival),
    actualArrival: parseDate(input.actualArrival),
    customsCompleted: parseDate(input.customsCompleted),
  };
}

export function shipmentToInput(shipment: {
  purchaseDate: Date | null;
  shippingDate: Date | null;
  expectedArrival: Date | null;
  actualArrival: Date | null;
  customsCompleted: Date | null;
}) {
  const toDateString = (value: Date | null) =>
    value ? value.toISOString().slice(0, 10) : null;

  return {
    purchaseDate: toDateString(shipment.purchaseDate),
    shippingDate: toDateString(shipment.shippingDate),
    expectedArrival: toDateString(shipment.expectedArrival),
    actualArrival: toDateString(shipment.actualArrival),
    customsCompleted: toDateString(shipment.customsCompleted),
  };
}
