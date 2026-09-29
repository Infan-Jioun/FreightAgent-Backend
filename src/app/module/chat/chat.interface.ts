export interface ISendMessagePayload {
    content: string;
}

export interface ICreateConversationPayload {
    shipmentId: string;
}

export interface IChatParticipant {
    id: string;
    name: string;
    role: string;
    image: string | null;
    email?: string;
}

export interface IConversationSummary {
    id: string;
    shipmentId: string | null;
    customerId: string;
    agentId: string;
    lastMessage: string | null;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
    customer: IChatParticipant;
    agent: IChatParticipant;
    shipment?: {
        id: string;
        trackingId: string;
        origin: string;
        destination: string;
        status: string;
    } | null;
    unreadCount?: number;
}

export interface IEditMessagePayload {
    content: string;
}

export interface IConversationMessageItem {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    isRead: boolean;
    isEdited: boolean;
    createdAt: Date;
    updatedAt: Date;
    sender: IChatParticipant;
}
