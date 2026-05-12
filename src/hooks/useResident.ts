import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "@/lib/api";
import { throwFormattedApiError } from "@/lib/format-api-error";

export interface ResidentDetail {
  id: string;
  first_name: string;
  last_name: string;
  nhs_number: string;
  date_of_birth: string;
  status: "PENDING" | "ADMITTED" | "DISCHARGED" | "ARCHIVED";
  legal_hold: boolean;
  /** Public URL for identification (chart header, lists). */
  profile_image_url?: string | null;
  room_number?: string | null;
  unit_name?: string | null;
  home_name?: string | null;
  /** Emergency / hospital transfer profile (migration `022_emergency_transfer_profile.sql`). */
  known_allergies?: string | null;
  gp_practice_name?: string | null;
  gp_practice_phone?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  next_of_kin_relationship?: string | null;
  advance_care_notes?: string | null;
  dailyNotes: Array<{ id: string; text: string; time: string; author: string; shareWithFamily?: boolean }>;
  medications: Array<{
    id: string;
    name: string;
    dose: string;
    route?: string;
    frequency: string;
    stockCount: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    /** YYYY-MM-DD when due_date is set (for filters / overdue). */
    dueDateIso?: string | null;
    assignedToId?: string | null;
    assignedToName?: string | null;
  }>;
  observations?: Array<{
    id?: string;
    type: string;
    typeLabel?: string;
    value: string;
    unit: string;
    notes?: string | null;
    recordedAt?: string;
    time: string;
    date: string;
    author: string;
  }>;
}

/** Compare UUIDs case-insensitively (URL segment vs Postgres text can differ in casing). */
function uuidComparable(s: string): string {
  return String(s).replace(/-/g, "").toLowerCase();
}

function normalizeResidentPayload(data: unknown, routeId: string): ResidentDetail {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response from server (not a service user record).");
  }
  const row = data as Record<string, unknown>;
  if (row.id == null) {
    throw new Error("Invalid response from server (not a service user record).");
  }
  const apiId = String(row.id).trim();
  if (uuidComparable(apiId) !== uuidComparable(String(routeId).trim())) {
    throw new Error("Service user id mismatch in API response.");
  }

  const statusRaw = row.status;
  const upper =
    typeof statusRaw === "string" && statusRaw.trim()
      ? statusRaw.trim().toUpperCase()
      : "PENDING";
  const allowed = new Set(["PENDING", "ADMITTED", "DISCHARGED", "ARCHIVED"]);
  const status = (allowed.has(upper) ? upper : "PENDING") as ResidentDetail["status"];

  return {
    ...(row as Record<string, unknown>),
    id: apiId,
    first_name: row.first_name != null ? String(row.first_name) : "",
    last_name: row.last_name != null ? String(row.last_name) : "",
    nhs_number: row.nhs_number != null ? String(row.nhs_number) : "",
    date_of_birth:
      row.date_of_birth != null && String(row.date_of_birth).trim() !== ""
        ? String(row.date_of_birth)
        : "",
    status,
    legal_hold: Boolean(row.legal_hold),
    dailyNotes: Array.isArray(row.dailyNotes) ? (row.dailyNotes as ResidentDetail["dailyNotes"]) : [],
    medications: Array.isArray(row.medications)
      ? (row.medications as ResidentDetail["medications"])
      : [],
    tasks: Array.isArray(row.tasks) ? (row.tasks as ResidentDetail["tasks"]) : [],
    observations: Array.isArray(row.observations)
      ? (row.observations as NonNullable<ResidentDetail["observations"]>)
      : [],
  } as ResidentDetail;
}

export function useResident(residentId: string | null) {
  const canonicalId = residentId?.trim() ?? null;
  return useQuery<ResidentDetail>({
    queryKey: ["resident", canonicalId],
    queryFn: async () => {
      const id = canonicalId;
      if (!id) throw new Error("Missing service user id");
      try {
        const { data } = await api.get(`/api/v1/residents/${id}`);
        return normalizeResidentPayload(data, id);
      } catch (err) {
        throwFormattedApiError(err);
      }
    },
    enabled: !!canonicalId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    retry: (failureCount, err) => {
      if (axios.isAxiosError(err)) {
        const s = err.response?.status;
        if (s != null && s >= 400 && s < 500 && s !== 408 && s !== 429) {
          return false;
        }
      }
      return failureCount < 2;
    },
  });
}

