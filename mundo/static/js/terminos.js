// JavaScript completo para el formulario de registro
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const checkbox = document.getElementById('aceptar-terminos');
    const errorDiv = document.querySelector('.error-terminos');
    
    console.log('Form:', form);
    console.log('Checkbox:', checkbox);
    console.log('Error div:', errorDiv);
    
    if (form && checkbox && errorDiv) {
        // Asegurar que el error esté oculto al cargar
        errorDiv.style.display = 'none';
        
        // Validar SOLO al enviar el formulario
        form.addEventListener('submit', function(e) {
            if (!checkbox.checked) {
                e.preventDefault(); // Prevenir el envío
                errorDiv.style.display = 'block'; // Mostrar error
                checkbox.focus(); // Enfocar el checkbox
            }
        });
        
        // Ocultar error cuando se marque el checkbox
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                errorDiv.style.display = 'none';
            }
        });
    } else {
        console.log('No se encontraron todos los elementos necesarios');
    }
});

// Funciones para el modal de términos y condiciones
function abrirModalTerminos() {
    const modal = document.getElementById('modal-terminos');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevenir scroll del body
    }
}

function cerrarModalTerminos() {
    const modal = document.getElementById('modal-terminos');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restaurar scroll del body
    }
}

// Cerrar modal al hacer clic fuera de él
document.addEventListener('click', function(event) {
    const modal = document.getElementById('modal-terminos');
    if (event.target === modal) {
        cerrarModalTerminos();
    }
});

// Cerrar modal con tecla Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarModalTerminos();
    }
});

// Función para toggle de contraseñas (si no está en otro archivo)
function togglePassword(fieldType) {
    const passwordField = document.getElementById(fieldType);
    const toggleIcon = document.getElementById('toggleIcon_' + fieldType);
    
    if (passwordField && toggleIcon) {
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
        } else {
            passwordField.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
        }
    }
}