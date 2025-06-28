// Contador de llamadas para depuración
let contadorActualizaciones = 0;

// Función para validar y formatear peso con coma decimal
function validarYFormatearPeso(input) {
    let valor = input.value.trim();
    
    if (!valor) {
        return true; // Permitir campos vacíos
    }
    
    // Permitir punto o coma como separador decimal
    const regexPeso = /^\d+([,.]\d{1,2})?$/;
    
    if (!regexPeso.test(valor)) {
        input.setCustomValidity('Formato inválido. Use formato como: 15,50 o 15.50');
        input.reportValidity();
        return false;
    }
    
    // Normalizar el valor (convertir coma a punto para validación)
    const valorNormalizado = valor.replace(',', '.');
    const pesoNumerico = parseFloat(valorNormalizado);
    
    if (isNaN(pesoNumerico) || pesoNumerico <= 0) {
        input.setCustomValidity('El peso debe ser mayor que 0');
        input.reportValidity();
        return false;
    }
    
    // Limpiar validación personalizada si todo está bien
    input.setCustomValidity('');
    return true;
}

// Función para formatear los valores a pesos colombianos
function formatearPrecioCOP(input) {
    let valor = input.value.replace(/[^\d]/g, '');
    if (valor) {
        let numero = parseInt(valor);
        if (!isNaN(numero) && numero >= 0) {
            input.value = numero.toLocaleString('es-CO');
        } else {
            input.value = '';
        }
    }
}

// Función para obtener valor numérico de un input formateado
function obtenerValorNumerico(input) {
    if (!input || !input.value) return 0;
    const valorTexto = input.value.replace(/[^\d]/g, '');
    return parseFloat(valorTexto) || 0;
}

// Función para actualizar el formulario de animales basado en la cantidad (para crear nuevas compras)
function actualizarFormularioAnimales() {
    contadorActualizaciones++;
    console.log(`Llamada #${contadorActualizaciones} a actualizarFormularioAnimales`);

    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    const contenedor = document.getElementById('detalles_animales');
    
    if (!contenedor) {
        console.error('ERROR: No se encontró el elemento con ID "detalles_animales"');
        return;
    }

    contenedor.innerHTML = '';

    if (cantidad <= 0) {
        const precioTotalInput = document.getElementById('precio_total');
        if (precioTotalInput) {
            precioTotalInput.value = '';
        }
        return;
    }

    let siguienteCodigo = 1;

    for (let i = 1; i <= cantidad; i++) {
        const codigoActual = siguienteCodigo + (i - 1);
        
        const animalDiv = document.createElement('div');
        animalDiv.classList.add('card', 'mb-3', 'p-3');
        animalDiv.dataset.animal = i;

        animalDiv.innerHTML = `
            <h5 class="card-title">Animal #${i}</h5>
            <div class="row">
                <div class="col-md-4">
                    <label for="cod_ani_${i}">Código:</label>
                    <input type="number" id="cod_ani_${i}" name="cod_ani_${i}" class="form-control" value="${codigoActual}" required>
                </div>
                <div class="col-md-8">
                    <label for="edad_aniCom_${i}">Edad:</label>
                    <select id="edad_aniCom_${i}" name="edad_aniCom_${i}" class="form-select" required>
                        <option value="" disabled selected>Selecciona una edad</option>
                        <option value="0-1">0 - 1 años</option>
                        <option value="1-2">1 - 2 años</option>
                        <option value="2-3">2 - 3 años</option>
                        <option value="3-4">3 - 4 años</option>
                        <option value="4-mas">4 años - más</option>
                    </select>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-6">
                    <label for="peso_aniCom_${i}">Peso (kg):</label>
                    <input type="text" id="peso_aniCom_${i}" name="peso_aniCom_${i}" class="form-control peso-input" 
                           pattern="[0-9]+([,.][0-9]{1,2})?" placeholder="ej: 15,50"
                           required>
                </div>
                <div class="col-md-6">
                    <label for="precio_uni_${i}">Precio por animal:</label>
                    <div class="input-group">
                        <span class="input-group-text">$</span>
                        <input type="text" id="precio_uni_${i}" name="precio_uni_${i}" class="form-control precio-input" 
                               required placeholder="Precio unitario">
                    </div>
                </div>
            </div>
        `;
        contenedor.appendChild(animalDiv);
    }

    // Agregar event listeners a los campos recién creados
    contenedor.querySelectorAll('.peso-input').forEach(input => {
        input.addEventListener('blur', function() {
            validarYFormatearPeso(this);
        });
        
        input.addEventListener('input', function() {
            this.setCustomValidity('');
        });
    });

    contenedor.querySelectorAll('.precio-input').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
    });

    calcularPrecioTotal();
}

