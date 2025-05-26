/**
 * Función para alternar la visibilidad de la contraseña
 * @param {string} fieldId - ID del campo de contraseña
 */
function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const toggleIcon = document.getElementById('toggleIcon_' + fieldId);
    
    if (!passwordField || !toggleIcon) {
        console.error('Campo o icono no encontrado:', fieldId);
        return;
    }
    
    // Alternar el tipo de input entre password y text
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        // Cambiar a icono de ojo tachado (contraseña visible)
        toggleIcon.className = 'fas fa-eye-slash';
        toggleIcon.style.color = '#947643'; // Color más oscuro cuando está visible
    } else {
        passwordField.type = 'password';
        // Cambiar a icono de ojo normal (contraseña oculta)
        toggleIcon.className = 'fas fa-eye';
        toggleIcon.style.color = '#666'; // Color normal
    }
}

/**
 * Función para validar que las contraseñas coincidan
 */
function validatePasswordMatch() {
    const newPassword = document.getElementById('nueva_contraseña');
    const confirmPassword = document.getElementById('confirmar_contraseña');
    
    if (!newPassword || !confirmPassword) {
        return true; // Si los campos no existen, no validar
    }
    
    if (newPassword.value !== confirmPassword.value) {
        confirmPassword.setCustomValidity('Las contraseñas no coinciden');
        return false;
    } else {
        confirmPassword.setCustomValidity('');
        return true;
    }
}

/**
 * Función para mostrar/ocultar mensajes con animación
 */
function hideMessage(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        element.style.display = 'none';
    }, 300);
}

/**
 * Función para mostrar/ocultar el icono según el contenido del campo
 */
function toggleIconVisibility(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const toggleIcon = document.getElementById('toggleIcon_' + fieldId);
    
    if (!passwordField || !toggleIcon) {
        return;
    }
    
    // Mostrar icono solo si hay contenido
    if (passwordField.value.length > 0) {
        toggleIcon.style.display = 'inline';
    } else {
        toggleIcon.style.display = 'none';
        // Asegurar que el campo vuelva a tipo password cuando esté vacío
        passwordField.type = 'password';
        toggleIcon.className = 'fas fa-eye';
        toggleIcon.style.color = '#666';
    }
}

// Event listeners cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Ocultar todos los iconos inicialmente
    const passwordFields = ['contraseña_actual', 'nueva_contraseña', 'confirmar_contraseña'];
    passwordFields.forEach(fieldId => {
        const toggleIcon = document.getElementById('toggleIcon_' + fieldId);
        if (toggleIcon) {
            toggleIcon.style.display = 'none';
        }
    });
    
    // Agregar event listeners para mostrar/ocultar iconos
    passwordFields.forEach(fieldId => {
        const passwordField = document.getElementById(fieldId);
        if (passwordField) {
            // Evento input para mostrar/ocultar icono mientras el usuario escribe
            passwordField.addEventListener('input', function() {
                toggleIconVisibility(fieldId);
            });
            
            // Evento keyup para capturar cuando se borra todo el contenido
            passwordField.addEventListener('keyup', function() {
                toggleIconVisibility(fieldId);
            });
            
            // Evento paste para cuando el usuario pega contenido
            passwordField.addEventListener('paste', function() {
                setTimeout(() => {
                    toggleIconVisibility(fieldId);
                }, 10);
            });
        }
    });
    
    // Validación en tiempo real para confirmación de contraseña
    const confirmPasswordField = document.getElementById('confirmar_contraseña');
    const newPasswordField = document.getElementById('nueva_contraseña');
    
    if (confirmPasswordField && newPasswordField) {
        confirmPasswordField.addEventListener('input', validatePasswordMatch);
        newPasswordField.addEventListener('input', validatePasswordMatch);
    }
    
    // Auto-hide messages después de 5 segundos
    const messages = document.querySelectorAll('.alert');
    messages.forEach(function(message) {
        setTimeout(function() {
            if (message.style.display !== 'none') {
                hideMessage(message);
            }
        }, 5000);
    });
    
    // Validación del formulario antes de enviar
    const form = document.getElementById('cambio-contraseña-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            if (!validatePasswordMatch()) {
                e.preventDefault();
                alert('Las contraseñas no coinciden. Por favor, verifica e intenta nuevamente.');
                return false;
            }
        });
    }
    
    // Mejorar la experiencia del modal
    const modal = document.getElementById('exampleModal');
    if (modal) {
        modal.addEventListener('shown.bs.modal', function() {
            // Enfocar el botón de aceptar cuando se abre el modal
            const acceptButton = modal.querySelector('.btn-primary');
            if (acceptButton) {
                acceptButton.focus();
            }
        });
    }
});

/**
 * Función para limpiar todos los campos del formulario
 */
function clearForm() {
    const form = document.getElementById('cambio-contraseña-form');
    if (form) {
        form.reset();
        // Asegurar que todos los campos vuelvan a tipo password y ocultar iconos
        const passwordFields = ['contraseña_actual', 'nueva_contraseña', 'confirmar_contraseña'];
        passwordFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            const icon = document.getElementById('toggleIcon_' + fieldId);
            if (field && icon) {
                field.type = 'password';
                icon.className = 'fas fa-eye';
                icon.style.color = '#666';
                icon.style.display = 'none'; // Ocultar icono cuando se limpia
            }
        });
    }
}

/**
 * Función para validar la fortaleza de la contraseña
 */
function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [
        password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar
    ].filter(Boolean).length;
    
    return {
        score: score,
        isStrong: score >= 4,
        suggestions: {
            length: password.length >= minLength,
            uppercase: hasUpperCase,
            lowercase: hasLowerCase,
            numbers: hasNumbers,
            special: hasSpecialChar
        }
    };
}