/**
 * Must stay in sync with COMMUNAL_BATHROOM_CHECKLIST_DEF in backend/server.js.
 * Used to render the checklist if the API omits items (older deploy / proxy bug).
 */
export type CommunalBathroomCheckDef = { key: string; label: string; hint: string };

export const COMMUNAL_BATHROOM_CHECKLIST_DEF: CommunalBathroomCheckDef[] = [
  { key: "tile_walls_shower", label: "Wall tiles & shower enclosure", hint: "Scrub; remove soap residue and limescale." },
  { key: "grout_seals", label: "Grout & silicone seals", hint: "Inspect for mould/damage; clean or flag maintenance." },
  { key: "bath_shower_tray", label: "Bath / shower tray", hint: "Descale, disinfect, rinse thoroughly." },
  { key: "toilet_full", label: "Toilet (full deep clean)", hint: "Bowl, rim, seat, hinges, exterior, behind pan where reachable." },
  { key: "sinks_taps", label: "Sinks & taps", hint: "Descale outlets; polish metalware; clear overflow channels." },
  { key: "mirrors_glass", label: "Mirrors & glass", hint: "Streak-free clean; check for cracks." },
  { key: "floor_mop_disinfect", label: "Floors — mop & disinfect", hint: "Behind doors, corners, under furniture edges." },
  { key: "drains_traps", label: "Drains & traps", hint: "Clear hair/debris; check flow; note odours." },
  { key: "extractor_fan", label: "Extractor / ventilation", hint: "Clean cover/grille; confirm operation." },
  { key: "bins_sanitised", label: "Bins & clinical waste points", hint: "Sanitise; fresh liners; lids functioning." },
  { key: "consumables_restock", label: "Consumables restocked", hint: "Soap, paper, hand towels, toilet rolls per home policy." },
  { key: "high_touch_surfaces", label: "High-touch surfaces", hint: "Door handles, rails, flush plates, light switches." },
  { key: "equipment_storage", label: "Equipment & storage", hint: "Hoists / shower chairs / commodes stored clean and dry." },
  { key: "final_inspection", label: "Final visual inspection", hint: "Odour, slip hazards, lighting; sign-off ready." },
];

export type ChecklistItemRow = CommunalBathroomCheckDef & {
  done: boolean;
  completedAt: string | null;
  completedBy: string | null;
};

export function mergeCommunalBathroomItems(
  payload: { items?: ChecklistItemRow[] | null } | undefined
): ChecklistItemRow[] {
  if (!payload) return [];
  const fromApi = Array.isArray(payload.items) ? payload.items : [];
  if (fromApi.length > 0) return fromApi;
  return COMMUNAL_BATHROOM_CHECKLIST_DEF.map((def) => ({
    ...def,
    done: false,
    completedAt: null,
    completedBy: null,
  }));
}