// Función para calcular el precio total basado en los precios unitarios, transporte y licencia
function calcularPrecioTotal() {
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    let totalAnimales = 0;

    // Sumar precios de los animales
    for (let i = 1; i <= cantidad; i++) {
        const precioInput = document.getElementById(`precio_uni_${i}`);
        if (precioInput) {
            const precio = obtenerValorNumerico(precioInput);
            totalAnimales += precio;
        }
    }

    // Obtener valores de transporte y licencia
    const transporteInput = document.getElementById('valor_transporte');
    const licenciaInput = document.getElementById('valor_licencia');
    
    const valorTransporte = obtenerValorNumerico(transporteInput);
    const valorLicencia = obtenerValorNumerico(licenciaInput);

    // Calcular total final
    const totalFinal = totalAnimales + valorTransporte + valorLicencia;

    // Actualizar el campo de precio total con formato
    const precioTotalInput = document.getElementById('precio_total');
    if (precioTotalInput) {
        precioTotalInput.value = totalFinal.toLocaleString('es-CO');
    }
}

// Función para recalcular el precio total de una compra en edición
function recalcularPrecioTotal(compraId) {
    const modal = document.getElementById('editModal-' + compraId);
    if (!modal) {
        console.error(`No se encontró el modal para compra ${compraId}`);
        return;
    }

    let totalAnimales = 0;
    
    // Sumar todos los precios unitarios de los animales en el modal de edición
    modal.querySelectorAll('.precio-uni-edit').forEach(input => {
        const precio = obtenerValorNumerico(input);
        totalAnimales += precio;
        console.log(`Precio animal: ${precio}, Total acumulado: ${totalAnimales}`);
    });
    
    // Obtener valores de transporte y licencia del modal de edición
    const transporteInput = document.getElementById('valor_transporte-edit-' + compraId);
    const licenciaInput = document.getElementById('valor_licencia-edit-' + compraId);
    
    const valorTransporte = obtenerValorNumerico(transporteInput);
    const valorLicencia = obtenerValorNumerico(licenciaInput);
    
    console.log(`Edición compra ${compraId} - Animales: ${totalAnimales}, Transporte: ${valorTransporte}, Licencia: ${valorLicencia}`);
    
    // Calcular total final
    const totalFinal = totalAnimales + valorTransporte + valorLicencia;
    
    // Actualizar el precio total
    const precioTotalInput = document.getElementById('precio_total-edit-' + compraId);
    if (precioTotalInput) {
        precioTotalInput.value = totalFinal.toLocaleString('es-CO');
        console.log(`Precio total actualizado para compra ${compraId}: ${precioTotalInput.value}`);
    }
}

// Función para validar peso en formularios de edición
function validarPesoEdicion(input) {
    return validarYFormatearPeso(input);
}

// Función para manejar errores de forma centralizada
function manejarError(error, contexto = '') {
    console.error(`Error${contexto ? ' en ' + contexto : ''}:`, error);
}

