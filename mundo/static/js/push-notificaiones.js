// Configuración de notificaciones push - Versión corregida
document.addEventListener('DOMContentLoaded', function() {
    const pushToggle = document.getElementById('push-toggle');
    
    // Verificar soporte del navegador
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Este navegador no soporta notificaciones push');
        if (pushToggle) {
            pushToggle.disabled = true;
        }
        return;
    }
    
    // Registrar service worker primero
    registerServiceWorker().then(() => {
        initializePushNotifications();
    }).catch(error => {
        console.error('Error al registrar service worker:', error);
    });
    
    if (pushToggle) {
        pushToggle.addEventListener('change', function() {
            if (this.checked) {
                enablePushNotifications();
            } else {
                disablePushNotifications();
            }
        });
    }
});

// Registrar service worker
function registerServiceWorker() {
    return navigator.serviceWorker.register('/sw.js') // Asegúrate de tener este archivo
        .then(registration => {
            console.log('Service Worker registrado:', registration);
            return registration;
        })
        .catch(error => {
            console.error('Error al registrar Service Worker:', error);
            throw error;
        });
}

// Inicializar estado de notificaciones
function initializePushNotifications() {
    navigator.serviceWorker.ready.then(function(registration) {
        return registration.pushManager.getSubscription();
    }).then(function(subscription) {
        const pushToggle = document.getElementById('push-toggle');
        if (subscription && pushToggle) {
            pushToggle.checked = true;
            console.log('Ya está suscrito a notificaciones push');
        }
    }).catch(error => {
        console.error('Error al verificar suscripción:', error);
    });
}

function enablePushNotifications() {
    // Solicitar permiso primero
    if (Notification.permission === 'denied') {
        alert('Las notificaciones están bloqueadas. Habilítalas en la configuración del navegador.');
        return;
    }
    
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                subscribeToPush();
            } else {
                alert('Se necesita permiso para mostrar notificaciones');
                document.getElementById('push-toggle').checked = false;
            }
        });
    } else if (Notification.permission === 'granted') {
        subscribeToPush();
    }
}

function subscribeToPush() {
    navigator.serviceWorker.ready.then(function(registration) {
        // Obtener la clave VAPID del servidor o definirla aquí
        const vapidPublicKey = getVapidPublicKey(); // Función que debes implementar
        
        if (!vapidPublicKey) {
            console.error('Clave VAPID no encontrada');
            alert('Error de configuración: clave VAPID no disponible');
            document.getElementById('push-toggle').checked = false;
            return;
        }
        
        return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
    }).then(function(subscription) {
        console.log('Suscripción exitosa:', subscription);
        return sendSubscriptionToServer(subscription);
    }).then(() => {
        console.log('Suscripción guardada en el servidor');
    }).catch(function(error) {
        console.error('Error al suscribirse:', error);
        alert('Error al activar las notificaciones push: ' + error.message);
        document.getElementById('push-toggle').checked = false;
    });
}

function disablePushNotifications() {
    navigator.serviceWorker.ready.then(function(registration) {
        return registration.pushManager.getSubscription();
    }).then(function(subscription) {
        if (subscription) {
            return subscription.unsubscribe().then(function(successful) {
                if (successful) {
                    return removeSubscriptionFromServer(subscription);
                }
            });
        }
    }).then(() => {
        console.log('Desuscripción exitosa');
    }).catch(function(error) {
        console.error('Error al desuscribirse:', error);
    });
}

function sendSubscriptionToServer(subscription) {
    const userId = getCurrentUserId(); // Función que debes implementar
    
    return fetch('/webpush/save_information', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            subscription: subscription,
            browser: navigator.userAgent,
            group: 'user_' + userId
        })
    }).then(function(response) {
        if (!response.ok) {
            throw new Error('Error del servidor: ' + response.status);
        }
        return response.json();
    }).catch(function(error) {
        console.error('Error al guardar suscripción:', error);
        throw error;
    });
}

function removeSubscriptionFromServer(subscription) {
    const userId = getCurrentUserId(); // Función que debes implementar
    
    return fetch('/webpush/save_information', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            subscription: subscription,
            browser: navigator.userAgent,
            group: 'user_' + userId,
            unsubscribe: true
        })
    }).then(function(response) {
        if (!response.ok) {
            throw new Error('Error del servidor: ' + response.status);
        }
        return response.json();
    }).catch(function(error) {
        console.error('Error al remover suscripción:', error);
        throw error;
    });
}

// Funciones auxiliares que debes implementar según tu aplicación
function getVapidPublicKey() {
    // Opción 1: Obtener del DOM (desde una variable global o meta tag)
    const metaTag = document.querySelector('meta[name="BGn3GXYc5QTwPTtd3O64Mk5kwVkCmdKu-PFbauJ_N-_BKarD6auE3EW4Hgo6xw3N46BbWvrkzldt-T7WHFMMKY8"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    // Opción 2: Variable global definida en el template
    if (typeof window.VAPID_PUBLIC_KEY !== 'undefined') {
        return window.VAPID_PUBLIC_KEY;
    }
    
    // Opción 3: Hardcodeada (no recomendado para producción)
    // return 'TU_CLAVE_VAPID_PUBLICA_AQUI';
    
    console.error('Clave VAPID no encontrada');
    return null;
}

function getCurrentUserId() {
    // Opción 1: Obtener del DOM
    const userIdMeta = document.querySelector('meta[name="user-id"]');
    if (userIdMeta) {
        return userIdMeta.getAttribute('content');
    }
    
    // Opción 2: Variable global
    if (typeof window.USER_ID !== 'undefined') {
        return window.USER_ID;
    }
    
    // Opción 3: Desde un elemento del DOM
    const userElement = document.querySelector('[data-user-id]');
    if (userElement) {
        return userElement.getAttribute('data-user-id');
    }
    
    console.error('ID de usuario no encontrado');
    return 'anonymous';
}

// Funciones auxiliares existentes (corregidas)
function urlBase64ToUint8Array(base64String) {
    if (!base64String) {
        throw new Error('Base64 string is required');
    }
    
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    try {
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (error) {
        throw new Error('Invalid base64 string: ' + error.message);
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}