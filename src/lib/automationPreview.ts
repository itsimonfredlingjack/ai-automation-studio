import { isGptOssModel } from "@/lib/aiUsage";
import type { Workflow } from "@/types/workflow";

interface PreviewWorkflowNode {
  node_type: string;
  data: Record<string, unknown>;
}

export interface AutomationPreviewOutput {
  label: string;
  path: string;
}

export interface WorkflowPreviewSummary {
  hasAiAgent: boolean;
  gptOssModelsCount: number;
  nonGptOssModelsCount: number;
  usesDocPipeline: boolean;
  usesFileSort: boolean;
  fileSortDestination: string | null;
  hasTextOutput: boolean;
  hasWebhookRespond: boolean;
}

export interface AutomationPreview {
  trigger: string[];
  workflowName: string;
  summary: string;
  instruction: string | null;
  originalFile: string;
  outputs: AutomationPreviewOutput[];
  gptOssCount: number;
  nonGptOssCount: number;
  warning: string | null;
}

interface PreviewBaseParams {
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
}

interface StarterPreviewParams extends PreviewBaseParams {
  workflowName: string;
  instruction: string;
  recipeSummary: string;
}

interface ExistingPreviewParams extends PreviewBaseParams {
  workflow: Workflow;
}

function buildTriggerSummary(params: PreviewBaseParams): string[] {
  return [
    `Watch files in ${params.watchPath || "-"}`,
    params.recursive ? "Includes subfolders" : "Current folder only",
    `Matches ${params.fileGlob || "*.*"}`,
  ];
}

function buildDocPipelineOutputs(): AutomationPreviewOutput[] {
  return [
    {
      label: "Summary Markdown",
      path: "_processed/<basename>.summary.md",
    },
    {
      label: "Run Metadata",
      path: "_processed/<basename>.meta.json",
    },
    {
      label: "Run History",
      path: "Recent Automations",
    },
  ];
}

function buildGenericOutputs(hasTextOutput: boolean): AutomationPreviewOutput[] {
  const outputs: AutomationPreviewOutput[] = [
    {
      label: "Run History",
      path: "Recent Automations",
    },
  ];
  if (hasTextOutput) {
    outputs.unshift({
      label: "Workflow Result",
      path: "Text Output node",
    });
  }
  return outputs;
}

export function summarizeWorkflowForPreview(
  workflow: Workflow
): WorkflowPreviewSummary {
  let gptOssModelsCount = 0;
  let nonGptOssModelsCount = 0;
  let hasAiAgent = false;
  let usesDocPipeline = false;
  let usesFileSort = false;
  let fileSortDestination: string | null = null;
  let hasTextOutput = false;
  let hasWebhookRespond = false;

  for (const node of workflow.nodes as PreviewWorkflowNode[]) {
    if (node.node_type === "ai_agent") {
      hasAiAgent = true;
      const model =
        typeof node.data.model === "string" && node.data.model.trim().length > 0
          ? node.data.model.trim()
          : "";
      if (isGptOssModel(model)) {
        gptOssModelsCount += 1;
      } else {
        nonGptOssModelsCount += 1;
      }
      if (
        node.data.tool_mode === true &&
        node.data.tool_profile === "doc_pipeline_v1"
      ) {
        usesDocPipeline = true;
      }
    }

    if (node.node_type === "text_output") {
      hasTextOutput = true;
    }

    if (node.node_type === "file_sort") {
      usesFileSort = true;
      if (
        typeof node.data.destination_path === "string" &&
        node.data.destination_path.trim().length > 0
      ) {
        fileSortDestination = node.data.destination_path.trim();
      }
    }

    if (node.node_type === "webhook_respond") {
      hasWebhookRespond = true;
    }
  }

  return {
    hasAiAgent,
    gptOssModelsCount,
    nonGptOssModelsCount,
    usesDocPipeline,
    usesFileSort,
    fileSortDestination,
    hasTextOutput,
    hasWebhookRespond,
  };
}

export function buildStarterAutomationPreview(
  params: StarterPreviewParams
): AutomationPreview {
  return {
    trigger: buildTriggerSummary(params),
    workflowName: params.workflowName,
    summary: params.recipeSummary,
    instruction: params.instruction.trim() || null,
    originalFile: "Original file is not changed.",
    outputs: buildDocPipelineOutputs(),
    gptOssCount: 1,
    nonGptOssCount: 0,
    warning: null,
  };
}

export function buildExistingWorkflowPreview(
  params: ExistingPreviewParams
): AutomationPreview {
  const summary = summarizeWorkflowForPreview(params.workflow);
  const warning =
    summary.nonGptOssModelsCount > 0
      ? `Mixed model run: ${summary.nonGptOssModelsCount} node(s) are not using GPT-OSS.`
      : null;

  let actionSummary = "Runs your saved workflow when a matching file appears.";
  let originalFile = "This workflow may not move or organize original files.";
  let outputs = summary.usesDocPipeline
    ? buildDocPipelineOutputs()
    : buildGenericOutputs(summary.hasTextOutput);

  if (summary.usesFileSort) {
    actionSummary = "Moves each matching file into the selected destination folder.";
    originalFile = "Original file is moved into the destination folder.";
    outputs = [
      {
        label: "Moved files",
        path: summary.fileSortDestination ?? "Destination folder",
      },
      {
        label: "Run History",
        path: "Recent Automations",
      },
    ];
  } else if (summary.usesDocPipeline) {
    actionSummary = "Processes each matching file with AI tools and writes standardized artifacts.";
    originalFile = "Original file is not changed.";
  } else if (summary.hasAiAgent) {
    actionSummary = "Runs AI analysis for each matching file and stores the run result in Synapse.";
    originalFile = "Original file may remain unchanged depending on workflow design.";
  } else if (summary.hasWebhookRespond) {
    actionSummary = "Runs the workflow and produces a response for each matching file.";
  }

  return {
    trigger: buildTriggerSummary(params),
    workflowName: params.workflow.name,
    summary: actionSummary,
    instruction: null,
    originalFile,
    outputs,
    gptOssCount: summary.gptOssModelsCount,
    nonGptOssCount: summary.nonGptOssModelsCount,
    warning,
  };
}
