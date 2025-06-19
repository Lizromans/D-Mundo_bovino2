// JavaScript actualizado para tu HTML específico
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