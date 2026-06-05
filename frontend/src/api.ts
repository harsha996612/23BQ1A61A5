import { logger } from './logger';

export interface AppNotification {
    ID: string;
    Type: 'Event' | 'Result' | 'Placement';
    Message: string;
    Timestamp: string;
    isRead?: boolean;
}

// Points to our Express backend (not the external API directly)
const BACKEND_URL = 'http://localhost:5000/api/notifications';

export const fetchNotifications = async (
    page?: number,
    limit?: number,
    notificationType?: string
): Promise<AppNotification[]> => {
    try {
        const params = new URLSearchParams();
        if (page) params.append('page', String(page));
        if (limit) params.append('limit', String(limit));
        if (notificationType) params.append('notification_type', notificationType);

        const url = `${BACKEND_URL}?${params.toString()}`;
        logger.info('Fetching notifications from backend: ' + url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Status ' + response.status);
        }
        const data = await response.json();
        return data.notifications || [];
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to fetch notifications', { error: msg });
        return [];
    }
};

export const fetchPriorityNotifications = async (
    topN: number = 10,
    notificationType?: string
): Promise<AppNotification[]> => {
    try {
        const params = new URLSearchParams();
        params.append('n', String(topN));
        if (notificationType) params.append('notification_type', notificationType);

        const url = `${BACKEND_URL}/priority?${params.toString()}`;
        logger.info('Fetching priority notifications from backend: ' + url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Status ' + response.status);
        }
        const data = await response.json();
        return data.notifications || [];
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to fetch priority notifications', { error: msg });
        return [];
    }
};

export const markAsReadAPI = async (id: string): Promise<boolean> => {
    try {
        const response = await fetch(`${BACKEND_URL}/${id}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            throw new Error('Status ' + response.status);
        }
        logger.info('Notification marked as read via backend: ' + id);
        return true;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to mark notification as read', { error: msg });
        return false;
    }
};
