// Validated with the dataviz palette checker (light surface): categorical slots 1-2 pass
// every CVD / normal-vision / contrast gate. Sentiment uses the diverging blue↔red pair with
// a gray midpoint; the gray is under 3:1 so sentiment always ships with visible % labels.
export const SERIES = { 1: "#2a78d6", 2: "#eb6834" } as const

export const SENTIMENT_COLOR = { positive: "#2a78d6", neutral: "#8a8983", negative: "#e34948" } as const

export const AXIS = { tick: "#6b6a65", grid: "#ebeae6" } as const
