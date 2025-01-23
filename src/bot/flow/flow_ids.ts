export const FlowId = {
    INTRO_FLOW: "INTRO_FLOW",
    WITHDRAW_FLOW: "WITHDRAW_FLOW",
    SET_SLIPPAGE_FLOW: "SET_SLIPPAGE_FLOW",
    SELL_FLOW: "SELL_FLOW"
} as const;

export type FlowKeys = keyof typeof FlowId;
export type FlowValues = typeof FlowId[FlowKeys];