// Sistema de notificaciones mejorado para Mundo Bovino

class NotificationManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateNotificationCounter();
        this.setupAutoRefresh();
    }

    // Configurar event listeners
    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            // Event listeners para botones de eliminar
            this.attachDeleteListeners();
            
            // Event listener para el dropdown de recordatorios
            const dropdown = document.getElementById('recordatoriosDropdown');
            if (dropdown) {
                dropdown.addEventListener('click', (e) => {
                    // Prevenir que clicks internos cierren el dropdown
                    e.stopPropagation();
                });
            }
        });
    }

    // Agregar listeners a botones de eliminar
    attachDeleteListeners() {
        document.querySelectorAll('.btn-eliminar-notificacion').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const notificationId = button.getAttribute('data-notificacion-id');
                if (notificationId) {
                    this.deleteNotification(notificationId, button);
                }
            });
        });
    }

    // Eliminar notificación
    async deleteNotification(notificationId, buttonElement) {
        try {
            // Agregar estado de carga al botón
            const originalContent = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            buttonElement.disabled = true;

            const response = await fetch('/api/eliminar-notificacion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    'notificacion_id': notificationId
                })
            });

            const data = await response.json();

            if (data.success) {
                await this.removeNotificationFromDOM(notificationId);
                this.updateNotificationCounter();
                this.showSuccessMessage('Notificación eliminada correctamente');
            } else {
                throw new Error(data.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            this.showErrorMessage('Error al eliminar la notificación');
            
            // Restaurar botón en caso de error
            buttonElement.innerHTML = originalContent;
            buttonElement.disabled = false;
        }
    }

    // Remover notificación del DOM con animación
    async removeNotificationFromDOM(notificationId) {
        const notificationElement = document.querySelector(`[data-notificacion-id="${notificationId}"]`);
        
        if (notificationElement) {
            // Animación de salida
            notificationElement.style.transition = 'all 0.3s ease-out';
            notificationElement.style.opacity = '0';
            notificationElement.style.transform = 'translateX(100%)';
            
            // Esperar a que termine la animación
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Remover elemento
            notificationElement.remove();
            
            // Verificar si la categoría quedó vacía
            this.checkEmptyCategories();
        }
    }

    // Verificar categorías vacías
    checkEmptyCategories() {
        const vacunacionCategory = document.getElementById('categoria-vacunacion');
        if (vacunacionCategory) {
            const vacunacionItems = vacunacionCategory.querySelectorAll('.vacunacion-item');
            if (vacunacionItems.length === 0) {
                vacunacionCategory.remove();
            }
        }

        // Verificar si no hay ningún recordatorio
        const allReminders = document.querySelectorAll('.reminder-item');
        const content = document.querySelector('.recordatorios-content');
        
        if (allReminders.length === 0 && content) {
            content.innerHTML = `
                <div class="dropdown-item text-center py-3 no-reminders">
                    <i class="far fa-bell-slash text-muted mb-2 d-block"></i>
                    <p class="mb-0 text-muted">No hay recordatorios pendientes</p>
                </div>
            `;
        }
    }

    // Actualizar contador de notificaciones
    updateNotificationCounter() {
        const notificationItems = document.querySelectorAll('.reminder-item');
        const badge = document.querySelector('.notification-badge');
        const headerBadge = document.querySelector('.dropdown-header .badge');
        
        const totalCount = notificationItems.length;
        
        // Actualizar badge principal
        if (badge) {
            if (totalCount > 0) {
                badge.textContent = totalCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // Actualizar badge del header
        if (headerBadge) {
            if (totalCount > 0) {
                headerBadge.textContent = totalCount;
                headerBadge.style.display = 'inline-block';
            } else {
                headerBadge.style.display = 'none';
            }
        }

        // Actualizar título del dropdown
        const dropdownHeader = document.querySelector('.recordatorios-dropdown .dropdown-header h6');
        if (dropdownHeader) {
            const icon = '<i class="fas fa-bell text-warning me-2"></i>';
            dropdownHeader.innerHTML = `${icon} Recordatorios`;
        }
    }

    // Obtener token CSRF
    getCsrfToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return decodeURIComponent(value);
            }
        }
        
        // Buscar en meta tag como alternativa
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        return csrfMeta ? csrfMeta.getAttribute('content') : '';
    }

    // Mostrar mensaje de éxito
    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    // Mostrar mensaje de error
    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    // Sistema de toast notifications
    showToast(message, type = 'info') {
        // Crear contenedor de toasts si no existe
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                min-width: 300px;
            `;
            document.body.appendChild(toastContainer);
        }

        // Crear toast
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
        
        toast.className = `alert ${bgColor} text-white alert-dismissible fade show mb-2`;
        toast.style.cssText = `
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Auto-remover después de 4 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 4000);
    }

    // Refrescar recordatorios automáticamente
    async refreshNotifications() {
        try {
            const response = await fetch('/api/recordatorios/');
            const data = await response.json();
            
            if (data.success) {
                this.updateNotificationCounter();
                // Aquí podrías actualizar el contenido completo si fuera necesario
            }
        } catch (error) {
            console.error('Error al refrescar recordatorios:', error);
        }
    }

    // Configurar actualización automática
    setupAutoRefresh() {
        // Refrescar cada 5 minutos (300000 ms)
        setInterval(() => {
            this.refreshNotifications();
        }, 300000);
    }

    // Método público para actualizar desde el exterior
    refresh() {
        this.updateNotificationCounter();
        this.attachDeleteListeners();
    }
}

// Agregar estilos CSS dinámicamente
const styles = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .reminder-item {
        transition: all 0.2s ease;
    }
    
    .reminder-item:hover {
        background-color: rgba(0,0,0,0.05);
    }
    
    .btn-eliminar-notificacion {
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }
    
    .btn-eliminar-notificacion:hover {
        opacity: 1;
    }
    
    .vaccination-badge {
        background-color: #dc3545;
        color: white;
    }
    
    .agenda-time {
        background-color: #0d6efd;
        color: white;
    }
    
    .vaccination-description {
        font-size: 0.9em;
        line-height: 1.4;
    }
    
    .event-link {
        text-decoration: none;
        color: inherit;
    }
    
    .event-link:hover {
        text-decoration: underline;
    }
    
    .no-reminders {
        font-style: italic;
    }
`;

// Inyectar estilos
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Inicializar el sistema de notificaciones
const notificationManager = new NotificationManager();

// Exponer globalmente para uso externo si es necesario
window.NotificationManager = notificationManager;