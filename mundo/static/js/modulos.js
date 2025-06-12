// Estado temporal para cambios pendientes
let cambiosPendientes = false;
let estadoTemporal = {};

// Configuración de módulos
const modulosConfig = {
    inventario: {
        nombre: "Inventario",
        checkbox: null
    },
    registroCompras: {
        nombre: "Registro de Compras",
        checkbox: null
    },
    registroVentas: {
        nombre: "Registro de Ventas", 
        checkbox: null
    },
    calendario: {
        nombre: "Calendario",
        checkbox: null
    },
    documentos: {
        nombre: "Documentos",
        checkbox: null
    },
    contactos: {
        nombre: "Contactos",
        checkbox: null
    }
};

// Función para obtener el estado guardado de módulos
function getModulosEstado() {
    const estado = sessionStorage.getItem('modulosEstado');
    if (!estado) {
        // Estado por defecto - todos activos
        return {
            inventario: true,
            registroCompras: true,
            registroVentas: true,
            calendario: true,
            documentos: true,
            contactos: true
        };
    }
    return JSON.parse(estado);
}

// Función para guardar el estado de módulos
function saveModulosEstado(estado) {
    sessionStorage.setItem('modulosEstado', JSON.stringify(estado));
}

// Función para actualizar el menú según los módulos activos
function actualizarMenu() {
    const estado = getModulosEstado();
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    if (!dropdownMenu) return;
    
    // Obtener todos los items del menú excepto Home
    const menuItems = dropdownMenu.querySelectorAll('a.dropdown-item');
    
    menuItems.forEach(item => {
        const texto = item.textContent.trim();
        let moduloKey = null;
        
        // Identificar qué módulo corresponde a cada item
        if (texto.includes('Inventario')) {
            moduloKey = 'inventario';
        } else if (texto.includes('Registro de Compras')) {
            moduloKey = 'registroCompras';
        } else if (texto.includes('Registro de Ventas')) {
            moduloKey = 'registroVentas';
        } else if (texto.includes('Calendario')) {
            moduloKey = 'calendario';
        } else if (texto.includes('Documentos')) {
            moduloKey = 'documentos';
        } else if (texto.includes('Contactos')) {
            moduloKey = 'contactos';
        }
        
        // Mostrar u ocultar según el estado
        if (moduloKey) {
            if (estado[moduloKey]) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    });
}

// Función para manejar cambios en checkboxes (solo visual, no guarda)
function handleCheckboxChange(checkbox, moduloKey) {
    // Guardar en estado temporal
    estadoTemporal[moduloKey] = checkbox.checked;
    cambiosPendientes = true;
    
    // Actualizar visual del botón para indicar cambios pendientes
    actualizarEstadoBoton();
    
    // Agregar clase visual al checkbox modificado
    const moduloItem = checkbox.closest('.modulo-item');
    if (moduloItem) {
        moduloItem.classList.add('modificado');
    }
}

// Función para actualizar el estado visual del botón
function actualizarEstadoBoton() {
    const btnGuardar = document.querySelector('.btn-guardar');
    if (!btnGuardar) return;
    
    if (cambiosPendientes) {
        btnGuardar.style.background = '#D3B177';
        btnGuardar.style.boxShadow = '0 0 10px #D3B177';
        btnGuardar.style.color= '#000000'
        btnGuardar.innerHTML = 'Guardar Cambios';
        btnGuardar.classList.add('cambios-pendientes');
    } else {
        btnGuardar.style.background = '';
        btnGuardar.style.boxShadow = '';
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.classList.remove('cambios-pendientes');
    }
}

// Función para descartar cambios
function descartarCambios() {
    if (!cambiosPendientes) {
        mostrarNotificacion('info', 'No hay cambios para descartar');
        return;
    }
    
    // Obtener estado actual guardado
    const estadoActual = getModulosEstado();
    
    // Restaurar checkboxes al estado guardado
    Object.keys(modulosConfig).forEach(key => {
        const checkbox = modulosConfig[key].checkbox;
        if (checkbox) {
            checkbox.checked = estadoActual[key];
        }
    });
    
    // Limpiar cambios pendientes
    cambiosPendientes = false;
    estadoTemporal = { ...estadoActual };
    
    // Actualizar botón
    actualizarEstadoBoton();
    
    // Remover clases de modificado
    document.querySelectorAll('.modulo-item.modificado').forEach(item => {
        item.classList.remove('modificado');
    });
    
    // Mostrar notificación
    mostrarNotificacion('info', 'Cambios descartados');
}

// Función para guardar todos los cambios
function guardarCambios() {
    if (!cambiosPendientes) {
        mostrarNotificacion('info', 'No hay cambios para guardar');
        return;
    }
    
    // Obtener estado actual
    const estadoActual = getModulosEstado();
    
    // Aplicar cambios temporales
    Object.keys(estadoTemporal).forEach(key => {
        estadoActual[key] = estadoTemporal[key];
    });
    
    // Guardar estado
    saveModulosEstado(estadoActual);
    
    // Actualizar menú
    actualizarMenu();
    
    // Limpiar cambios pendientes
    cambiosPendientes = false;
    estadoTemporal = { ...estadoActual };
    
    // Actualizar botón
    actualizarEstadoBoton();
    
    // Remover clases de modificado
    document.querySelectorAll('.modulo-item.modificado').forEach(item => {
        item.classList.remove('modificado');
    });
    
    // Mostrar notificación de éxito
    mostrarNotificacion('success', 'Cambios guardados correctamente');
}

  // Interceptar el botón de guardar originalAdd commentMore actions
    const btnGuardarOriginal = document.querySelector('[data-bs-target="#exampleModal"]');
    if (btnGuardarOriginal) {
        btnGuardarOriginal.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (cambiosPendientes) {
                // Mostrar modal personalizado para confirmar cambios de módulos
                mostrarModalConfirmacion();
            } else {
                // Si no hay cambios de módulos, proceder normal
                document.getElementById('exampleModal').style.display = 'block';
            }
        });
    }
    
    // Modificar el modal existente para incluir lógica de módulos
    const btnAceptarModal = document.querySelector('#exampleModal .btn[onclick*="submit"]');
    if (btnAceptarModal) {
        btnAceptarModal.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Guardar cambios de módulos primero
            if (cambiosPendientes) {
                guardarCambios();
            }
            
            // Luego enviar el formulario
            setTimeout(() => {
                document.getElementById('perfil-form').submit();
            }, 500);
        });
    }

