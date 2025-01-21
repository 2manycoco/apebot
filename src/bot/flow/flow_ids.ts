export const FlowId = {
    INTRO_FLOW: "INTRO_FLOW",
} as const;

export type FlowKeys = keyof typeof FlowId;
export type FlowValues = typeof FlowId[FlowKeys];