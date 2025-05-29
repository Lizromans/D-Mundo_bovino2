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
        btnGuardar.style.background = '#947643;';
        btnGuardar.style.boxShadow = '0 0 10px';
        btnGuardar.innerHTML = 'Guardar Cambios';
        btnGuardar.classList.add('cambios-pendientes');
    }
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
    estadoTemporal = {};
    
    // Actualizar botón
    actualizarEstadoBoton();
    
    // Remover clases de modificado
    document.querySelectorAll('.modulo-item.modificado').forEach(item => {
        item.classList.remove('modificado');
    });
    
    // Mostrar notificación de éxito
    mostrarNotificacion('success', 'Cambios guardados correctamente');
}

// Función para mostrar notificaciones
function mostrarNotificacion(tipo, mensaje) {
    // Remover notificación anterior si existe
    const notifAnterior = document.querySelector('.modulo-notification');
    if (notifAnterior) {
        notifAnterior.remove();
    }
    
    const colores = {
        success: '#28a745',
        info: '#17a2b8',
        warning: '#ffc107',
        error: '#dc3545'
    };
    
    const iconos = {
        success: 'check-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle',
        error: 'times-circle'
    };
    
    const notif = document.createElement('div');
    notif.className = 'modulo-notification';
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colores[tipo]};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 9999;
        font-weight: bold;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    notif.innerHTML = `
        <i class="fas fa-${iconos[tipo]}"></i>
        ${mensaje}
    `;
    
    document.body.appendChild(notif);
    
    // Animar entrada
    setTimeout(() => {
        notif.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        notif.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notif.parentNode) {
                notif.parentNode.removeChild(notif);
            }
        }, 300);
    }, 4000);
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
    
    // Interceptar el botón de guardar original
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
    
    // Agregar botón de descartar cambios si hay cambios pendientes
    crearBotonDescartar();
}


// Funciones para el modal personalizado
function descartarCambiosYContinuar(btn) {
    descartarCambios();
    btn.closest('.modal').remove();
    // Mostrar modal original
    const modalOriginal = new bootstrap.Modal(document.getElementById('exampleModal'));
    modalOriginal.show();
}

function guardarTodoYContinuar(btn) {
    guardarCambios();
    btn.closest('.modal').remove();
    // Enviar formulario directamente
    setTimeout(() => {
        document.getElementById('perfil-form').submit();
    }, 500);
}

// Exponer funciones globalmente para los botones
window.descartarCambiosYContinuar = descartarCambiosYContinuar;
window.guardarTodoYContinuar = guardarTodoYContinuar;

// Función para crear botón de descartar
function crearBotonDescartar() {
    const botonSeccion = document.querySelector('.boton-seccion');
    if (!botonSeccion) return;
    
    const btnDescartar = document.createElement('button');
    btnDescartar.type = 'button';
    btnDescartar.className = 'btn-descartar';
    btnDescartar.innerHTML = 'Descartar Cambios';
    btnDescartar.style.cssText = `
        background: #6c757d;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 5px;
        margin-right: 10px;
        cursor: pointer;
        display: none;
    `;
    
    btnDescartar.addEventListener('click', descartarCambios);
    
    botonSeccion.insertBefore(btnDescartar, botonSeccion.firstChild);
    
    // Función para mostrar/ocultar botón descartar
    const interval = setInterval(() => {
        if (cambiosPendientes) {
            btnDescartar.style.display = 'inline-block';
        } else {
            btnDescartar.style.display = 'none';
        }
    }, 100);
}

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
    }
};