// Función para cerrar modal de confirmación
function cerrarModalConfirmacion(btn) {
    const modal = btn.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

// Función para inicializar checkboxes en configuraciones
function inicializarConfiguraciones() {
    const estado = getModulosEstado();
    
    // Inicializar estado temporal con el estado actual
    estadoTemporal = { ...estado };
    
    // Configurar cada checkbox
    const checkboxes = {
        inventario: document.getElementById('inventario'),
        registroCompras: document.getElementById('registroCompras'),
        registroVentas: document.getElementById('registroVentas'),
        calendario: document.getElementById('calendario'),
        documentos: document.getElementById('documentos'),
        contactos: document.getElementById('contactos')
    };
    
    Object.keys(checkboxes).forEach(key => {
        const checkbox = checkboxes[key];
        if (checkbox) {
            // Establecer estado inicial
            checkbox.checked = estado[key];
            
            // Guardar referencia
            modulosConfig[key].checkbox = checkbox;
            
            // Agregar event listener
            checkbox.addEventListener('change', function() {
                handleCheckboxChange(this, key);
            });
        }
    });
    
    // MODIFICACIÓN CRÍTICA: No interferir con el formulario original
    // Solo agregar funcionalidad adicional sin bloquear el comportamiento normal
    
    // Botón de descartar removido por solicitud del usuario
}

// Funciones para el modal personalizado
function descartarCambiosYContinuar(btn) {
    descartarCambios();
    btn.closest('.modal').remove();
    // Proceder con el envío normal del formulario
    const form = document.getElementById('perfil-form');
    if (form) {
        form.submit();
    }
}

function guardarTodoYContinuar(btn) {
    guardarCambios();
    btn.closest('.modal').remove();
    // Enviar formulario después de guardar
    setTimeout(() => {
        const form = document.getElementById('perfil-form');
        if (form) {
            form.submit();
        }
    }, 500);
}

// Exponer funciones globalmente para los botones
window.descartarCambiosYContinuar = descartarCambiosYContinuar;
window.guardarTodoYContinuar = guardarTodoYContinuar;
window.cerrarModalConfirmacion = cerrarModalConfirmacion;

// Función principal de inicialización
function inicializar() {
    // Siempre actualizar el menú al cargar
    actualizarMenu();
    
    // Si estamos en configuraciones, inicializar checkboxes
    if (document.getElementById('perfil-form')) {
        inicializarConfiguraciones();
    }
}

// Función para manejar el cierre de página con cambios pendientes
function handleBeforeUnload(e) {
    if (cambiosPendientes) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
        return e.returnValue;
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}

// Advertir sobre cambios no guardados al salir
window.addEventListener('beforeunload', handleBeforeUnload);

// Para debugging - exponer funciones globalmente
window.ModulosDebug = {
    getEstado: getModulosEstado,
    actualizarMenu: actualizarMenu,
    guardarCambios: guardarCambios,
    descartarCambios: descartarCambios,
    resetear: function() {
        sessionStorage.removeItem('modulosEstado');
        location.reload();
    },
    // Nueva función para verificar estado
    verificarEstado: function() {
        console.log('Cambios pendientes:', cambiosPendientes);
        console.log('Estado temporal:', estadoTemporal);
        console.log('Estado guardado:', getModulosEstado());
    }
};

// Agregar esta función después de handleCheckboxChange
function actualizarEstiloModulo(checkbox) {
    const moduloItem = checkbox.closest('.modulo-item');
    if (moduloItem) {
        const span = moduloItem.querySelector('.module-text');
        
        if (!checkbox.checked) {
            // Aplicar estilo gris solo al checkbox y span
            checkbox.classList.add('modulo-desactivado');
            if (span) {
                span.classList.add('modulo-desactivado');
            }
        } else {
            // Remover estilo gris del checkbox y span
            checkbox.classList.remove('modulo-desactivado');
            if (span) {
                span.classList.remove('modulo-desactivado');
            }
        }
    }
}

// Función para aplicar estilos iniciales basados en el estado actual
function aplicarEstilosIniciales() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        actualizarEstiloModulo(checkbox);
    });
}

