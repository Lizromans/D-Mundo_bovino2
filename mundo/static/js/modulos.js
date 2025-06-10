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
        btnGuardar.style.background = '#947643';
        btnGuardar.style.boxShadow = '0 0 10px rgba(148, 118, 67, 0.5)';
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

// Función para mostrar notificaciones (CORREGIDA)
function mostrarNotificacion(tipo, mensaje) {
    // Remover notificación anterior si existe
    const notifAnterior = document.querySelector('.modulo-notification');
    if (notifAnterior) {
        notifAnterior.remove();
    }
    
    const iconos = {
        success: 'check-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle',
        error: 'times-circle'
    };
    
    // CREAR el elemento notificación
    const notif = document.createElement('div');
    notif.className = 'modulo-notification';
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${tipo === 'success' ? '#28a745' : tipo === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 9999;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    notif.innerHTML = `
        <i class="fas fa-${iconos[tipo]}" style="margin-right: 10px;"></i>
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

// Función para mostrar modal de confirmación (NUEVA)
function mostrarModalConfirmacion() {
    const modalHtml = `
        <div class="modal fade" id="modulosModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Cambios Pendientes</h5>
                    </div>
                    <div class="modal-body">
                        <p>Tienes cambios pendientes en la configuración de módulos.</p>
                        <p>¿Qué deseas hacer?</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="descartarCambiosYContinuar(this)">
                            Descartar y Continuar
                        </button>
                        <button type="button" class="btn btn-primary" onclick="guardarTodoYContinuar(this)">
                            Guardar Todo
                        </button>
                        <button type="button" class="btn btn-outline-secondary" onclick="cerrarModalConfirmacion(this)">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
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

// Función para crear botón de descartar - REMOVIDA
// Esta función fue removida por solicitud del usuario

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