export const statusLabels = { pending: "بانتظار تأكيد المطعم", preparing: "في المطبخ", ready: "جاهز للاستلام", out_for_delivery: "بالطريق إليك", completed: "تم التسليم", cancelled: "ملغي" } as const;
export type OrderStatus = keyof typeof statusLabels;
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = { pending: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["out_for_delivery", "completed", "cancelled"], out_for_delivery: ["completed", "cancelled"], completed: [], cancelled: [] };
export type OrderEvent = { status: OrderStatus; at: number };
export type OrderReceipt = { code: string; total: number; createdAt: number };
export type DeliveryArea = { id: string; name: string; fee: number };
