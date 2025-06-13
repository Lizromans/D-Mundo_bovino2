function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const eyeIcon = document.getElementById('toggleIcon_' + fieldId);
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordField.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// Función para mostrar/ocultar el ícono basado en el contenido del campo
function setupPasswordToggle(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const eyeIcon = document.getElementById('toggleIcon_' + fieldId);
    
    if (!passwordField || !eyeIcon) {
        console.log('No se encontró el campo o ícono para:', fieldId);
        return;
    }
    
    // Ocultar el ícono inicialmente
    eyeIcon.style.display = 'none';
    
    // Agregar event listener para detectar cambios en el input
    passwordField.addEventListener('input', function() {
        if (this.value.length > 0) {
            // Mostrar el ícono si hay contenido
            eyeIcon.style.display = 'inline-block';
        } else {
            // Ocultar el ícono si no hay contenido
            eyeIcon.style.display = 'none';
            // Resetear a tipo password cuando se oculta
            this.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    });
    
    // También verificar si hay contenido al cargar la página (para mantener estado después de errores)
    if (passwordField.value.length > 0) {
        eyeIcon.style.display = 'inline-block';
    }
}

// Función para cerrar popup
function closePopup() {
    const popupContainer = document.querySelector('.popup-container');
    if (popupContainer) {
        popupContainer.style.display = 'none';
    }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Usar 'contraseña' que es el ID real en el HTML
    setupPasswordToggle('contraseña');
    
    // Auto-cerrar popup después de 5 segundos
    setTimeout(function() {
        const popupContainer = document.querySelector('.popup-container');
        if (popupContainer) {
            popupContainer.style.display = 'none';
        }
    }, 5000);
});