// Inicializar el formulario
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado. Inicializando formulario...');

    // --- CONFIGURACIÓN PARA CREAR NUEVAS COMPRAS ---
    
    // Configurar event listener para el campo de cantidad
    const cantidadInput = document.getElementById('cantidad');
    if (cantidadInput) {
        // Eliminar eventos anteriores de manera segura
        const nuevoInput = cantidadInput.cloneNode(true);
        cantidadInput.parentNode.replaceChild(nuevoInput, cantidadInput);

        // Agregar event listeners
        nuevoInput.addEventListener('change', function(event) {
            console.log(`Campo de cantidad cambió a: ${event.target.value}`);
            try {
                actualizarFormularioAnimales();
            } catch (error) {
                manejarError(error, 'actualizarFormularioAnimales');
            }
        });

        nuevoInput.addEventListener('input', function(event) {
            clearTimeout(window.inputTimeout);
            window.inputTimeout = setTimeout(() => {
                try {
                    actualizarFormularioAnimales();
                } catch (error) {
                    manejarError(error, 'actualizarFormularioAnimales (input)');
                }
            }, 500);
        });
    }

    // Configurar event listeners para los campos de transporte y licencia (crear nueva compra)
    const transporteInput = document.getElementById('valor_transporte');
    const licenciaInput = document.getElementById('valor_licencia');

    if (transporteInput) {
        transporteInput.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
        
        transporteInput.addEventListener('input', function() {
            clearTimeout(window.transporteTimeout);
            window.transporteTimeout = setTimeout(() => {
                formatearPrecioCOP(this);
                calcularPrecioTotal();
            }, 300);
        });
    }

    if (licenciaInput) {
        licenciaInput.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
        
        licenciaInput.addEventListener('input', function() {
            clearTimeout(window.licenciaTimeout);
            window.licenciaTimeout = setTimeout(() => {
                formatearPrecioCOP(this);
                calcularPrecioTotal();
            }, 300);
        });
    }

    // --- CONFIGURACIÓN PARA EDITAR COMPRAS EXISTENTES ---
    
    // Event listeners para precios unitarios en modales de edición
    document.querySelectorAll('.precio-uni-edit').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            
            const compraId = this.getAttribute('data-compra');
            if (compraId) {
                recalcularPrecioTotal(compraId);
            }
        });

        // También agregar listener para input en tiempo real
        input.addEventListener('input', function() {
            const compraId = this.getAttribute('data-compra');
            if (compraId) {
                clearTimeout(window[`precioTimeout_${compraId}`]);
                window[`precioTimeout_${compraId}`] = setTimeout(() => {
                    formatearPrecioCOP(this);
                    recalcularPrecioTotal(compraId);
                }, 300);
            }
        });
    });

    // Event listeners para transporte y licencia en modales de edición
    document.querySelectorAll('[id^="valor_transporte-edit-"], [id^="valor_licencia-edit-"]').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            
            const compraId = this.id.match(/-(\d+)$/)?.[1];
            if (compraId) {
                recalcularPrecioTotal(compraId);
            }
        });

        // También agregar listener para input en tiempo real
        input.addEventListener('input', function() {
            const compraId = this.id.match(/-(\d+)$/)?.[1];
            if (compraId) {
                clearTimeout(window[`extraTimeout_${compraId}`]);
                window[`extraTimeout_${compraId}`] = setTimeout(() => {
                    formatearPrecioCOP(this);
                    recalcularPrecioTotal(compraId);
                }, 300);
            }
        });
    });

    // Validación de peso en campos de edición existentes
    document.querySelectorAll('input[name^="peso_anicom_"]').forEach(input => {
        input.addEventListener('blur', function() {
            validarPesoEdicion(this);
        });
        
        input.addEventListener('input', function() {
            this.setCustomValidity('');
        });
    });
    
    // Inicializar todos los modales de edición con sus totales correctos
    document.querySelectorAll('[id^="editModal-"]').forEach(modal => {
        const compraId = modal.id.replace('editModal-', '');
        recalcularPrecioTotal(compraId);
    });

    console.log('Inicialización completada');
});