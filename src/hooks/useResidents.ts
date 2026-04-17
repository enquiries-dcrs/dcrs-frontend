import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Resident = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  nhs_number: string | null;
  status: string | null;
  room_number: string | null;
  unit_name: string | null;
  home_name: string | null;
  home_id: string | null;
  profile_image_url?: string | null;
};

export function useResidents() {
  return useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const res = await api.get<Resident[]>("/api/v1/residents");
      return res.data;
    },
  });
}