// Función para mantener estilos después de guardar
function mantenerEstilosDespuesDeGuardar() {
    // Aplicar estilos basados en el estado actual después de guardar
    aplicarEstilosIniciales();
}

// Modificar handleCheckboxChange para incluir el estilo
function handleCheckboxChange(checkbox, moduloKey) {
    // Código existente...
    estadoTemporal[moduloKey] = checkbox.checked;
    cambiosPendientes = true;
    
    // Actualizar visual del botón para indicar cambios pendientes
    actualizarEstadoBoton();
    
    // NUEVO: Actualizar estilo del módulo
    actualizarEstiloModulo(checkbox);
    
    // Agregar clase visual al checkbox modificado
    const moduloItem = checkbox.closest('.modulo-item');
    if (moduloItem) {
        moduloItem.classList.add('modificado');
    }
}

// Llamar esta función al cargar la página para aplicar estilos iniciales
document.addEventListener('DOMContentLoaded', function() {
    aplicarEstilosIniciales();
});

// Llamar esta función después de guardar los cambios exitosamente
// (agregar esta línea en tu función de guardar después del éxito)
function despuesDeGuardarExitoso() {
    // Tu código existente de éxito...
    
    // Mantener estilos después de guardar
    mantenerEstilosDespuesDeGuardar();
}