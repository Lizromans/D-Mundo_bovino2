// Contador de llamadas para depuración
let contadorActualizaciones = 0;

// Función para validar y formatear peso con coma decimal
function validarYFormatearPeso(input) {
    let valor = input.value.trim();
    
    if (!valor) {
        return;
    }
    
    // Permitir punto o coma como separador decimal
    // Validar formato básico
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

// Función para actualizar el formulario de animales basado en la cantidad
function actualizarFormularioAnimales() {
    // Contador para depuración
    contadorActualizaciones++;
    console.log(`Llamada #${contadorActualizaciones} a actualizarFormularioAnimales`);

    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    console.log(`Cantidad seleccionada: ${cantidad}`);

    // Identificar el contenedor correcto
    const contenedor = document.getElementById('detalles_animales');
    if (!contenedor) {
        console.error('ERROR: No se encontró el elemento con ID "detalles_animales"');
        return;
    }

    // Verificar si ya tiene contenido antes de limpiar
    console.log(`Contenido del contenedor antes de limpiar: ${contenedor.children.length} elementos`);

    // Limpiar contenedor completamente
    contenedor.innerHTML = '';

    console.log(`Contenedor limpio: ${contenedor.children.length} elementos`);

    // Si no hay animales, no hay nada que hacer
    if (cantidad <= 0) {
        console.log('Cantidad es 0 o negativa, no se generan campos');
        return;
    }

    // Generar código inicial simple
    let siguienteCodigo = 1;

    // Generar campos para cada animal
    console.log(`Generando ${cantidad} campos con código inicial ${siguienteCodigo}`);

    for (let i = 1; i <= cantidad; i++) {
        const codigoActual = siguienteCodigo + (i - 1);
        console.log(`Generando campo para animal #${i} con código ${codigoActual}`);

        const animalDiv = document.createElement('div');
        animalDiv.classList.add('card', 'mb-3', 'p-3');
        animalDiv.dataset.animal = i;

        animalDiv.innerHTML = `
            <h5 class="card-title">Animal #${i}</h5>
            <div class="row">
                <div class="col-md-4">
                    <label for="cod_ani_${i}">Código:</label>
                    <input type="number" id="cod_ani_${i}" name="cod_ani_${i}" class="form-control" value="${codigoActual}">
                </div>
                <div class="col-md-8">
                    <label for="edad_aniCom_${i}">Edad:</label>
                    <select id="edad_aniCom_${i}" name="edad_aniCom_${i}" class="form-select" required>
                        <option value="" disabled selected>Selecciona una edad</option>
                        <option value="1-2">1 - 2 años</option>
                        <option value="2-3">2 - 3 años</option>
                        <option value="3-4">3 - 4 años</option>
                    </select>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-6">
                    <label for="peso_aniCom_${i}">Peso (kg):</label>
                    <input type="text" id="peso_aniCom_${i}" name="peso_aniCom_${i}" class="form-control peso-input" 
                           pattern="[0-9]+([,.][0-9]{1,2})?"
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

    console.log(`Generación completada. Contenedor ahora tiene ${contenedor.children.length} elementos`);

    // Agregar event listeners a los campos de peso recién creados
    contenedor.querySelectorAll('.peso-input').forEach(input => {
        input.addEventListener('blur', function() {
            validarYFormatearPeso(this);
        });
        
        input.addEventListener('input', function() {
            // Limpiar validación mientras escribe
            this.setCustomValidity('');
        });
    });

    // Agregar event listeners a los campos de precio recién creados
    contenedor.querySelectorAll('.precio-input').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
    });

    // Actualizar formato del campo de precio total
    const precioTotalInput = document.getElementById('precio_total');
    if (precioTotalInput) {
        const precioTotalContainer = precioTotalInput.parentElement;
        const yaFormateado = precioTotalContainer.querySelector('.input-group-text');

        if (!yaFormateado) {
            console.log('Formateando campo de precio total');
            // Envolver el input en un input-group con el símbolo de pesos
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';

            const currencySymbol = document.createElement('span');
            currencySymbol.className = 'input-group-text';
            currencySymbol.textContent = '$';

            precioTotalInput.parentNode.insertBefore(inputGroup, precioTotalInput);
            inputGroup.appendChild(currencySymbol);
            inputGroup.appendChild(precioTotalInput);

            // Actualizar los atributos del input
            precioTotalInput.setAttribute('readonly', true);
        }
    } else {
        console.warn('No se encontró el campo de precio total');
    }
}

// Función para formatear los valores a pesos colombianos
function formatearPrecioCOP(input) {
    let valor = input.value.replace(/[^\d]/g, '');
    if (valor) {
        // Convertir a número
        let numero = parseInt(valor);
        if (!isNaN(numero) && numero >= 0) {
            // Formatear con separadores de miles
            input.value = numero.toLocaleString('es-CO');
        } else {
            input.value = '';
        }
    }
}

// Función para validar peso en formularios de edición
function validarPesoEdicion(input) {
    return validarYFormatearPeso(input);
}

// Función para obtener valor numérico de un input formateado
function obtenerValorNumerico(input) {
    if (!input || !input.value) return 0;
    const valorTexto = input.value.replace(/[^\d]/g, '');
    return parseFloat(valorTexto) || 0;
}

// Función para calcular el precio total basado en los precios unitarios, transporte y licencia
function calcularPrecioTotal() {
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    let totalAnimales = 0;

    console.log(`Calculando precio total para ${cantidad} animales`);

    // Sumar precios de los animales
    for (let i = 1; i <= cantidad; i++) {
        const precioInput = document.getElementById(`precio_uni_${i}`);

        if (precioInput) {
            const precio = obtenerValorNumerico(precioInput);
            totalAnimales += precio;
            console.log(`Animal #${i}: Precio = ${precio}, Total acumulado animales = ${totalAnimales}`);
        } else {
            console.warn(`No se encontró el campo de precio para el animal #${i}`);
        }
    }

    // Obtener valores de transporte y licencia
    const transporteInput = document.getElementById('transporte');
    const licenciaInput = document.getElementById('licencia');
    
    const valorTransporte = obtenerValorNumerico(transporteInput);
    const valorLicencia = obtenerValorNumerico(licenciaInput);
    
    console.log(`Transporte: ${valorTransporte}, Licencia: ${valorLicencia}`);

    // Calcular total final
    const totalFinal = totalAnimales + valorTransporte + valorLicencia;

    // Actualizar el campo de precio total con formato
    const precioTotalInput = document.getElementById('precio_total');
    if (precioTotalInput) {
        precioTotalInput.value = totalFinal.toLocaleString('es-CO');
        console.log(`Precio total actualizado: ${precioTotalInput.value} (Animales: ${totalAnimales}, Transporte: ${valorTransporte}, Licencia: ${valorLicencia})`);
    } else {
        console.warn('No se encontró el campo de precio total');
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
    
    // Sumar todos los precios unitarios de los animales
    modal.querySelectorAll('.precio-uni-edit').forEach(input => {
        const precio = obtenerValorNumerico(input);
        totalAnimales += precio;
    });
    
    // Obtener valores de transporte y licencia del modal de edición
    const transporteInput = document.getElementById('transporte-edit-' + compraId);
    const licenciaInput = document.getElementById('licencia-edit-' + compraId);
    
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
    } else {
        console.error(`No se encontró el campo precio_total-edit-${compraId}`);
    }
}

