export type StarterRecipeId =
  | "summary"
  | "action_items"
  | "study_notes"
  | "status_brief";

export interface StarterRecipe {
  id: StarterRecipeId;
  title: string;
  description: string;
  prompt: string;
  previewSummary: string;
  workflowName: string;
}

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    id: "summary",
    title: "Create summary file",
    description: "Reads each matching file and creates a summary result.",
    prompt:
      "Summarize the trigger file into concise bullet points, call out the main ideas, and end with a short takeaway section.",
    previewSummary:
      "Summarizes each matching document into concise bullets and a short takeaway.",
    workflowName: "GPT-OSS Summary Starter",
  },
  {
    id: "action_items",
    title: "Extract tasks from file",
    description: "Finds action items, owners, and deadlines.",
    prompt:
      "Extract action items from the trigger file. Organize them into tasks, owners, deadlines, and open questions. If something is missing, say so clearly.",
    previewSummary:
      "Pulls tasks, owners, deadlines, and next steps out of each matching document.",
    workflowName: "GPT-OSS Action Items Starter",
  },
  {
    id: "study_notes",
    title: "Turn file into study notes",
    description: "Creates structured notes from the file contents.",
    prompt:
      "Turn the trigger file into structured study notes with sections for key concepts, supporting details, examples, and a quick review list.",
    previewSummary:
      "Converts each matching document into structured study notes and review bullets.",
    workflowName: "GPT-OSS Study Notes Starter",
  },
  {
    id: "status_brief",
    title: "Create status brief from file",
    description: "Creates a short status update from the file.",
    prompt:
      "Draft a short status brief from the trigger file with current state, important updates, risks, and recommended next steps.",
    previewSummary:
      "Creates an executive-style status brief for each matching document.",
    workflowName: "GPT-OSS Status Brief Starter",
  },
];

export const DEFAULT_STARTER_RECIPE_ID: StarterRecipeId = "summary";

export function getStarterRecipeById(id: StarterRecipeId): StarterRecipe {
  return (
    STARTER_RECIPES.find((recipe) => recipe.id === id) ?? STARTER_RECIPES[0]
  );
}
