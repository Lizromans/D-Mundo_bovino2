// Contador de llamadas para depuración
let contadorActualizaciones = 0;
let animalesDisponibles = []; // Cache de animales disponibles

// Función para cargar animales disponibles desde la API
async function cargarAnimalesDisponibles() {
    try {
        console.log('Cargando animales disponibles desde API...');
        
        const response = await fetch('/api/animales-disponibles/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            animalesDisponibles = data.animales;
            console.log(`Cargados ${data.total} animales disponibles:`, animalesDisponibles);
            return animalesDisponibles;
        } else {
            console.error('Error en respuesta de API:', data.error);
            return [];
        }
        
    } catch (error) {
        console.error('Error al cargar animales disponibles:', error);
        // En caso de error, usar códigos secuenciales como fallback
        return [];
    }
}

// Función para crear un select con los animales disponibles
function crearSelectAnimales(index, codigoSeleccionado = '') {
    const select = document.createElement('select');
    select.id = `cod_ani_${index}`;
    select.name = `cod_ani_${index}`;
    select.className = 'form-select';
    select.required = true;
    
    // Opción por defecto
    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = 'Selecciona un animal';
    optionDefault.disabled = true;
    optionDefault.selected = !codigoSeleccionado;
    select.appendChild(optionDefault);
    
    // Agregar opciones de animales disponibles
    animalesDisponibles.forEach(animal => {
        const option = document.createElement('option');
        option.value = animal.cod_ani;
        option.textContent = `${animal.cod_ani}` ;
        
        if (codigoSeleccionado && animal.cod_ani == codigoSeleccionado) {
            option.selected = true;
        }
        
        select.appendChild(option);
    });
    
    // Si no hay animales disponibles, mostrar mensaje
    if (animalesDisponibles.length === 0) {
        const optionNoDisponibles = document.createElement('option');
        optionNoDisponibles.value = '';
        optionNoDisponibles.textContent = 'No hay animales disponibles';
        optionNoDisponibles.disabled = true;
        select.appendChild(optionNoDisponibles);
    }
    
    return select;
}

// Función para validar y formatear peso con coma decimal
function validarYFormatearPeso(input) {
    let valor = input.value.trim();
    
    if (!valor) {
        return;
    }
    
    // Permitir punto o coma como separador decimal
    const regexPeso = /^\d+([,.]\d{1,2})?$/;
    
    if (!regexPeso.test(valor)) {
        input.setCustomValidity('Formato inválido. Use formato como: 155,50 o 155.50');
        input.reportValidity();
        return false;
    }
    
    const valorNormalizado = valor.replace(',', '.');
    const pesoNumerico = parseFloat(valorNormalizado);
    
    if (isNaN(pesoNumerico) || pesoNumerico <= 0) {
        input.setCustomValidity('El peso debe ser mayor que 0');
        input.reportValidity();
        return false;
    }
    
    input.setCustomValidity('');
    return true;
}

// Función para determinar el rango de edad basado en la edad numérica
function determinarRangoEdad(edad) {
    const edadNum = parseFloat(edad);
    
    if (edadNum >= 0 && edadNum < 1) {
        return '0 - 1';
    } else if (edadNum >= 1 && edadNum < 2) {
        return '1 - 2';
    } else if (edadNum >= 2 && edadNum < 3) {
        return '2 - 3';
    } else if (edadNum >= 3 && edadNum < 4) {
        return '3 - 4';
    } else if (edadNum >= 4) {
        return '4 - mas';
    }
    
    return null;
}

