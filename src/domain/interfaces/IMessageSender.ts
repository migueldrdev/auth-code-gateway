export interface IMessageSender {
    sendMessage(message: string): Promise<void>;
    showPopup(message?: string): Promise<void>;
    notifyAdmin(message: string): Promise<void>;
}