// Función para verificar la estructura HTML
function verificarEstructuraHTML() {
    console.log('--- Verificando estructura HTML ---');

    // Verificar campo de cantidad
    const cantidadInput = document.getElementById('cantidad');
    if (!cantidadInput) {
        console.error('No se encontró el campo de cantidad (ID: cantidad)');
    } else {
        console.log(`Campo de cantidad encontrado, valor: ${cantidadInput.value}`);
    }

    // Verificar contenedor de detalles
    const contenedor = document.getElementById('detalles_animales');
    if (!contenedor) {
        console.error('No se encontró el contenedor de detalles (ID: detalles_animales)');
    } else {
        console.log(`Contenedor de detalles encontrado, contiene ${contenedor.children.length} elementos`);
    }

    // Verificar campos de transporte y licencia
    const transporteInput = document.getElementById('transporte');
    const licenciaInput = document.getElementById('licencia');
    
    if (!transporteInput) {
        console.warn('No se encontró el campo de transporte (ID: transporte)');
    } else {
        console.log(`Campo de transporte encontrado, valor: ${transporteInput.value}`);
    }
    
    if (!licenciaInput) {
        console.warn('No se encontró el campo de licencia (ID: licencia)');
    } else {
        console.log(`Campo de licencia encontrado, valor: ${licenciaInput.value}`);
    }

    // Verificar si hay múltiples elementos con IDs duplicados
    ['cantidad', 'detalles_animales', 'precio_total', 'transporte', 'licencia'].forEach(id => {
        const elementos = document.querySelectorAll(`#${id}`);
        if (elementos.length > 1) {
            console.error(`¡ALERTA! Se encontraron ${elementos.length} elementos con el ID "${id}"`);
        }
    });

    console.log('--- Fin de verificación HTML ---');
}