// Función para actualizar el formulario de animales basado en la cantidad
async function actualizarFormularioAnimales() {
    contadorActualizaciones++;
    console.log(`Llamada #${contadorActualizaciones} a actualizarFormularioAnimales`);

    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    console.log(`Cantidad seleccionada: ${cantidad}`);

    const contenedor = document.getElementById('detalles_animales');
    if (!contenedor) {
        console.error('ERROR: No se encontró el elemento con ID "detalles_animales"');
        return;
    }

    // Limpiar contenedor
    contenedor.innerHTML = '';

    if (cantidad <= 0) {
        console.log('Cantidad es 0 o negativa, no se generan campos');
        // Limpiar precio total
        const precioTotalInput = document.getElementById('precio_total');
        if (precioTotalInput) {
            precioTotalInput.value = '';
        }
        return;
    }

    // Cargar animales disponibles si no están cargados
    if (animalesDisponibles.length === 0) {
        await cargarAnimalesDisponibles();
    }

    // Generar campos para cada animal
    console.log(`Generando ${cantidad} campos de animales`);

    for (let i = 1; i <= cantidad; i++) {
        console.log(`Generando campo para animal #${i}`);

        const animalDiv = document.createElement('div');
        animalDiv.classList.add('card', 'mb-3', 'p-3');
        animalDiv.dataset.animal = i;

        // Crear el select de animales
        const selectAnimales = crearSelectAnimales(i);

        animalDiv.innerHTML = `
            <h5 class="card-title">Animal #${i}</h5>
            <div class="row">
                <div class="col-md-4">
                    <label for="cod_ani_${i}">Código Animal:</label>
                    <div id="select_container_${i}"></div>
                </div>
                <div class="col-md-8">
                    <label for="edad_aniven_${i}">Edad:</label>
                    <select id="edad_aniven_${i}" name="edad_aniven_${i}" class="form-select" required>
                        <option value="" disabled selected>Selecciona una edad</option>
                        <option value="0 - 1">0 - 1 años</option>
                        <option value="1 - 2">1 - 2 años</option>
                        <option value="2 - 3">2 - 3 años</option>
                        <option value="3 - 4">3 - 4 años</option>
                        <option value="4 - mas">4 años - más</option>
                    </select>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-6">
                    <label for="peso_aniven_${i}">Peso (kg):</label>
                    <input type="text" id="peso_aniven_${i}" name="peso_aniven_${i}" class="form-control peso-input" 
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
        
        // Insertar el select en su contenedor
        const selectContainer = document.getElementById(`select_container_${i}`);
        selectContainer.appendChild(selectAnimales);

        // Agregar evento para autocompletar peso cuando se selecciona un animal
        selectAnimales.addEventListener('change', function() {
            const codigoSeleccionado = this.value;
            console.log(`Animal seleccionado: ${codigoSeleccionado}`);
            
            if (!codigoSeleccionado) {
                console.log('No se seleccionó ningún animal válido');
                return;
            }
            
            // Buscar el animal en la lista de disponibles
            const animalSeleccionado = animalesDisponibles.find(animal => 
                animal.cod_ani.toString() === codigoSeleccionado.toString()
            );
            
            console.log('Animal encontrado:', animalSeleccionado);
            
            if (animalSeleccionado) {
                // Autocompletar peso si está disponible
                const pesoInput = document.getElementById(`peso_aniven_${i}`);
                if (pesoInput && animalSeleccionado.peso) {
                    let pesoFormateado = animalSeleccionado.peso.toString();
                    // Convertir punto decimal a coma si es necesario
                    if (pesoFormateado.includes('.')) {
                        pesoFormateado = pesoFormateado.replace('.', ',');
                    }
                    pesoInput.value = pesoFormateado;
                    console.log(`Peso autocompletado para animal ${i}: ${pesoFormateado}`);
                } else {
                    console.log(`No se pudo autocompletar el peso para animal ${i}. Input encontrado:`, !!pesoInput, 'Peso disponible:', animalSeleccionado.peso);
                }
                
                // Autocompletar edad si está disponible
                const edadSelect = document.getElementById(`edad_aniven_${i}`);
                if (edadSelect && animalSeleccionado.edad) {
                    const rangoEdad = determinarRangoEdad(animalSeleccionado.edad);
                    if (rangoEdad) {
                        edadSelect.value = rangoEdad;
                        console.log(`Edad autocompletada para animal ${i}: ${rangoEdad} (edad original: ${animalSeleccionado.edad})`);
                    } else {
                        console.log(`No se pudo determinar el rango de edad para: ${animalSeleccionado.edad}`);
                    }
                } else {
                    console.log(`No se pudo autocompletar la edad para animal ${i}. Select encontrado:`, !!edadSelect, 'Edad disponible:', animalSeleccionado.edad);
                }
            } else {
                console.log(`No se encontró el animal con código: ${codigoSeleccionado}`);
                console.log('Animales disponibles:', animalesDisponibles.map(a => a.cod_ani));
            }
        });
    }

    console.log(`Generación completada. Contenedor ahora tiene ${contenedor.children.length} elementos`);

    // Agregar event listeners a los campos de peso
    contenedor.querySelectorAll('.peso-input').forEach(input => {
        input.addEventListener('blur', function() {
            validarYFormatearPeso(this);
        });
        
        input.addEventListener('input', function() {
            this.setCustomValidity('');
        });
    });

    // Agregar event listeners a los campos de precio
    contenedor.querySelectorAll('.precio-input').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
    });

    // Calcular precio total inicial después de generar campos
    calcularPrecioTotal();

    // Actualizar formato del campo de precio total
    const precioTotalInput = document.getElementById('precio_total');
    if (precioTotalInput) {
        const precioTotalContainer = precioTotalInput.parentElement;
        const yaFormateado = precioTotalContainer.querySelector('.input-group-text');

        if (!yaFormateado) {
            console.log('Formateando campo de precio total');
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';

            const currencySymbol = document.createElement('span');
            currencySymbol.className = 'input-group-text';
            currencySymbol.textContent = '$';

            precioTotalInput.parentNode.insertBefore(inputGroup, precioTotalInput);
            inputGroup.appendChild(currencySymbol);
            inputGroup.appendChild(precioTotalInput);

            precioTotalInput.setAttribute('readonly', true);
        }
    }
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
    const transporteInput = document.getElementById('valor_transporte');
    const licenciaInput = document.getElementById('valor_licencia');
    
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

// Función para recalcular el precio total de una venta en edición
function recalcularPrecioTotal(ventaId) {
    const modal = document.getElementById('editModal-' + ventaId);
    if (!modal) {
        console.error(`No se encontró el modal para venta ${ventaId}`);
        return;
    }

    let totalAnimales = 0;
    
    // Sumar todos los precios unitarios de los animales
    modal.querySelectorAll('.precio-uni-edit').forEach(input => {
        const precio = obtenerValorNumerico(input);
        totalAnimales += precio;
    });
    
    // Obtener valores de transporte y licencia del modal de edición
    const transporteInput = document.getElementById('valor_transporte-edit-' + ventaId);
    const licenciaInput = document.getElementById('valor_licencia-edit-' + ventaId);
    
    const valorTransporte = obtenerValorNumerico(transporteInput);
    const valorLicencia = obtenerValorNumerico(licenciaInput);
    
    console.log(`Edición venta ${ventaId} - Animales: ${totalAnimales}, Transporte: ${valorTransporte}, Licencia: ${valorLicencia}`);
    
    // Calcular total final
    const totalFinal = totalAnimales + valorTransporte + valorLicencia;
    
    // Actualizar el precio total
    const precioTotalInput = document.getElementById('precio_total-edit-' + ventaId);
    if (precioTotalInput) {
        precioTotalInput.value = totalFinal.toLocaleString('es-CO');
        console.log(`Precio total actualizado para venta ${ventaId}: ${precioTotalInput.value}`);
    } else {
        console.error(`No se encontró el campo precio_total-edit-${ventaId}`);
    }
}

// Inicializar el formulario
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM cargado. Inicializando formulario de ventas...');

    // Cargar animales disponibles al inicio
    await cargarAnimalesDisponibles();

    // Configurar event listener para el campo de cantidad
    const cantidadInput = document.getElementById('cantidad');
    if (cantidadInput) {
        const nuevoInput = cantidadInput.cloneNode(true);
        cantidadInput.parentNode.replaceChild(nuevoInput, cantidadInput);

        nuevoInput.addEventListener('change', function(event) {
            console.log(`Campo de cantidad cambió a: ${event.target.value}`);
            actualizarFormularioAnimales();
        });

        nuevoInput.addEventListener('input', function(event) {
            clearTimeout(window.inputTimeout);
            window.inputTimeout = setTimeout(() => {
                actualizarFormularioAnimales();
            }, 500);
        });
    }

    // Configurar event listeners para los campos de transporte y licencia
    const transporteInput = document.getElementById('valor_transporte');
    const licenciaInput = document.getElementById('valor_licencia');

    if (transporteInput) {
        transporteInput.addEventListener('change', function() {
            formatearPrecioCOP(this);
            calcularPrecioTotal();
        });
        
        // También agregar listener para el evento 'input' para recálculo en tiempo real
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
        
        // También agregar listener para el evento 'input' para recálculo en tiempo real
        licenciaInput.addEventListener('input', function() {
            clearTimeout(window.licenciaTimeout);
            window.licenciaTimeout = setTimeout(() => {
                formatearPrecioCOP(this);
                calcularPrecioTotal();
            }, 300);
        });
    }

    // Funcionalidad para editar ventas
    document.querySelectorAll('.precio-uni-edit').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            const ventaId = this.getAttribute('data-venta');
            if (ventaId) {
                recalcularPrecioTotal(ventaId);
            }
        });
    });

    // Escuchar cambios en transporte y licencia de modales de edición
    document.querySelectorAll('[id^="valor_transporte-edit-"], [id^="valor_licencia-edit-"]').forEach(input => {
        input.addEventListener('change', function() {
            formatearPrecioCOP(this);
            
            // Extraer el ID de la venta del ID del input
            const ventaId = this.id.match(/-(\d+)$/)?.[1];
            if (ventaId) {
                recalcularPrecioTotal(ventaId);
            } else {
                console.error('No se pudo extraer el ID de venta del input:', this);
            }
        });
    });

    // Validación de peso en campos de edición
    document.querySelectorAll('input[name^="peso_aniven_"]').forEach(input => {
        input.addEventListener('blur', function() {
            validarYFormatearPeso(this);
        });
        
        input.addEventListener('input', function() {
            this.setCustomValidity('');
        });
    });
    
    // Inicializar modales de edición
    document.querySelectorAll('[id^="editModal-"]').forEach(modal => {
        const ventaId = modal.id.replace('editModal-', '');
        recalcularPrecioTotal(ventaId);
    });

    // Ejecutar actualización inicial
    actualizarFormularioAnimales();
});