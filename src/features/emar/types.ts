export type Medication = {
  id: string;
  name: string;
  dose: string;
  route?: string;
  frequency: string;
  stockCount: number;
};

export type MedicationAdministrationStatus = "GIVEN" | "REFUSED" | "OMITTED";

export type MedicationAdministrationPayload = {
  medicationId: string;
  medicationName: string;
  status: MedicationAdministrationStatus;
  administeredAt: string; // ISO timestamp
  notes?: string;
};