// Función para manejar errores de forma centralizada
function manejarError(error, contexto = '') {
    console.error(`Error${contexto ? ' en ' + contexto : ''}:`, error);
}

// Inicializar el formulario
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado. Inicializando formulario...');

    // Verificar estructura HTML
    verificarEstructuraHTML();

    // Configurar event listener para el campo de cantidad
    const cantidadInput = document.getElementById('cantidad');
    if (cantidadInput) {
        console.log('Configurando event listener al campo de cantidad');

        // Eliminar eventos anteriores de manera segura
        const nuevoInput = cantidadInput.cloneNode(true);
        cantidadInput.parentNode.replaceChild(nuevoInput, cantidadInput);

        // Agregar event listener al nuevo elemento
        nuevoInput.addEventListener('change', function(event) {
            console.log(`Campo de cantidad cambió a: ${event.target.value}`);
            try {
                actualizarFormularioAnimales();
            } catch (error) {
                manejarError(error, 'actualizarFormularioAnimales');
            }
        });

        // También escuchar el evento 'input' para cambios en tiempo real
        nuevoInput.addEventListener('input', function(event) {
            // Debounce para evitar demasiadas llamadas
            clearTimeout(window.inputTimeout);
            window.inputTimeout = setTimeout(() => {
                console.log(`Campo de cantidad cambió (input) a: ${event.target.value}`);
                try {
                    actualizarFormularioAnimales();
                } catch (error) {
                    manejarError(error, 'actualizarFormularioAnimales (input)');
                }
            }, 500);
        });
    } else {
        console.error('No se encontró el campo de cantidad');
    }

    // Configurar event listeners para los campos de transporte y licencia
    const transporteInput = document.getElementById('transporte');
    const licenciaInput = document.getElementById('licencia');

    if (transporteInput) {
        transporteInput.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
    }

    if (licenciaInput) {
        licenciaInput.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
    }

    // --- FUNCIONALIDAD PARA EDITAR COMPRAS ---
    
    // Escuchar cambios en los precios unitarios para recalcular el precio total en formularios de edición
    document.querySelectorAll('.precio-uni-edit').forEach(input => {
        input.addEventListener('change', function() {
            // También aplicar formato al precio
            formatearPrecioCOP(this);
            
            const compraId = this.getAttribute('data-compra');
            if (compraId) {
                recalcularPrecioTotal(compraId);
            } else {
                console.error('No se encontró data-compra en el input:', this);
            }
        });
    });

    // Escuchar cambios en transporte y licencia de modales de edición
    document.querySelectorAll('[id^="transporte-edit-"], [id^="licencia-edit-"]').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            
            // Extraer el ID de la compra del ID del input
            const compraId = this.id.match(/-(\d+)$/)?.[1];
            if (compraId) {
                recalcularPrecioTotal(compraId);
            } else {
                console.error('No se pudo extraer el ID de compra del input:', this);
            }
        });
    });

    // Agregar validación de peso a campos de edición existentes
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

    // Verificar si hay múltiples scripts de compras.js
    const scripts = document.querySelectorAll('script');
    let contadorComprasJS = 0;

    scripts.forEach(script => {
        if (script.src && script.src.includes('compras.js')) {
            contadorComprasJS++;
        }
    });

    if (contadorComprasJS > 1) {
        console.error(`¡ALERTA! Se encontraron ${contadorComprasJS} scripts de compras.js incluidos`);
    }

    // Ejecutar la actualización inicial del formulario
    console.log('Iniciando actualización inicial del formulario');
    try {
        actualizarFormularioAnimales();
    } catch (error) {
        manejarError(error, 'actualización inicial');
    }
});