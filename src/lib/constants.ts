export const STATUSES = ["open", "in_progress", "waiting", "resolved"] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type Priority = (typeof PRIORITIES)[number]
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}
export const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

export const SENTIMENTS = ["positive", "neutral", "negative"] as const
export type Sentiment = (typeof SENTIMENTS)[number]
export const SENTIMENT_EMOJI: Record<Sentiment, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😠",
}

export const INTENTS = [
  "order_tracking",
  "shipping_info",
  "return_request",
  "refund_request",
  "billing",
  "cancellation",
  "account_access",
  "technical_issue",
  "product_question",
  "complaint",
  "feedback",
  "general_inquiry",
] as const
export type Intent = (typeof INTENTS)[number]

export const CATEGORIES = ["Shipping", "Returns & Refunds", "Billing", "Account", "Technical", "Product", "General"] as const
export type Category = (typeof CATEGORIES)[number]

export const INTENT_CATEGORY: Record<Intent, Category> = {
  order_tracking: "Shipping",
  shipping_info: "Shipping",
  return_request: "Returns & Refunds",
  refund_request: "Returns & Refunds",
  billing: "Billing",
  cancellation: "Billing",
  account_access: "Account",
  technical_issue: "Technical",
  product_question: "Product",
  complaint: "General",
  feedback: "General",
  general_inquiry: "General",
}

export const KB_CATEGORIES = [
  "Product Documentation",
  "Refund Policy",
  "Shipping Policy",
  "FAQ",
  "Account Help",
  "Troubleshooting",
] as const

export function isStatus(v: unknown): v is Status {
  return STATUSES.includes(v as Status)
}
export function isPriority(v: unknown): v is Priority {
  return PRIORITIES.includes(v as Priority)
}

export function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
