import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  dailyNotes: Array<{ id: string; text: string; time: string; author: string }>;
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
    type: string;
    value: string;
    unit: string;
    time: string;
    date: string;
    author: string;
  }>;
}

export function useResident(residentId: string | null) {
  return useQuery<ResidentDetail>({
    queryKey: ["resident", residentId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}`);
      return data as ResidentDetail;
    },
    enabled: !!residentId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
}

