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
                        <option value="1-2">1 - 2 años</option>
                        <option value="2-3">2 - 3 años</option>
                        <option value="3-4">3 - 4 años</option>
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
            const animalSeleccionado = animalesDisponibles.find(animal => animal.cod_ani == codigoSeleccionado);
            
            if (animalSeleccionado) {
                // Autocompletar peso si está disponible
                const pesoInput = document.getElementById(`peso_aniven_${i}`);
                if (pesoInput && animalSeleccionado.peso) {
                    pesoInput.value = animalSeleccionado.peso.toString().replace('.', ',');
                }
                
                // Autocompletar edad si está disponible
                const edadSelect = document.getElementById(`edad_aniven_${i}`);
                if (edadSelect && animalSeleccionado.edad) {
                    // Intentar encontrar la opción más cercana
                    const edad = parseInt(animalSeleccionado.edad);
                    if (edad >= 1 && edad < 2) edadSelect.value = '1-2';
                    else if (edad >= 2 && edad < 3) edadSelect.value = '2-3';
                    else if (edad >= 3 && edad <= 4) edadSelect.value = '3-4';
                }
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

// Función para calcular el precio total basado en los precios unitarios
function calcularPrecioTotal() {
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    let total = 0;

    console.log(`Calculando precio total para ${cantidad} animales`);

    for (let i = 1; i <= cantidad; i++) {
        const precioInput = document.getElementById(`precio_uni_${i}`);

        if (precioInput) {
            const precioTexto = precioInput.value.replace(/[^\d]/g, '');
            const precio = parseFloat(precioTexto) || 0;
            total += precio;
        }
    }

    const precioTotalInput = document.getElementById('precio_total');
    if (precioTotalInput) {
        precioTotalInput.value = total.toLocaleString('es-CO');
        console.log(`Precio total actualizado: ${precioTotalInput.value}`);
    }
}

// Función para recalcular el precio total de una venta en edición
function recalcularPrecioTotal(ventaId) {
    const modal = document.getElementById('editModal-' + ventaId);
    if (!modal) {
        console.error(`No se encontró el modal para venta ${ventaId}`);
        return;
    }

    let total = 0;
    
    modal.querySelectorAll('.precio-uni-edit').forEach(input => {
        const precioTexto = input.value.replace(/[^\d]/g, '');
        const precio = parseFloat(precioTexto) || 0;
        total += precio;
    });
    
    const precioTotalInput = document.getElementById('precio_total-edit-' + ventaId);
    if (precioTotalInput) {
        precioTotalInput.value = total.toLocaleString('es-CO');
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