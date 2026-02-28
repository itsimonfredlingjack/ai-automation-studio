import type { SetupTrack } from "@/types/setup";

export type SetupTrackAvailability = "coming_soon" | "available";

export interface SetupTrackDefinition {
  id: SetupTrack;
  title: string;
  subtitle: string;
  availability: SetupTrackAvailability;
  label: string;
  examples: string[];
  ctaLabel: string;
}

export const SETUP_TRACKS: SetupTrackDefinition[] = [
  {
    id: "organize_files",
    title: "Organize files",
    subtitle: "Sort files into the right folders automatically.",
    availability: "available",
    label: "Available now",
    examples: [
      "Sort files into the right folders",
      "Send PDFs to project folders",
      "Keep incoming files organized automatically",
    ],
    ctaLabel: "Use file sorting now",
  },
  {
    id: "understand_contents",
    title: "Understand file contents",
    subtitle: "Read matching files and create useful result files automatically.",
    availability: "available",
    label: "Available now",
    examples: [
      "Create summary files",
      "Extract tasks from files",
      "Turn files into study notes",
    ],
    ctaLabel: "Use available GPT-OSS processing",
  },
];

export function getSetupTrackById(id: SetupTrack): SetupTrackDefinition {
  return SETUP_TRACKS.find((track) => track.id === id) ?? SETUP_TRACKS[1];
}
