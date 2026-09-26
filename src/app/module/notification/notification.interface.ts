import { NotificationType } from "../../../generated/prisma";

export interface ICreateNotificationPayload {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  data?: Record<string, unknown>;
}

export interface IBroadcastNotificationPayload {
  role?: "ADMIN" | "AGENT" | "CUSTOMER";
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  data?: Record<string, unknown>;
}

export interface IGetNotificationQuery {
  page?: number | string;
  limit?: number | string;
  isRead?: string | boolean;
  type?: NotificationType | string;
}
