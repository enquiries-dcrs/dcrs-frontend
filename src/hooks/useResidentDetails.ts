import { useEffect, useMemo, useState } from "react";

export type Medication = {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  stockCount: number;
};

export type DailyNote = {
  id: string;
  time: string;
  author: string;
  text: string;
};

export type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string;
};

export type DetailedResident = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  nhs_number: string | null;
  status: string | null;
  legal_hold?: boolean | null;

  room_number: string | null;
  unit_name: string | null;
  home_name: string | null;

  medications: Medication[];
  dailyNotes: DailyNote[];
  tasks: Task[];
  observations: unknown[];
  documents: unknown[];
  reconciliations: unknown[];
  incidents: unknown[];
};

type ResidentDetailsState =
  | { status: "idle"; resident: DetailedResident | null }
  | { status: "loading"; resident: DetailedResident | null }
  | { status: "ok"; resident: DetailedResident; error: null }
  | { status: "error"; resident: DetailedResident | null; error: string };

export function useResidentDetails(residentId: string | null) {
  const [state, setState] = useState<ResidentDetailsState>({
    status: "idle",
    resident: null,
  });

  const apiBase = useMemo(() => "http://localhost:4000", []);

  useEffect(() => {
    const ctrl = new AbortController();

    const run = async () => {
      if (!residentId) {
        setState({ status: "idle", resident: null });
        return;
      }

      try {
        setState({ status: "loading", resident: null });

        const res = await fetch(`${apiBase}/api/v1/residents/${residentId}`, {
          signal: ctrl.signal,
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as DetailedResident;
        setState({ status: "ok", resident: data, error: null });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({
          status: "error",
          resident: null,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    };

    void run();
    return () => ctrl.abort();
  }, [apiBase, residentId]);

  return state;
}

