// src/services/alertService.js
import { messaging } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { toast } from 'react-toastify';

export const requestNotificationPermission = async () => {
    const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FCM_VAPID_KEY,
    });
    return token;
};

export const listenForAlerts = () => {
    onMessage(messaging, (payload) => {
        toast.warn(payload.notification.body);
    });
};