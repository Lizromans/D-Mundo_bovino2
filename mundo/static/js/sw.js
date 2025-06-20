// Service Worker para notificaciones push
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/static/img/icon-192x192.png', // Cambia por tu icono
            badge: '/static/img/badge-72x72.png', // Cambia por tu badge
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: data.primaryKey || '1'
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Ver más',
                    icon: '/static/img/checkmark.png'
                },
                {
                    action: 'close',
                    title: 'Cerrar',
                    icon: '/static/img/xmark.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'explore') {
        // Abrir la aplicación
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Solo cerrar la notificación
        event.notification.close();
    } else {
        // Clic en la notificación (no en los botones)
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});