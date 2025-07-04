document.addEventListener("DOMContentLoaded", () => {
    // Seleccionar el avatar correctamente según tu HTML
    const avatarImg = document.querySelector('.avatar img');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const modalFotoPerfil = document.getElementById('foto_perfil');

    // Función para marcar la foto actualmente seleccionada
    function marcarFotoSeleccionada() {
        const currentImageSrc = avatarImg.src;
        const currentImageName = currentImageSrc.split('/').pop();
        
        // Remover clase 'selected' de todas las opciones
        avatarOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        // Agregar clase 'selected' a la opción actual
        avatarOptions.forEach(option => {
            const optionImageName = option.src.split('/').pop();
            if (optionImageName === currentImageName) {
                option.classList.add('selected');
            }
        });
    }

    // Función para cambiar la imagen del avatar
    function cambiarImagenAvatar(imageSrc, nombreImagen) {
        // Cambiar la imagen en el avatar principal
        avatarImg.src = imageSrc;
        
        // Actualizar la selección visual inmediatamente
        marcarFotoSeleccionada();
        
        // Extraer solo el nombre del archivo para guardar
        const numeroImagen = nombreImagen.split('/').pop().replace('.png', '');
        
        // Guardar el cambio en el servidor
        guardarCampo('imagen_perfil', numeroImagen, function(success, data) {
            if (success) {
                console.log('Imagen de perfil actualizada exitosamente');
                // Cerrar el modal después de guardar
                const modal = bootstrap.Modal.getInstance(modalFotoPerfil);
                if (modal) {
                    modal.hide();
                }
            } else {
                alert('Error al guardar la imagen: ' + (data.error || 'Error desconocido'));
                console.error('Error al guardar:', data);
            }
        });
    }

    // Función genérica para guardar cualquier campo
    function guardarCampo(nombreCampo, valor, callback = null) {
        fetch('/guardar_campo/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({
                'campo': nombreCampo,
                'valor': valor
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`${nombreCampo} guardado exitosamente:`, valor);
                if (callback) callback(true, data);
            } else {
                console.error(`Error al guardar ${nombreCampo}:`, data.error);
                if (callback) callback(false, data);
            }
        })
        .catch(error => {
            console.error('Error de red:', error);
            if (callback) callback(false, {error: 'Error de conexión'});
        });
    }

    // Función para obtener el token CSRF
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Agregar event listeners a todas las opciones de avatar
    avatarOptions.forEach(option => {
        option.addEventListener('click', function() {
            const imageSrc = this.src;
            const nombreImagen = this.src.split('/').pop(); // Obtener solo el nombre del archivo
            cambiarImagenAvatar(imageSrc, nombreImagen);
        });
    });

    // Marcar la foto seleccionada cuando se abre el modal
    modalFotoPerfil.addEventListener('show.bs.modal', function () {
        marcarFotoSeleccionada();
    });

    // Marcar la foto seleccionada al cargar la página
    marcarFotoSeleccionada();

    // Opcional: Función para renderizar imágenes dinámicamente si las cargas desde el servidor
    function renderAvatarOptions(images, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        images.forEach(imageName => {
            const img = document.createElement('img');
            img.src = `/static/img/${imageName}`;
            img.classList.add('avatar-option');
            img.style.cursor = 'pointer';
            img.onerror = () => img.remove(); // Remover si la imagen no existe
            
            img.addEventListener('click', () => {
                cambiarImagenAvatar(img.src, imageName);
            });
            
            container.appendChild(img);
        });
    }
});