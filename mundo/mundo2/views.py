from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.hashers import check_password, make_password
from .forms import AdministradorRegistroForm, FormularioSoporte
from django.core.mail import EmailMessage
from .models import Administrador, Agenda, Animal, Documento, Compra, DetCom, Venta, DetVen, Contacto
from django.db import connection, models
from functools import wraps
from datetime import date, datetime, timedelta, time
from decimal import Decimal, InvalidOperation
from django.utils import timezone  # Importación correcta para timezone
import calendar, re
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_str, force_bytes
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction, IntegrityError
from xhtml2pdf import pisa
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import get_object_or_404


# Create your views here.
def bienvenido(request):
    return render(request, 'paginas/bienvenido.html')

def preguntasfrecuentes(request):
    return render(request, 'paginas/faq.html')

"vistas para registro e inicio de sesión"
def registro(request):
    # Reiniciar AUTO_INCREMENT si es necesario
    with connection.cursor() as cursor:
        table_administrador = Administrador._meta.db_table
        cursor.execute(f"ALTER TABLE {table_administrador} AUTO_INCREMENT = 1;")
    
    if request.method == 'POST':
        form = AdministradorRegistroForm(request.POST)
        
        if form.is_valid():
            try:
                # Guardar el administrador con ambas contraseñas pero como no verificado
                administrador = form.save(commit=False)
                administrador.email_verificado = False
                administrador.save()
                
                # Generar token de verificación y enviar correo
                administrador.generar_token_verificacion()
                administrador.enviar_email_verificacion(request)
                
                messages.success(
                    request, 
                    "¡Registro exitoso! Por favor, verifica tu correo electrónico para activar tu cuenta."
                )
                return redirect('iniciarsesion')
            except Exception as e:
                # Si hay error al guardar, mostrarlo
                messages.error(request, f"Error al registrar usuario: {str(e)}")
        else:
            # Si el formulario tiene errores, se mostrará con los errores
            pass
    else:
        form = AdministradorRegistroForm()
    
    return render(request, 'paginas/registro.html', {
        'form': form,
        'current_page_name': 'Registro'
    })

# Vista para verificar el correo electrónico
def verificar_email(request, token):
    try:
        # Buscar el administrador con este token
        administrador = Administrador.objects.get(token_verificacion=token)
        
        # Verificar si el token ha expirado
        if administrador.token_expira and administrador.token_expira < timezone.now():
            messages.error(request, "El enlace de verificación ha expirado. Por favor, solicita uno nuevo.")
            return redirect('iniciarsesion')
        
        # Marcar como verificado
        administrador.email_verificado = True
        administrador.token_verificacion = None
        administrador.token_expira = None
        administrador.save()
        
        messages.success(request, "¡Tu correo electrónico ha sido verificado correctamente! Ahora puedes iniciar sesión.")
        return redirect('iniciarsesion')
        
    except Administrador.DoesNotExist:
        messages.error(request, "El enlace de verificación no es válido.")
        return redirect('iniciarsesion') 

def iniciarsesion(request):
    error_user = None
    error_password = None
    
    if request.method == 'POST':
        usuario = request.POST.get('username')
        contraseña = request.POST.get('password')
        
        # Formulario de validación
        if not usuario:
            error_user = 'El nombre de usuario es obligatorio'
        if not contraseña:
            error_password = 'La contraseña es obligatoria'
            
        if error_user or error_password:
            return render(request, 'paginas/iniciarsesion.html', {
                'error_user': error_user,
                'error_password': error_password,
                'current_page_name': 'Iniciar Sesión'
            })
        
        try:
            admin = Administrador.objects.get(nom_usu=usuario)
            
            if check_password(contraseña, admin.contraseña):
                request.session['usuario_id'] = admin.id_adm
                request.session['nom_usu'] = admin.nom_usu
                request.session['finca'] = admin.finca
                
                if request.POST.get('recordar'):
                    request.session.set_expiry(1209600)  # 2 semanas
                else:
                    request.session.set_expiry(0)  # no recordar
                    
                messages.success(request, f"¡Bienvenido {admin.nom_usu}!")
                return redirect('home')
            else:
                error_password = 'Contraseña incorrecta'
        except Administrador.DoesNotExist:
            error_user = 'Usuario no encontrado'
        except Exception as e:
            print(f"Error durante inicio de sesión: {e}")
            messages.error(request, "Error de conexión. Intente más tarde.")
    
    return render(request, 'paginas/iniciarsesion.html', {
        'error_user': error_user,
        'error_password': error_password,
        'current_page_name': 'Iniciar Sesión'
    })

def mostrar_recuperar_contrasena(request):
    """
    Esta vista simplemente muestra la misma plantilla de inicio de sesión
    pero con el modal de recuperación de contraseña visible
    """
    return render(request, 'paginas/iniciarsesion.html', {
        'mostrar_modal': True,
        'current_page_name': 'Recuperar Contraseña'
    })

def recuperar_contrasena(request):
    """
    Esta vista procesa el formulario de recuperación de contraseña
    """
    if request.method == 'POST':
        email = request.POST.get('email')
        
        if not email:
            return render(request, 'paginas/iniciarsesion.html', {
                'mostrar_modal': True,
                'email_error': 'El correo electrónico es obligatorio',
                'current_page_name': 'Recuperar Contraseña'
            })
        
        try:
            # Verificar si existe un administrador con ese correo
            admin = Administrador.objects.filter(correo=email).first()
            
            if admin:
                # Generar el token y el uid codificado para el enlace de restablecimiento
                uid = urlsafe_base64_encode(force_bytes(admin.pk))
                token = default_token_generator.make_token(admin)
                
                # Construir el enlace de restablecimiento
                reset_link = f"{request.scheme}://{request.get_host()}/reset-password/{uid}/{token}/"
                
                try:
                    # Preparar y enviar el correo
                    subject = "Restablecimiento de contraseña - Mundo Bovino"
                    message = render_to_string('paginas/reset_password_email.html', {
                        'user': admin,
                        'reset_link': reset_link,
                        'site_name': 'Mundo Bovino'
                    })
                    
                    # Cambiado fail_silently a False para que muestre errores
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        [admin.correo],
                        html_message=message,
                        fail_silently=False
                    )
                    print(f"Correo enviado exitosamente a {admin.correo}")
                except Exception as email_error:
                    print(f"Error al enviar correo: {email_error}")
                    # Ahora mostramos el error al usuario para facilitar la depuración
                    messages.error(request, f"Problema al enviar el correo: {email_error}")
                    return redirect('iniciarsesion')
                
            # Por seguridad, mostramos un mensaje genérico independientemente de si el correo existe o no
            messages.success(request, "Si el correo está asociado a una cuenta, recibirás instrucciones para restablecer tu contraseña.")
            return redirect('iniciarsesion')
            
        except Exception as e:
            print(f"Error durante recuperación de contraseña: {e}")
            messages.error(request, f"{str(e)}")
            return redirect('iniciarsesion')
    
    # Si no es POST, redirigir a la página de inicio de sesión
    return redirect('iniciarsesion')

def reset_password(request, uidb64, token):
    """
    Vista para mostrar el formulario de restablecimiento de contraseña
    cuando el usuario hace clic en el enlace del correo
    """
    try:
        # Decodificar el uid para obtener el ID del usuario
        uid = force_str(urlsafe_base64_decode(uidb64))
        admin = Administrador.objects.get(pk=uid)
        
        # Verificar que el token sea válido
        if default_token_generator.check_token(admin, token):
            print(f"Token válido para el usuario: {admin.nom_usu}")
            return render(request, 'paginas/reset_password.html', {
                'valid': True,
                'uidb64': uidb64,
                'token': token,
                'current_page_name': 'Restablecer Contraseña'
            })
        else:
            print("Token inválido o expirado")
            messages.error(request, "El enlace de restablecimiento no es válido o ha expirado.")
            return redirect('iniciarsesion')
            
    except Exception as e:
        print(f"Error en reset_password: {e}")
        messages.error(request, f"Error al procesar el enlace de restablecimiento: {e}")
        return redirect('iniciarsesion')
    
def reset_password_confirm(request):
    """
    Vista para procesar el formulario de restablecimiento de contraseña
    """
    if request.method == 'POST':
        uidb64 = request.POST.get('uidb64')
        token = request.POST.get('token')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')
        
        # Validar que ambas contraseñas coincidan
        if password1 != password2:
            return render(request, 'paginas/reset_password.html', {
                'valid': True,
                'uidb64': uidb64,
                'token': token,
                'error': 'Las contraseñas no coinciden',
                'current_page_name': 'Restablecer Contraseña'
            })
        
        try:
            # Decodificar el uid para obtener el ID del usuario
            uid = force_str(urlsafe_base64_decode(uidb64))
            admin = Administrador.objects.get(pk=uid)
            
            # Verificar que el token sea válido
            if default_token_generator.check_token(admin, token):
                # Cambiar la contraseña usando el nombre correcto del campo (contraseña con ñ)
                admin.contraseña = make_password(password1)
                admin.confcontraseña = make_password(password1)  # Actualizar también la confirmación
                admin.save()
                
                messages.success(request, "Tu contraseña ha sido restablecida con éxito. Ahora puedes iniciar sesión.")
                return redirect('iniciarsesion')
            else:
                messages.error(request, "El enlace de restablecimiento no es válido o ha expirado.")
                return redirect('iniciarsesion')
                
        except (TypeError, ValueError, OverflowError, Administrador.DoesNotExist):
            messages.error(request, "El enlace de restablecimiento no es válido.")
            return redirect('iniciarsesion')
    
    # Si no es POST, redirigir a la página de inicio de sesión
    return redirect('iniciarsesion')

def login_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not hasattr(request, 'session') or 'usuario_id' not in request.session:
            messages.error(request, "Debes iniciar sesión primero")
            return redirect('iniciarsesion')
        
        # Incluir información de recordatorios en todas las vistas
        usuario_id = request.session.get('usuario_id')
        recordatorios = obtener_recordatorios(usuario_id)
        
        # Contar recordatorios regulares
        hay_recordatorios_regulares = any(len(eventos) > 0 for periodo, eventos in recordatorios.items() if periodo != 'vacunacion')
        total_recordatorios_regulares = sum(len(eventos) for periodo, eventos in recordatorios.items() if periodo != 'vacunacion')
        
        # Contar recordatorios de vacunación
        hay_recordatorios_vacunacion = len(recordatorios.get('vacunacion', [])) > 0
        total_recordatorios_vacunacion = len(recordatorios.get('vacunacion', []))
        
        # Total general
        hay_recordatorios = hay_recordatorios_regulares or hay_recordatorios_vacunacion
        total_recordatorios = total_recordatorios_regulares + total_recordatorios_vacunacion
        
        # Agregar datos de recordatorios a request para acceder en la vista
        request.recordatorios = recordatorios
        request.hay_recordatorios = hay_recordatorios
        request.total_recordatorios = total_recordatorios
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view

"Vistas para home y configuraciones"
@login_required
def home(request):
    context = {
        'current_page_name': 'Home',
        'recordatorios': request.recordatorios,
        'hay_recordatorios': request.hay_recordatorios,
        'total_recordatorios': request.total_recordatorios
    }
    return render(request, 'paginas/home.html', context)

@login_required
def configuraciones(request):
    usuario_id = request.session.get('usuario_id')
    
    try:
        admin = Administrador.objects.get(pk=usuario_id)
        
        if request.method == 'POST':
            admin.nom_usu = request.POST.get('nom_usu', admin.nom_usu)
            admin.correo = request.POST.get('email', admin.correo)
            admin.save()
            
            request.session['modulo_inventario'] = 'inventario' in request.POST
            request.session['modulo_ventas'] = 'registroVentas' in request.POST
            request.session['modulo_calendario'] = 'calendario' in request.POST
            request.session['modulo_documentos'] = 'documentos' in request.POST
            request.session['modulo_agenda'] = 'contactos' in request.POST
            
            messages.success(request, "¡Cambios guardados correctamente!")
            return redirect('configuraciones')
        
        perfil = {
            'modulo_inventario': request.session.get('modulo_inventario', True),
            'modulo_ventas': request.session.get('modulo_ventas', True),
            'modulo_calendario': request.session.get('modulo_calendario', True),
            'modulo_documentos': request.session.get('modulo_documentos', True),
            'modulo_agenda': request.session.get('modulo_agenda', True)
        }
        
        return render(request, 'paginas/configuraciones.html', {
            'admin': admin,
            'perfil': perfil,
            'current_page': 'configuraciones',
            'current_page_name': 'Configuraciones'
        })
        
    except Administrador.DoesNotExist:
        messages.error(request, "Usuario no encontrado. Por favor inicie sesión nuevamente.")
        return redirect('iniciarsesion')
    except Exception as e:
        messages.error(request, f"Error al cargar la configuración: {str(e)}")
        return redirect('home')

@login_required
def notificaciones(request):
    notif_settings = {
        'notif_email': request.session.get('notif_email', False),
        'notif_push': request.session.get('notif_push', False),
    }
    
    if request.method == 'POST':
        notif_settings['notif_email'] = 'notif_email' in request.POST
        notif_settings['notif_push'] = 'notif_push' in request.POST
        
        messages.success(request, "Preferencias de notificaciones actualizadas correctamente")
        return redirect('notificaciones')
    
    context = {
        'current_page': 'notificaciones',
        'current_page_name': 'Notificaciones',
        **notif_settings
    }
    
    return render(request, 'paginas/notificaciones.html', context)

@login_required
def privacidad(request):
    usuario_id = request.session.get('usuario_id')
    
    try:
        admin = Administrador.objects.get(pk=usuario_id)
        
        if request.method == 'POST':
            contraseña_actual = request.POST.get('contraseña_actual')
            nueva_contraseña = request.POST.get('nueva_contraseña')
            confirmar_contraseña = request.POST.get('confirmar_contraseña')
            
            if not check_password(contraseña_actual, admin.contraseña):
                messages.error(request, "La contraseña actual es incorrecta")
                return redirect('privacidad')
            
            if nueva_contraseña != confirmar_contraseña:
                messages.error(request, "Las contraseñas no coinciden")
                return redirect('privacidad')
            
            if len(nueva_contraseña) < 8:
                messages.error(request, "La contraseña debe tener al menos 8 caracteres")
                return redirect('privacidad')
            
            admin.contraseña = make_password(nueva_contraseña)
            admin.save()
            
            messages.success(request, "Contraseña actualizada correctamente")
            return redirect('configuraciones')
            
    except Administrador.DoesNotExist:
        messages.error(request, "Usuario no encontrado. Por favor inicie sesión nuevamente")
        return redirect('iniciarsesion')
    except Exception as e:
        messages.error(request, f"Error al actualizar la contraseña: {str(e)}")
        return redirect('privacidad')
    
    return render(request, 'paginas/privacidad.html', {
        'current_page': 'privacidad',
        'current_page_name': 'Privacidad'
    })

"Vistas para crud de animales"
@login_required
def inventario(request):
    # Obtener el ID del administrador actual desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    # Iniciar con todos los animales del administrador
    animales = Animal.objects.filter(id_adm=usuario_id)
    
    # Obtener parámetros de búsqueda y filtrado
    busqueda = request.GET.get('busqueda', '')
    tipo_filtro = request.GET.get('tipo_filtro', '')
    valor_filtro = request.GET.get('valor', '')
    
    # Variable para almacenar el tipo de búsqueda detectado
    tipo_busqueda = None
    
    # Aplicar filtros de búsqueda si existe un término
    if busqueda:
        from django.db.models import Q
        import re
        
        # 1. Verificar si la búsqueda es un código de animal (formato numérico)
        if re.match(r'^\d+$', busqueda) and len(busqueda) <= 5:  # Asumiendo que códigos son números menores a 99999
            # Búsqueda exacta por código de animal
            animales = animales.filter(cod_ani=int(busqueda))
            tipo_busqueda = "codigo"
        
        # 2. Verificar si la búsqueda es una fecha (formato yyyy-mm-dd o dd/mm/yyyy)
        elif re.match(r'^(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})$', busqueda):
            # Convertir formato dd/mm/yyyy a yyyy-mm-dd si es necesario
            if '/' in busqueda:
                day, month, year = busqueda.split('/')
                busqueda_fecha = f"{year}-{month}-{day}"
            else:
                busqueda_fecha = busqueda
                
            # Filtrar por fecha de ingreso
            animales = animales.filter(fecha=busqueda_fecha)
            tipo_busqueda = "fecha"
        
        # 3. Verificar si la búsqueda es una edad individual o rango de edades
        elif re.match(r'^\d+(-\d+)?(\s*años?)?$', busqueda.strip()):
            busqueda_limpia = busqueda.strip().replace(' años', '').replace(' año', '')
            
            if '-' in busqueda_limpia:
                # Buscar exactamente el rango ingresado
                animales = animales.filter(edad=busqueda_limpia)
                tipo_busqueda = f"rango de edad ({busqueda_limpia} años)"
            else:
                # Para edad individual, buscar en qué rango está incluida
                edad_buscada = int(busqueda_limpia)
                # Filtrar rangos que contengan esta edad
                animales = animales.filter(
                    Q(edad__contains=f"{edad_buscada}-") |  # Comienza con la edad
                    Q(edad__contains=f"-{edad_buscada}")    # Termina con la edad
                )
                tipo_busqueda = f"edad {edad_buscada} años"
    
    # Aplicar filtro por estado o edad si se ha seleccionado
    if tipo_filtro == 'Estado' and valor_filtro:
        animales = animales.filter(estado=valor_filtro)
    elif tipo_filtro == 'Edad' and valor_filtro:
        animales = animales.filter(edad=valor_filtro)
    
    # FORMATEAR EL PESO DE CADA ANIMAL
    for animal in animales:
        if animal.peso:
            # Formato con 2 decimal: 000,00
            animal.peso_formateado = f"{animal.peso:.2f}".replace('.', ',')

        else:
            animal.peso_formateado = "0,00"
    
    # Separar animales por estado
    animales_disponibles = animales.exclude(estado='Vendido')
    animales_vendidos = animales.filter(estado='Vendido')

    # Determinar el siguiente código de animal para este administrador
    proximo_codigo = 1
    ultimo_animal = Animal.objects.filter(id_adm=usuario_id).order_by('-cod_ani').first()
    if ultimo_animal:
        proximo_codigo = ultimo_animal.cod_ani + 1
    
    return render(request, "paginas/inventario.html", {
        "proximo_codigo": proximo_codigo,
        "animales": animales,
        "current_page_name": "Inventario",
        "busqueda": busqueda,
        "tipo_filtro": tipo_filtro,
        "valor_filtro": valor_filtro,
        "tipo_busqueda": tipo_busqueda,  # Pasar el tipo de búsqueda detectado a la plantilla
        'animales_disponibles': animales_disponibles,
        'animales_vendidos': animales_vendidos,
        'recordatorios': request.recordatorios,
        'hay_recordatorios': request.hay_recordatorios,
        'total_recordatorios': request.total_recordatorios
    })

@login_required
def registrar_animal(request):
    if request.method == "POST":
        usuario_id = request.session.get('usuario_id')
        
        try:
            administrador = Administrador.objects.get(pk=usuario_id)
            
            ultimo_animal = Animal.objects.filter(id_adm=usuario_id).order_by('-cod_ani').first()
            siguiente_cod_ani = 1
            
            if ultimo_animal:
                siguiente_cod_ani = ultimo_animal.cod_ani + 1
            
            # Obtener datos del formulario
            fecha_str = request.POST.get("fecha")
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()  # .date() para DateField
            edad = str(request.POST.get("edad"))
            
            # FORMA CORRECTA de manejar Decimal con soporte para formato con coma
            peso_str = request.POST.get("peso")
            peso = None
            if peso_str and peso_str.strip():  # Verificar que no esté vacío
                try:
                    # Permitir entrada con coma como separador decimal
                    peso_normalizado = peso_str.replace(',', '.')
                    peso = Decimal(peso_normalizado)
                    
                    # Validar que el peso sea positivo
                    if peso <= 0:
                        messages.error(request, "Error: El peso debe ser mayor que cero.")
                        return redirect('inventario')
                        
                except (ValueError, InvalidOperation):
                    messages.error(request, "Error: El peso debe ser un número válido (ej: 15,05 o 15.05).")
                    return redirect('inventario')
            
            raza = request.POST.get("raza")
            estado = request.POST.get("estado")
            
            # Crear y guardar el nuevo animal
            nuevo_animal = Animal(
                cod_ani=siguiente_cod_ani,
                fecha=fecha,
                edad=edad,
                peso=peso,  # Puede ser None o un Decimal
                raza=raza,
                estado=estado,
                id_adm=administrador
            )
            nuevo_animal.save()
            
            messages.success(request, f"¡Animal registrado con éxito!")
            
        except Administrador.DoesNotExist:
            messages.error(request, "Error: No se pudo encontrar el administrador.")
        except Exception as e:
            messages.error(request, f"Error al registrar el animal: {str(e)}")
        
        return redirect('inventario')
    
    return redirect('inventario')

def marcar_vendido(request, cod_ani):
    if request.method == 'POST':
        try:
            animal = Animal.objects.get(cod_ani=cod_ani)
            animal.estado = 'Vendido'
            animal.save()
            messages.success(request, f'Animal {cod_ani} marcado como vendido exitosamente.')
        except Animal.DoesNotExist:
            messages.error(request, 'Animal no encontrado.')
    return redirect('inventario')

def restaurar_animal(request, cod_ani):
    if request.method == 'POST':
        try:
            animal = Animal.objects.get(cod_ani=cod_ani)
            animal.estado = 'Saludable'  # O el estado que prefieras por defecto
            animal.save()
            messages.success(request, f'Animal {cod_ani} cambiado a disponible.')
        except Animal.DoesNotExist:
            messages.error(request, 'Animal no encontrado.')
    return redirect('inventario')

@login_required
def eliminar_animal(request, animal_id):
    if request.method == "POST":
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener el animal asegurándose que pertenezca al administrador actual
            animal = get_object_or_404(Animal, cod_ani=animal_id, id_adm=usuario_id)
            
            # Eliminar el animal
            animal.delete()
            
            messages.success(request, f"Animal eliminado con éxito!")
            
        except Animal.DoesNotExist:
            messages.error(request, "Error: No se encontró el animal.")
        except Exception as e:
            messages.error(request, f"Error al eliminar el animal: {str(e)}")
        
        return redirect('inventario')
    
    # Si no es un POST, redirigir al inventario
    return redirect('inventario')

@login_required
def editar_animal(request, animal_id):
    # Obtener el ID del administrador actual desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    # Obtener el animal asegurándose que pertenezca al administrador actual
    animal = get_object_or_404(Animal, cod_ani=animal_id, id_adm=usuario_id)
    
    if request.method == "POST":
        try:
            # Obtener datos del formulario
            fecha_str = request.POST.get("fecha")
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
            edad = str(request.POST.get("edad"))
            
            # Manejar el peso con formato decimal
            peso_str = request.POST.get("peso")
            peso = None
            if peso_str and peso_str.strip():
                try:
                    # Permitir entrada con coma como separador decimal
                    peso_normalizado = peso_str.replace(',', '.')
                    peso = Decimal(peso_normalizado)
                    
                    # Validar que el peso sea positivo
                    if peso <= 0:
                        messages.error(request, "Error: El peso debe ser mayor que cero.")
                        return render(request, "paginas/Inventario.html", {
                            "animal": animal,
                            "current_page_name": "Inventario"
                        })
                        
                except (ValueError, InvalidOperation):
                    messages.error(request, "Error: El peso debe ser un número válido (ej: 155,05 o 155.05).")
                    return render(request, "paginas/Inventario.html", {
                        "animal": animal,
                        "current_page_name": "Inventario"
                    })
            
            raza = request.POST.get("raza")
            estado = request.POST.get("estado")
            
            # Actualizar el animal
            animal.fecha = fecha
            animal.edad = edad
            animal.peso = peso
            animal.raza = raza
            animal.estado = estado
            animal.save()
            
            messages.success(request, f"¡Animal actualizado con éxito!")
            return redirect('inventario')
            
        except Exception as e:
            messages.error(request, f"Error al actualizar el animal: {str(e)}")
    
    # Para GET request, formatear el peso para mostrar en el formulario
    if animal.peso:
        animal.peso_formateado = f"{animal.peso:.2f}".replace('.', ',')
    else:
        animal.peso_formateado = "0,00"

    
    return render(request, "paginas/Inventario.html", {
        "animal": animal,
        "current_page_name": "Inventario",
        'recordatorios': request.recordatorios,
        'hay_recordatorios': request.hay_recordatorios,
        'total_recordatorios': request.total_recordatorios
    })

@login_required
def cancelar_animal(request):
    
    if request.method == 'POST':
        messages.info(request, "Registro de animal cancelado")
        return redirect('inventario')
    else:
        return redirect('inventario')
    
"Vistas para crud de agenda"
@login_required
def calendario(request):
    usuario_id = request.session.get('usuario_id')
    
    # Obtener todos los eventos del administrador actual
    eventos = Agenda.objects.filter(id_adm=usuario_id)
    
    # Obtener recordatorios para eventos próximos
    recordatorios = obtener_recordatorios(usuario_id)
    
    # Comprobar si hay recordatorios para mostrar notificación en la UI
    hay_recordatorios = any(len(eventos) > 0 for eventos in recordatorios.values())
    
    # Contar total de recordatorios
    total_recordatorios = sum(len(eventos) for eventos in recordatorios.values())
    
    # Procesar filtros y búsquedas
    tipo_filtro = request.GET.get('tipo_filtro')
    busqueda = request.GET.get('busqueda')
    
    # Aplicar filtros si están presentes
    resultados_busqueda = None
    if busqueda or tipo_filtro:
        # Crear queryset base para la búsqueda
        resultados = eventos
        
        # Aplicar filtro por tipo o estado solo si se proporciona un filtro
        if tipo_filtro:
            if tipo_filtro in ['Evento', 'Tarea']:  # Filtrar por tipo
                resultados = resultados.filter(tipo=tipo_filtro)
            elif tipo_filtro in ['Pendiente', 'Reprogramada', 'Cancelada', 'Realizada']:  # Filtrar por estado
                resultados = resultados.filter(estado=tipo_filtro)
            # Si el tipo_filtro es "Todos" o un valor no reconocido, no aplicamos ningún filtro adicional
        
        # Aplicar filtro por búsqueda en descripción
        if busqueda:
            resultados = resultados.filter(descripcion__icontains=busqueda)
        
        resultados_busqueda = resultados
    
    # Obtener el evento seleccionado si se proporciona un ID
    evento_seleccionado = None
    evento_id = request.GET.get('evento')
    if evento_id:
        try:
            evento_seleccionado = Agenda.objects.get(pk=evento_id, id_adm=usuario_id)
        except Agenda.DoesNotExist:
            pass
    
    # Obtener fecha actual y construir calendario
    fecha_actual = date.today()
    mes_actual = fecha_actual.month
    año_actual = fecha_actual.year
    
    # Permitir navegación entre meses
    mes_param = request.GET.get('month')
    if mes_param:
        try:
            mes, año = map(int, mes_param.split('-'))
            if 1 <= mes <= 12:
                mes_actual = mes
                año_actual = año
        except:
            pass
    
    # Calcular meses anterior y siguiente para navegación
    if mes_actual == 1:
        mes_anterior = f"12-{año_actual-1}"
    else:
        mes_anterior = f"{mes_actual-1}-{año_actual}"
        
    if mes_actual == 12:
        mes_siguiente = f"1-{año_actual+1}"
    else:
        mes_siguiente = f"{mes_actual+1}-{año_actual}"
    
    # Construir calendario
    cal = calendar.monthcalendar(año_actual, mes_actual)
    
    # Mapear eventos a días específicos con su tipo
    eventos_por_dia = {}
    for evento in eventos:
        if evento.fecha.year == año_actual and evento.fecha.month == mes_actual:
            if evento.fecha.day not in eventos_por_dia:
                eventos_por_dia[evento.fecha.day] = {'ids': [], 'tipos': []}
            eventos_por_dia[evento.fecha.day]['ids'].append(evento.cod_age)
            eventos_por_dia[evento.fecha.day]['tipos'].append(evento.tipo)
    
    # Obtener el día seleccionado para mostrar el formulario o eventos
    dia_seleccionado = request.GET.get('dia')
    mes_seleccionado = request.GET.get('mes')
    año_seleccionado = request.GET.get('año')
    
    fecha_seleccionada = None
    mostrar_formulario = False
    if dia_seleccionado and mes_seleccionado and año_seleccionado:
        try:
            fecha_seleccionada = date(int(año_seleccionado), int(mes_seleccionado), int(dia_seleccionado))
            
            # Verificar si ya hay eventos en este día
            eventos_del_dia_count = Agenda.objects.filter(
                id_adm=usuario_id,
                fecha=fecha_seleccionada
            ).count()
            
            # Mostrar formulario solo si no hay eventos en el día seleccionado
            # y no se ha seleccionado un evento específico
            mostrar_formulario = eventos_del_dia_count == 0 and not evento_seleccionado
            
        except ValueError:
            fecha_seleccionada = None
    
    # Construir matriz del calendario con información de eventos
    calendario_mensual = []
    for semana in cal:
        semana_formateada = []
        for dia in semana:
            if dia == 0:
                # Espacio vacío para días fuera del mes
                semana_formateada.append(None)
            else:
                fecha_dia = date(año_actual, mes_actual, dia)
                datos_dia = eventos_por_dia.get(dia, {'ids': [], 'tipos': []})
                tiene_evento = len(datos_dia['ids']) > 0
                
                # Determinar tipo de evento para el indicador visual
                tipo_evento = None
                tiene_evento_completado = False
                if tiene_evento:
                    # Verificar si hay eventos realizados
                    eventos_dia = Agenda.objects.filter(
                        id_adm=usuario_id,
                        fecha=fecha_dia
                    )
                    for ev in eventos_dia:
                        if ev.estado == 'Realizada':
                            tiene_evento_completado = True
                            break
                            
                    # Si hay varios tipos de eventos en el mismo día
                    if 'Evento' in datos_dia['tipos'] and 'Tarea' in datos_dia['tipos']:
                        if tiene_evento_completado:
                            tipo_evento = 'multiple-realizado'
                        else:
                            tipo_evento = 'multiple'
                    elif 'Evento' in datos_dia['tipos']:
                        if tiene_evento_completado:
                            tipo_evento = 'realizado'
                        else:
                            tipo_evento = 'Evento'
                    elif 'Tarea' in datos_dia['tipos']:
                        if tiene_evento_completado:
                            tipo_evento = 'realizado'
                        else:
                            tipo_evento = 'Tarea'
                
                semana_formateada.append({
                    'fecha': fecha_dia,
                    'tiene_evento': tiene_evento,
                    'evento_ids': datos_dia['ids'],
                    'tipo_evento': tipo_evento,
                    'tiene_evento_completado': tiene_evento_completado
                })
        calendario_mensual.append(semana_formateada)
    
    # Obtener eventos del día seleccionado para mostrar en panel lateral
    eventos_del_dia = None
    if fecha_seleccionada and not evento_seleccionado:
        eventos_del_dia = Agenda.objects.filter(
            id_adm=usuario_id,
            fecha=fecha_seleccionada
        )
    
    # Nombres de los meses en español para mostrar en el calendario
    nombres_meses = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }

    return render(request, 'paginas/calendario.html', {
        'current_page_name': 'Calendario',
        'eventos': eventos,
        'evento_seleccionado': evento_seleccionado,
        'eventos_del_dia': eventos_del_dia,
        'fecha_actual': fecha_actual,
        'fecha_seleccionada': fecha_seleccionada,
        'mostrar_formulario': mostrar_formulario,
        'nombre_mes': nombres_meses[mes_actual],
        'año_actual': año_actual,
        'calendario_mensual': calendario_mensual,
        'mes_anterior': mes_anterior,
        'mes_siguiente': mes_siguiente,
        'resultados_busqueda': resultados_busqueda,
        'busqueda': busqueda,
        'tipo_filtro': tipo_filtro,
        'recordatorios': recordatorios,
        'hay_recordatorios': hay_recordatorios,
        'total_recordatorios': total_recordatorios
    })

@login_required
def agregar_evento(request):
    if request.method == 'POST':
        # Obtener el ID del administrador actual
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener la instancia del administrador
            administrador = Administrador.objects.get(pk=usuario_id)
            
            # Procesar los datos del formulario
            fecha = request.POST.get('fecha')
            hora = request.POST.get('hora')
            tipo = request.POST.get('tipo')
            estado = request.POST.get('estado')
            descripcion = request.POST.get('descripcion')
            
            # Crear y guardar el nuevo evento
            nuevo_evento = Agenda(
                fecha=fecha,
                hora=hora,
                tipo=tipo,
                estado=estado,
                descripcion=descripcion,
                id_adm=administrador  # Asignar el administrador al evento
            )
            nuevo_evento.save()
            
            # Obtener los parámetros para redirección
            redirect_dia = request.POST.get('redirect_fecha')
            redirect_mes = request.POST.get('redirect_mes')
            redirect_año = request.POST.get('redirect_año')
            
            # Crear mensaje de éxito
            messages.success(request, f'Se ha agregado un nuevo {tipo.lower()} correctamente.')
            
            # Redireccionar a la página del calendario con el día seleccionado
            return redirect(f'/calendario/?dia={redirect_dia}&mes={redirect_mes}&año={redirect_año}&evento={nuevo_evento.cod_age}')
        
        except Administrador.DoesNotExist:
            messages.error(request, "Error: No se pudo encontrar el administrador.")
        except Exception as e:
            messages.error(request, f"Error al agregar el evento: {str(e)}")
            
    # Si no es POST o hubo un error, redireccionar al calendario
    return redirect('calendario')

@login_required
def editar_evento(request, evento_id):
    evento = get_object_or_404(Agenda, cod_age=evento_id)
    
    if request.method == 'POST':
        # Actualizar los campos del evento
        evento.fecha = request.POST.get('fecha')
        evento.hora = request.POST.get('hora')
        evento.tipo = request.POST.get('tipo')
        evento.estado = request.POST.get('estado')
        evento.descripcion = request.POST.get('descripcion')
        evento.save()
        
        messages.success(request, 'Evento actualizado exitosamente.')
        
        # Redirigir a la fecha correcta en el calendario
        redirect_fecha = request.POST.get('redirect_fecha')
        redirect_mes = request.POST.get('redirect_mes')
        redirect_año = request.POST.get('redirect_año')
        
        if redirect_fecha and redirect_mes and redirect_año:
            return redirect(f'/calendario/?dia={redirect_fecha}&mes={redirect_mes}&año={redirect_año}')
        
        return redirect('calendario')
    
    # Si no es POST, redirigir a la vista del calendario
    return redirect('calendario')

@login_required
def eliminar_evento(request, evento_id):
    if request.method == "POST":
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener el evento/tarea asegurándose que pertenezca al administrador actual
            evento = get_object_or_404(Agenda, cod_age=evento_id, id_adm=usuario_id)
            
            # Guardar el tipo para el mensaje
            tipo = evento.tipo  # Guarda el tipo antes de eliminar
            
            # Eliminar el evento
            evento.delete()
            
            messages.success(request, f"{tipo} eliminado con éxito!")
            
        except Agenda.DoesNotExist:
            messages.error(request, "Error: No se encontró el evento o tarea.")
        except Exception as e:
            messages.error(request, f"Error al eliminar: {str(e)}")
        
        return redirect('calendario')
    
    # Si no es un POST, redirigir al calendario
    return redirect('calendario')

def obtener_recordatorios(usuario_id):
    """
    Obtiene todos los recordatorios incluyendo los de vacunación
    """
    if usuario_id is None:
        return {
            'siete_dias': [],
            'cuatro_dias': [],
            'dos_dias': [],
            'un_dia': [],
            'hoy': [],
            'vacunacion': []
        }
    
    hoy = date.today()
    
    # Fechas para recordatorios normales (agenda)
    fechas_recordatorio = {
        'siete_dias': hoy + timedelta(days=7),
        'cuatro_dias': hoy + timedelta(days=4),
        'dos_dias': hoy + timedelta(days=2),
        'un_dia': hoy + timedelta(days=1),
        'hoy': hoy
    }
    
    # Inicializar recordatorios
    recordatorios = {
        'siete_dias': [],
        'cuatro_dias': [],
        'dos_dias': [],
        'un_dia': [],
        'hoy': [],
        'vacunacion': []
    }
    
    try:
        # Obtener recordatorios normales de la agenda
        for periodo, fecha in fechas_recordatorio.items():
            eventos = Agenda.objects.filter(
                id_adm=usuario_id,
                fecha=fecha,
                estado='Pendiente'
            )
            
            eventos_formateados = []
            for evento in eventos:
                eventos_formateados.append({
                    'cod_age': evento.cod_age,
                    'descripcion': evento.descripcion,
                    'hora': evento.hora,
                    'tipo': evento.tipo,
                    'fecha': evento.fecha
                })
            
            recordatorios[periodo] = eventos_formateados
        
        # ========== LÓGICA DE VACUNACIÓN ==========
        recordatorios['vacunacion'] = obtener_recordatorios_vacunacion(hoy, usuario_id)
        
    except Exception as e:
        print(f"Error al obtener recordatorios: {e}")
    
    return recordatorios

def obtener_recordatorios_vacunacion(hoy, usuario_id):
    """
    Lógica específica para recordatorios de vacunación
    Ciclos: 15 Mayo - 15 Junio y 15 Noviembre - 15 Diciembre
    """
    recordatorios_vacunacion = []
    
    año_actual = hoy.year
    
    # Definir los dos ciclos anuales
    ciclos = [
        {
            'inicio': date(año_actual, 5, 15),  # 15 de mayo
            'fin': date(año_actual, 6, 15),     # 15 de junio
            'nombre': 'Mayo-Junio'
        },
        {
            'inicio': date(año_actual, 11, 15), # 15 de noviembre
            'fin': date(año_actual, 12, 15),    # 15 de diciembre
            'nombre': 'Noviembre-Diciembre'
        }
    ]
    
    # Encontrar el estado actual respecto a los ciclos
    proximo_ciclo = None
    ciclo_actual = None
    
    for ciclo in ciclos:
        # Si estamos dentro del ciclo
        if ciclo['inicio'] <= hoy <= ciclo['fin']:
            ciclo_actual = ciclo
            break
        # Si estamos antes del ciclo
        elif hoy < ciclo['inicio']:
            if proximo_ciclo is None:
                proximo_ciclo = ciclo
    
    # Si no encontramos próximo ciclo este año, el próximo será en mayo del año siguiente
    if proximo_ciclo is None and ciclo_actual is None:
        proximo_ciclo = {
            'inicio': date(año_actual + 1, 5, 15),
            'fin': date(año_actual + 1, 6, 15),
            'nombre': 'Mayo-Junio'
        }
    
    # ===== TIPO 1: Recordatorio antes del ciclo (3 días antes) =====
    if proximo_ciclo:
        dias_hasta_ciclo = (proximo_ciclo['inicio'] - hoy).days
        
        if 1 <= dias_hasta_ciclo <= 3:
            recordatorios_vacunacion.append({
                'id': f'pre_vacunacion_{proximo_ciclo["inicio"].strftime("%Y%m%d")}',
                'tipo': 'recordatorio_pre_vacunacion',
                'descripcion': f'🚨 <strong>Ciclo de Vacunación {proximo_ciclo["nombre"]} Próximo</strong><br>'
                              f'📅 Inicia el {proximo_ciclo["inicio"].strftime("%d/%m/%Y")}<br>'
                              f'📅 Termina el {proximo_ciclo["fin"].strftime("%d/%m/%Y")}<br>'
                              f'💉 Prepara todo lo necesario para la vacunación de tu ganado<br>'
                              f'⏰ <em>Faltan {dias_hasta_ciclo} día(s)</em>',
                'fecha_inicio': proximo_ciclo['inicio'],
                'fecha_fin': proximo_ciclo['fin'],
                'requiere_respuesta': False,
                'eliminable': False
            })
    
    # ===== TIPO 2: Recordatorios durante el ciclo (cada lunes) =====
    if ciclo_actual:
        es_lunes = hoy.weekday() == 0  # 0 = lunes
        
        if es_lunes:
            dias_restantes = (ciclo_actual['fin'] - hoy).days
            dias_transcurridos = (hoy - ciclo_actual['inicio']).days + 1
            
            recordatorios_vacunacion.append({
                'id': f'ciclo_vacunacion_{hoy.strftime("%Y%m%d")}',
                'tipo': 'recordatorio_ciclo_vacunacion',
                'descripcion': f'💉 <strong>Recordatorio Semanal - Ciclo {ciclo_actual["nombre"]}</strong><br>'
                              f'🐄 ¿Ya vacunaste a todos tus animales esta semana?<br>'
                              f'📊 Día {dias_transcurridos} del ciclo de vacunación<br>'
                              f'📅 Ciclo termina el {ciclo_actual["fin"].strftime("%d/%m/%Y")}<br>'
                              f'⏳ <em>Quedan {dias_restantes} días del ciclo</em>',
                'fecha_inicio': ciclo_actual['inicio'],
                'fecha_fin': ciclo_actual['fin'],
                'requiere_respuesta': False,
                'eliminable': False
            })
    
    # ===== TIPO 3: Recordatorio al finalizar el ciclo =====
    # Verificar si ayer terminó un ciclo
    ayer = hoy - timedelta(days=1)
    
    for ciclo in ciclos:
        if ayer == ciclo['fin']:
            recordatorios_vacunacion.append({
                'id': f'post_vacunacion_{ciclo["fin"].strftime("%Y%m%d")}',
                'tipo': 'recordatorio_post_vacunacion',
                'descripcion': f'✅ <strong>Ciclo {ciclo["nombre"]} Finalizado</strong><br>'
                              f'🎉 El ciclo terminó el {ciclo["fin"].strftime("%d/%m/%Y")}<br>'
                              f'📋 Revisa que todos los animales estén vacunados<br>'
                              f'📝 Actualiza tus registros sanitarios<br>'
                              f'📅 <em>Próximo ciclo: {"Noviembre-Diciembre" if ciclo["nombre"] == "Mayo-Junio" else "Mayo-Junio del próximo año"}</em>',
                'fecha_inicio': ciclo['inicio'],
                'fecha_fin': ciclo['fin'],
                'requiere_respuesta': False,
                'eliminable': True  # Este se puede eliminar después de verlo
            })
            break
    
    return recordatorios_vacunacion

@login_required
def confirmar_vacunacion(request):
    """
    Vista para manejar las confirmaciones de vacunación (ya no se usa con botones)
    Se mantiene por compatibilidad pero puede eliminarse si no se necesita
    """
    # Redirigir de vuelta a la página anterior
    return redirect(request.META.get('HTTP_REFERER', 'home'))

# ===== FUNCIÓN AUXILIAR PARA CONTAR RECORDATORIOS =====
def contar_total_recordatorios(recordatorios):
    """
    Cuenta el total de recordatorios para mostrar en el badge
    """
    total = 0
    
    # Contar recordatorios normales
    for periodo in ['hoy', 'un_dia', 'dos_dias', 'cuatro_dias', 'siete_dias']:
        total += len(recordatorios.get(periodo, []))
    
    # Contar recordatorios de vacunación
    total += len(recordatorios.get('vacunacion', []))
    
    return total

# ===== PARA USO EN EL CONTEXT PROCESSOR O VISTA =====
def agregar_recordatorios_al_contexto(request):
    """
    Función para agregar recordatorios al contexto de todas las páginas
    """
    usuario_id = request.session.get('usuario_id')
    recordatorios = obtener_recordatorios(usuario_id)
    total_recordatorios = contar_total_recordatorios(recordatorios)
    
    # Verificar si hay recordatorios (excluyendo vacunación para el mensaje "No hay recordatorios")
    hay_recordatorios = any(
        len(recordatorios[periodo]) > 0 
        for periodo in ['hoy', 'un_dia', 'dos_dias', 'cuatro_dias', 'siete_dias']
    )
    
    return {
        'recordatorios': recordatorios,
        'total_recordatorios': total_recordatorios,
        'hay_recordatorios': hay_recordatorios
    }

"Vistas para crud de compras"
@login_required
def compras(request):
    """Vista principal para mostrar todas las ventas del administrador actual."""
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Obtener todas las ventas del administrador actual
        compras = Compra.objects.filter(id_adm=usuario_id).order_by('-fecha')
        
        # Obtener parámetros de búsqueda y filtrado
        busqueda = request.GET.get('busqueda', '')
        tipo_filtro = request.GET.get('tipo_filtro', '')
        valor_filtro = request.GET.get('valor', '')
        fecha_inicio = request.GET.get('fecha_inicio', '')
        fecha_fin = request.GET.get('fecha_fin', '')
        
        # Aplicar filtros según los parámetros recibidos
        if busqueda:
            # Buscar por cliente
            compras = compras.filter(nom_prov__icontains=busqueda)
        
        # Filtrar por rango de fechas si se proporcionan
        if fecha_inicio and fecha_fin:
            compras = compras.filter(fecha__gte=fecha_inicio, fecha__lte=fecha_fin)
        
        # Obtener detalles para cada venta
        for compra in compras:
            compra.detalles = DetCom.objects.filter(cod_com=compra.cod_com)
            
            # FORMATEAR EL PESO DE CADA DETALLE DE COMPRA
            for detalle in compra.detalles:
                if detalle.peso_aniCom:
                    # Formato con 2 decimales: 000,00
                    detalle.peso_formateado = f"{detalle.peso_aniCom:.2f}".replace('.', ',')
                else:
                    detalle.peso_formateado = "0,00"
        
        context = {
            'compras': compras,
            'proximo_codigo': 1,  # Valor por defecto, ajusta según tu lógica
            'busqueda': busqueda,
            'tipo_filtro': tipo_filtro,
            'valor_filtro': valor_filtro,
            'fecha_inicio': fecha_inicio,
            'fecha_fin': fecha_fin,
            'current_page_name': 'Registro de Compras',
        }
        
        return render(request, 'paginas/compras.html', context)
    
    except Exception as e:
        messages.error(request, f"Error al cargar las compras: {str(e)}")
        return redirect('home')
    
@login_required
@transaction.atomic
def crear_compra(request):
    """Vista para crear una nueva compra con sus detalles."""
    if request.method == 'POST':
        try:
            # Obtener el ID del administrador actual desde la sesión
            usuario_id = request.session.get('usuario_id')
            
            # Obtener datos del formulario
            fecha = request.POST.get('fecha')
            nom_prov = request.POST.get('nom_prov')
            cantidad = int(request.POST.get('cantidad'))

            # Formatear correctamente el precio total
            precio_total_str = request.POST.get('precio_total', '0')
            # Primero eliminamos todos los puntos (separadores de miles)
            precio_total_str = precio_total_str.replace('.', '')
            # Luego reemplazamos la coma decimal por punto (si existe)
            precio_total_str = precio_total_str.replace(',', '.')
            # Convertimos a float
            precio_total = float(precio_total_str)
            
            # Determinar el siguiente id_com global
            siguiente_id_com = 1
            ultima_compra_global = Compra.objects.order_by('-id_com').first()
            if ultima_compra_global:
                siguiente_id_com = ultima_compra_global.id_com + 1
            
            # Determinar el siguiente código de compra para este administrador
            # Usar select_for_update para evitar condiciones de carrera
            siguiente_cod_com = 1
            ultima_compra = Compra.objects.filter(
                id_adm=usuario_id
            ).select_for_update().order_by('-cod_com').first()
            
            if ultima_compra:
                siguiente_cod_com = ultima_compra.cod_com + 1
            
            # Crear la compra con validación adicional
            try:
                compra = Compra.objects.create(
                    id_com=siguiente_id_com,  # ID global único
                    cod_com=siguiente_cod_com,  # Código por administrador
                    id_adm_id=usuario_id,
                    fecha=fecha,
                    nom_prov=nom_prov,
                    cantidad=cantidad,
                    precio_total=precio_total
                )
            except Exception as create_error:
                # Si hay error en la creación, manejar específicamente el error de clave duplicada
                if "Duplicate entry" in str(create_error):
                    # Intentar con el siguiente número disponible
                    max_cod_com = Compra.objects.filter(
                        id_adm=usuario_id
                    ).aggregate(max_cod=models.Max('cod_com'))['max_cod'] or 0
                    
                    siguiente_cod_com = max_cod_com + 1
                    
                    compra = Compra.objects.create(
                        cod_com=siguiente_cod_com,
                        id_adm_id=usuario_id,
                        fecha=fecha,
                        nom_prov=nom_prov,
                        cantidad=cantidad,
                        precio_total=precio_total
                    )
                else:
                    raise create_error
            
            # Procesar detalles de animales
            detalles_creados = 0
            for i in range(1, cantidad + 1):
                # Obtener valores con validación
                cod_ani = request.POST.get(f'cod_ani_{i}', '').strip()
                edad_aniCom = request.POST.get(f'edad_aniCom_{i}', '').strip()
                
                # Validar edad_aniCom como texto (puede ser "1-2", "adulto", etc.)
                if not edad_aniCom:
                    edad_aniCom = "No especificada"
                
                # FORMA CORRECTA de manejar Decimal con soporte para formato con coma
                peso_str = request.POST.get(f'peso_aniCom_{i}', '0,00')
                peso_aniCom = None
                if peso_str and peso_str.strip():  # Verificar que no esté vacío
                    try:
                        # Permitir entrada con coma como separador decimal
                        peso_normalizado = peso_str.replace(',', '.')
                        peso_aniCom = Decimal(peso_normalizado)
                        
                        # Validar que el peso sea positivo
                        if peso_aniCom <= 0:
                            messages.warning(request, f"Advertencia: El peso del animal {i} debe ser mayor que cero. Se usará 0 como valor por defecto.")
                            peso_aniCom = Decimal('0')
                            
                    except (ValueError, InvalidOperation):
                        messages.warning(request, f"Advertencia: El peso del animal {i} no es válido. Se usará 0 como valor por defecto.")
                        peso_aniCom = Decimal('0')
                
                # Asegurar que los campos no sean None o cadenas vacías
                if not cod_ani:
                    messages.warning(request, f"Advertencia: Código de animal faltante para el animal {i}. Se omite este detalle.")
                    continue
                
                # Formatear correctamente el precio unitario
                precio_uni_str = request.POST.get(f'precio_uni_{i}', '0')
                precio_uni_str = precio_uni_str.replace('.', '')  # Eliminar puntos de miles
                precio_uni_str = precio_uni_str.replace(',', '.')  # Reemplazar coma decimal por punto
                
                try:
                    precio_uni = float(precio_uni_str)
                except ValueError:
                    messages.warning(request, f"Advertencia: Precio unitario inválido para el animal {i}. Se usará 0.")
                    precio_uni = 0.0
                
                # Crear el detalle de compra con valores por defecto si están vacíos
                try:
                    DetCom.objects.create(
                        cod_com=compra,
                        cod_ani=cod_ani,
                        edad_aniCom=edad_aniCom,  # Ya es string
                        peso_aniCom=peso_aniCom or Decimal('0'),
                        precio_uni=precio_uni,
                    )
                    detalles_creados += 1
                except Exception as detalle_error:
                    messages.warning(request, f"Error al crear detalle para animal {i}: {str(detalle_error)}")
                    continue
            
            # Mensaje de éxito con información adicional
            if detalles_creados > 0:
                messages.success(request, f"Compra #{siguiente_cod_com} registrada exitosamente con {detalles_creados} detalles de animales.")
            else:
                messages.warning(request, f"Compra #{siguiente_cod_com} registrada, pero no se pudieron crear los detalles de animales.")
            
            return redirect('compras')
            
        except Exception as e:
            messages.error(request, f"Error al registrar la compra: {str(e)}")
            return redirect('compras')
    else:
        return redirect('compras')
           
@login_required
def editar_compra(request, cod_com):
    """
    Vista para editar una compra existente
    """
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Obtener la compra que pertenece al administrador actual
        compra = Compra.objects.get(cod_com=cod_com, id_adm=usuario_id)
    except Compra.DoesNotExist:
        messages.error(request, "La compra no existe o no tiene permisos para editarla.")
        return redirect('compras')
    
    if request.method == 'POST':
        try:
            with transaction.atomic():
                # Obtener datos del formulario
                fecha = request.POST.get('fecha')
                nom_prov = request.POST.get('nom_prov')
                
                # Validar campos obligatorios
                if not fecha or not nom_prov:
                    messages.error(request, "La fecha y el nombre del proveedor son obligatorios.")
                    return redirect('compras')
                
                try:
                    cantidad = int(request.POST.get('cantidad', 0))
                    if cantidad <= 0:
                        messages.error(request, "La cantidad debe ser mayor a 0.")
                        return redirect('compras')
                except (ValueError, TypeError):
                    messages.error(request, "La cantidad debe ser un número válido.")
                    return redirect('compras')
                
                # Formatear correctamente el precio total
                try:
                    precio_total_str = request.POST.get('precio_total', '0')
                    precio_total_str = precio_total_str.replace('.', '')
                    precio_total_str = precio_total_str.replace(',', '.')
                    precio_total = float(precio_total_str)
                    
                    if precio_total < 0:
                        messages.error(request, "El precio total no puede ser negativo.")
                        return redirect('compras')
                        
                except (ValueError, TypeError):
                    messages.error(request, "El precio total debe ser un número válido.")
                    return redirect('compras')
                
                # Actualizar la compra
                compra.fecha = fecha
                compra.nom_prov = nom_prov
                compra.cantidad = cantidad
                compra.precio_total = precio_total
                compra.save()
                
                # Eliminar detalles existentes
                DetCom.objects.filter(cod_com=compra).delete()
                
                # Crear nuevos detalles
                detalles_creados = 0
                errores_detalles = []
                
                for i in range(1, cantidad + 1):
                    cod_ani = request.POST.get(f'cod_ani_{i}')
                    edad_anicom = request.POST.get(f'edad_aniCom_{i}')
                    peso_ani = request.POST.get(f'peso_ani_{i}')
                    precio_uni_str = request.POST.get(f'precio_uni_{i}', '0')
                    
                    if not cod_ani:
                        errores_detalles.append(f"Animal {i}: Código requerido.")
                        continue
                    
                    try:
                        animal = Animal.objects.get(cod_ani=cod_ani, id_adm=usuario_id)
                    except Animal.DoesNotExist:
                        errores_detalles.append(f"Animal {i}: Código {cod_ani} no válido.")
                        continue
                    
                    try:
                        precio_uni_str = precio_uni_str.replace('.', '')
                        precio_uni_str = precio_uni_str.replace(',', '.')
                        precio_uni = float(precio_uni_str)
                        if precio_uni < 0:
                            errores_detalles.append(f"Animal {i}: Precio no puede ser negativo.")
                            continue
                    except (ValueError, TypeError):
                        errores_detalles.append(f"Animal {i}: Precio inválido.")
                        continue
                    
                    try:
                        edad_anicom = int(edad_anicom) if edad_anicom else 0
                        if edad_anicom < 0:
                            edad_anicom = 0
                    except (ValueError, TypeError):
                        edad_anicom = 0
                    
                    try:
                        peso_ani = float(peso_ani.replace(',', '.')) if peso_ani else 0
                        if peso_ani < 0:
                            peso_ani = 0
                    except (ValueError, TypeError):
                        peso_ani = 0
                    
                    try:
                        DetCom.objects.create(
                            cod_com=compra,
                            cod_ani=cod_ani,
                            edad_anicom=edad_anicom,
                            peso_anicom=peso_ani,
                            precio_uni=precio_uni
                        )
                        detalles_creados += 1
                    except Exception as e:
                        errores_detalles.append(f"Animal {i}: Error al actualizar.")
                
                # Mostrar mensaje según el resultado
                if detalles_creados == 0:
                    messages.error(request, "No se pudo actualizar ningún detalle válido.")
                elif errores_detalles:
                    warning_msg = f"Compra actualizada. Se procesaron {detalles_creados} de {cantidad} animales."
                    if len(errores_detalles) <= 2:
                        warning_msg += " Errores: " + "; ".join(errores_detalles)
                    messages.warning(request, warning_msg)
                else:
                    messages.success(request, "Compra actualizada exitosamente.")
                
                return redirect('compras')
                
        except Exception as e:
            messages.error(request, f"Error al actualizar la compra: {str(e)}")
            return redirect('compras')
    
    else:
        return redirect('compras')
       
@login_required
def eliminar_compra(request, compra_id):
    """Vista para eliminar una compra y sus detalles"""
    # Obtener el ID del administrador actual desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    try:
        with transaction.atomic():
            # Buscar la compra asegurándose que pertenezca al administrador actual
            compra = Compra.objects.select_for_update().get(cod_com=compra_id, id_adm=usuario_id)
            
            # Primero, eliminar todos los detalles de compra asociados
            detalles_eliminados = DetCom.objects.filter(cod_com=compra).delete()[0]
            
            # Luego, eliminar la compra principal
            compra.delete()
            
            messages.success(request, f"Compra eliminada exitosamente.")
    
    except Compra.DoesNotExist:
        messages.error(request, "Error: La compra no existe o no tienes permiso para eliminarla.")
    except Exception as e:
        messages.error(request, f"Error al eliminar la compra: {str(e)}")
    
    return redirect('compras')

@login_required
def compra_pdf(request, compra_id):
    """Vista para generar PDF de una compra específica"""
    try:
        # Obtener la compra desde la base de datos
        compra = get_object_or_404(Compra, cod_com=compra_id)
        
        # Obtener los detalles de la compra
        detalles = DetCom.objects.filter(cod_com=compra)
        
        # Definir el HTML directamente en el código - solución más sencilla y directa
        html = f"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <title>Informe de Compra #{compra.cod_com}</title>
            <style>
                @page {{
                    size: letter portrait;
                    margin: 1cm 1.5cm; /* Margen reducido */
                }}

                .footer {{
                    position: fixed;
                    bottom: 0.8cm;
                    width: 100%;
                    text-align: right;
                    font-size: 8pt;
                    color: #666666;
                }}

                body {{
                    font-family: Helvetica, Arial, sans-serif;
                    font-size: 10pt; /* Tamaño de fuente reducido */
                    color: #000000;
                    margin: 0;
                    padding: 0;
                }}

                .header {{
                    width: 100%;
                    margin-bottom: 8pt; /* Reducido */
                    padding-top: 0;
                }}

                .timestamp {{
                    font-size: 8pt;
                    color: #666666;
                    text-align: right;
                }}

                .title {{
                    font-size: 16pt; /* Reducido */
                    font-weight: bold;
                    text-align: center;
                    margin-top: 0;
                    margin-bottom: 5pt;
                }}

                hr {{
                    border: none;
                    border-top: 1px solid #333333;
                    margin: 3pt 0; /* Reducido */
                }}

                h2 {{
                    font-size: 12pt; /* Reducido */
                    font-weight: bold;
                    margin-top: 12pt; /* Reducido */
                    margin-bottom: 6pt; /* Reducido */
                    color: #333333;
                }}

                .info-table {{
                    width: 98%; /* Ligeramente reducido */
                    margin-bottom: 10pt; /* Reducido */
                    border-spacing: 0;
                    font-size: 9pt; /* Reducido */
                }}

                .info-table .label {{
                    font-weight: bold;
                    width: 30%; /* Reducido */
                    padding: 3pt 6pt 3pt 0; /* Reducido */
                    vertical-align: top;
                }}

                .data-table {{
                    width: 98%; /* Ligeramente reducido */
                    border-collapse: collapse;
                    margin-top: 8pt; /* Reducido */
                    font-size: 9pt; /* Reducido */
                }}

                .data-table th {{
                    background-color: #f2f2f2;
                    font-weight: bold;
                    text-align: left;
                    padding: 2pt 4pt; /* Reducido */
                    border-bottom: 1pt solid #dddddd;
                }}
                
                .data-table td {{
                    padding: 2pt 4pt; /* Reducido */
                    border-bottom: 1pt solid #dddddd;
                }}

                .footer {{
                    text-align: center;
                    font-size: 8pt; /* Reducido */
                    color: #666666;
                    margin-top: 8pt; /* Reducido */
                }}

                .page-number:before {{
                    content: counter(page);
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="title">Informe de Compra #{compra.cod_com}</h1>
                <hr>
            </div>

            <div class="section">
                <h2>Información General</h2>
                
                <table class="info-table">
                    <tr>
                        <td class="label">Código de Compra:</td>
                        <td>{compra.cod_com}</td>
                    </tr>
                    <tr>
                        <td class="label">Fecha:</td>
                        <td>{compra.fecha.strftime('%d/%m/%Y')}</td>
                    </tr>
                    <tr>
                        <td class="label">Proveedor:</td>
                        <td>{compra.nom_prov}</td>
                    </tr>
                    <tr>
                        <td class="label">Cantidad de Animales:</td>
                        <td>{compra.cantidad}</td>
                    </tr>
                    <tr>
                        <td class="label">Precio Total:</td>
                        <td>${compra.precio_total:,.0f}</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <h2>Detalles de Animales</h2>
                
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Código Animal</th>
                            <th>Edad </th>
                            <th>Peso </th>
                            <th>Precio Unitario</th>
                        </tr>
                    </thead>
                    <tbody>
        """
        
        # Añadir filas para cada animal
        if detalles.exists():
            for detalle in detalles:
                html += f"""
                    <tr>
                        <td>{detalle.cod_ani}</td>
                        <td>{detalle.edad_aniCom} años</td>
                        <td>{detalle.peso_aniCom:.1f} kg</td>
                        <td>${detalle.precio_uni:,.0f}</td>
                    </tr>
                """
        else:
            html += """
                    <tr>
                        <td colspan="4" style="text-align: center; font-style: italic;">
                            No hay animales registrados en esta compra.
                        </td>
                    </tr>
            """
        
        # Cerrar el HTML
        html += f"""
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <p>Generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M:%S')}</p>
                Página <pdf:pagenumber> de <pdf:pagecount>
            </div>
        </body>
        </html>
        """
        
        # Configurar la respuesta HTTP para el PDF
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="compra_{compra_id}.pdf"'
        
        # Crear el PDF
        pisa_status = pisa.CreatePDF(
            html,
            dest=response
        )
        
        # Manejar errores
        if pisa_status.err:
            messages.error(request, "Error al generar el PDF.")
            return redirect('compras')
            
        return response
        
    except Exception as e:
        messages.error(request, f"Error al generar el PDF: {str(e)}")
        return redirect('compras')
    
@login_required
def cancelar_compra(request):
    """
    Vista para manejar la cancelación del formulario de compra
    """
    if request.method == 'POST':
        # No necesitamos hacer nada con los datos del formulario
        # Simplemente redirigimos a la página de compras
        # Django no conservará los datos del formulario en este caso
        messages.info(request, "Registro de compra cancelado")
        return redirect('compras')
    else:
        # Si no es un POST request, redirigir a la página de compras
        return redirect('compras')

"Vistas para crud de ventas"
@login_required
def ventas(request):
    """Vista principal para mostrar todas las ventas del administrador actual."""
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Obtener todas las ventas del administrador actual
        ventas = Venta.objects.filter(id_adm=usuario_id).order_by('-fecha')
        
        # Obtener parámetros de búsqueda y filtrado
        busqueda = request.GET.get('busqueda', '')
        tipo_filtro = request.GET.get('tipo_filtro', '')
        valor_filtro = request.GET.get('valor', '')
        fecha_inicio = request.GET.get('fecha_inicio', '')
        fecha_fin = request.GET.get('fecha_fin', '')
        
        # Aplicar filtros según los parámetros recibidos
        if busqueda:
            # Buscar por cliente
            ventas = ventas.filter(nom_cli__icontains=busqueda)
        
        # Filtrar por rango de fechas si se proporcionan
        if fecha_inicio and fecha_fin:
            ventas = ventas.filter(fecha__gte=fecha_inicio, fecha__lte=fecha_fin)
        
        # Obtener detalles para cada venta
        for venta in ventas:
            venta.detalles = DetVen.objects.filter(cod_ven=venta.cod_ven)
        
             # FORMATEAR EL PESO DE CADA DETALLE DE COMPRA
            for detalle in venta.detalles:
                if detalle.peso_aniven:
                    # Formato con 2 decimales: 000,00
                    detalle.peso_formateado = f"{detalle.peso_aniven:.2f}".replace('.', ',')
                else:
                    detalle.peso_formateado = "0,00"

        context = {
            'ventas': ventas,
            'proximo_codigo': 1,  # Valor por defecto, ajusta según tu lógica
            'busqueda': busqueda,
            'tipo_filtro': tipo_filtro,
            'valor_filtro': valor_filtro,
            'fecha_inicio': fecha_inicio,
            'fecha_fin': fecha_fin,
            'current_page_name': 'Registro de Ventas',
        }
        
        return render(request, 'paginas/ventas.html', context)
    
    except Exception as e:
        messages.error(request, f"Error al cargar las ventas: {str(e)}")
        return redirect('home')

@login_required
def crear_venta(request):
    """Vista para crear una nueva venta con sus detalles."""
    if request.method == 'POST':
        try:
            # Obtener el ID del administrador actual desde la sesión
            usuario_id = request.session.get('usuario_id')
            
            # Obtener datos del formulario
            fecha = request.POST.get('fecha')
            nom_cli = request.POST.get('nom_cli')
            cantidad = int(request.POST.get('cantidad'))

            # Formatear correctamente el precio total
            precio_total_str = request.POST.get('precio_total', '0')
            precio_total_str = precio_total_str.replace('.', '')
            precio_total_str = precio_total_str.replace(',', '.')
            precio_total = float(precio_total_str)
            
            # Determinar el siguiente código de venta para este administrador
            siguiente_cod_ven = 1
            ultima_venta = Venta.objects.filter(id_adm=usuario_id).order_by('-cod_ven').first()
            if ultima_venta:
                siguiente_cod_ven = ultima_venta.cod_ven + 1
            
            # Validar que todos los animales seleccionados estén disponibles
            codigos_animales_usados = []
            for i in range(1, cantidad + 1):
                cod_ani = request.POST.get(f'cod_ani_{i}', '')
                
                if not cod_ani:
                    messages.error(request, f"Debe seleccionar un animal para la posición {i}")
                    return redirect('ventas')
                
                # Verificar que el animal existe y está disponible (saludable)
                try:
                    animal = Animal.objects.get(
                        cod_ani=cod_ani, 
                        id_adm=usuario_id,
                        estado='saludable'  # Ajusta según tu campo de estado
                    )
                except Animal.DoesNotExist:
                    messages.error(request, f"El animal con código {cod_ani} no está disponible o no existe")
                    return redirect('ventas')
                
                # Verificar que no se repita el mismo animal
                if cod_ani in codigos_animales_usados:
                    messages.error(request, f"El animal con código {cod_ani} ya fue seleccionado")
                    return redirect('ventas')
                
                codigos_animales_usados.append(cod_ani)
            
            # Crear la venta
            venta = Venta.objects.create(
                cod_ven=siguiente_cod_ven,
                id_adm_id=usuario_id,
                fecha=fecha,
                nom_cli=nom_cli,
                cantidad=cantidad,
                precio_total=precio_total
            )
            
            # Procesar detalles de animales
            for i in range(1, cantidad + 1):
                cod_ani = request.POST.get(f'cod_ani_{i}', '')
                edad_aniven = request.POST.get(f'edad_aniven_{i}', '0')
                
                # Manejar peso con soporte para formato con coma
                peso_str = request.POST.get(f'peso_aniven_{i}', '0,00')
                peso_aniven = None
                if peso_str and peso_str.strip():
                    try:
                        peso_normalizado = peso_str.replace(',', '.')
                        peso_aniven = Decimal(peso_normalizado)
                        
                        if peso_aniven <= 0:
                            messages.error(request, f"Error: El peso del animal {i} debe ser mayor que cero.")
                            continue
                            
                    except (ValueError, InvalidOperation):
                        messages.error(request, f"Error: El peso del animal {i} debe ser un número válido (ej: 15,05 o 15.05).")
                        continue

                # Formatear precio unitario
                precio_uni_str = request.POST.get(f'precio_uni_{i}', '0')
                precio_uni_str = precio_uni_str.replace('.', '')
                precio_uni_str = precio_uni_str.replace(',', '.')
                precio_uni = float(precio_uni_str)
                
                # Crear el detalle de venta
                DetVen.objects.create(
                    cod_ven=venta,
                    cod_ani=cod_ani,
                    edad_aniven=edad_aniven or 0,
                    peso_aniven=peso_aniven or 0,
                    precio_uni=precio_uni,
                )
                
                # Opcional: Cambiar el estado del animal a 'vendido'
                try:
                    animal = Animal.objects.get(cod_ani=cod_ani, id_adm=usuario_id)
                    animal.estado = 'vendido'  # Ajusta según tu modelo
                    animal.save()
                except Animal.DoesNotExist:
                    pass  # El animal ya fue validado anteriormente
            
            messages.success(request, "Venta registrada exitosamente")
            return redirect('ventas')
            
        except Exception as e:
            messages.error(request, f"Error al registrar la venta: {str(e)}")
            return redirect('ventas')
    else:
        return redirect('ventas')

@login_required
def api_animales_disponibles(request):
    """
    API para obtener los códigos de animales disponibles con estado saludable
    para el administrador actual.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    
    try:
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        if not usuario_id:
            return JsonResponse({'error': 'Usuario no autenticado'}, status=401)
        
        # Obtener animales disponibles (estado saludable) del administrador actual
        # Ajusta el nombre del modelo y campos según tu estructura
        animales_disponibles = Animal.objects.filter(
            id_adm=usuario_id,
            estado='saludable'  # Ajusta el campo y valor según tu modelo
        ).values('cod_ani', 'raza', 'peso', 'edad').order_by('cod_ani')
        
        # Convertir QuerySet a lista
        animales_list = list(animales_disponibles)
        
        return JsonResponse({
            'success': True,
            'animales': animales_list,
            'total': len(animales_list)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Error al obtener animales disponibles: {str(e)}'
        }, status=500)
     
@login_required
@transaction.atomic
def editar_venta(request, cod_ven):
    """
    Vista para editar una compra existente y sus detalles asociados.
    """
    venta = get_object_or_404(Venta, cod_ven=cod_ven)
    
    if request.method == 'POST':
        try:
            # Actualizar datos de la compra
            venta.fecha = request.POST.get('fecha')
            venta.nom_cli = request.POST.get('nom_cli')
            
            # El precio total se calcula a partir de los detalles
            nuevo_precio_total = 0
            
            # Número de detalles en el formulario
            num_detalles = int(request.POST.get('num_detalles', 0))
            
            # Actualizar cada detalle de compra
            for i in range(num_detalles):
                # Usar cod_detcom en lugar de id para identificar el detalle
                detalle_id = request.POST.get(f'detalle_id_{i}')
                
                # Buscar el detalle por cod_detcom en lugar de id
                detalle = get_object_or_404(DetVen, cod_detven=detalle_id, cod_ven=venta)
                
                # Actualizar datos del detalle
                detalle.edad_aniven = request.POST.get(f'edad_aniven_{i}')
                detalle.peso_aniven = request.POST.get(f'peso_aniven_{i}')
                detalle.precio_uni = request.POST.get(f'precio_uni_{i}')
                
                # Acumular para el precio total
                nuevo_precio_total += float(detalle.precio_uni)
                
                # Guardar el detalle actualizado
                detalle.save()
            
            # Actualizar el precio total de la compra
            venta.precio_total = nuevo_precio_total
            venta.save()
            
            messages.success(request, f'Venta actualizada exitosamente.')
            return redirect('ventas')
            
        except Exception as e:
            messages.error(request, f'Error al actualizar la venta: {str(e)}')
            return redirect('ventas')
    
    # Si la solicitud no es POST, redirigir a la lista de compras
    return redirect('ventas')

@login_required
def eliminar_venta(request, venta_id):
    """Vista para eliminar una venta y sus detalles asociados."""
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Buscar la venta asegurándose que pertenezca al administrador actual
        venta = Venta.objects.get(cod_ven=venta_id, id_adm=usuario_id)
        
        # Primero, eliminar todos los detalles de venta asociados
        DetVen.objects.filter(cod_ven=venta).delete()
        
        # Luego, eliminar la venta principal
        venta.delete()
        
        messages.success(request, f"¡Venta eliminada con éxito!")
    
    except Venta.DoesNotExist:  # Corregido de Compra.DoesNotExist
        messages.error(request, "Error: La venta no existe o no tienes permiso para eliminarla.")
    except Exception as e:
        messages.error(request, f"Error al eliminar la venta: {str(e)}")
    
    return redirect('ventas')

@login_required
def venta_pdf(request, venta_id):
    # Obtener la venta desde la base de datos
    venta = get_object_or_404(Venta, cod_ven=venta_id)
    
    # Definir el HTML directamente en el código - solución más sencilla y directa
    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>Informe de Venta #{venta.cod_ven}</title>
        <style>
            @page {{
                size: letter portrait;
                margin: 1cm 1.5cm; /* Margen reducido */
            }}

            .footer {{
                position: fixed;
                bottom: 0.8cm;
                width: 100%;
                text-align: right;
                font-size: 8pt;
                color: #666666;
            }}

            body {{
                font-family: Helvetica, Arial, sans-serif;
                font-size: 10pt; /* Tamaño de fuente reducido */
                color: #000000;
                margin: 0;
                padding: 0;
            }}

            .header {{
                width: 100%;
                margin-bottom: 8pt; /* Reducido */
                padding-top: 0;
            }}

            .timestamp {{
                font-size: 8pt;
                color: #666666;
                text-align: right;
            }}

            .title {{
                font-size: 16pt; /* Reducido */
                font-weight: bold;
                text-align: center;
                margin-top: 0;
                margin-bottom: 5pt;
            }}

            hr {{
                border: none;
                border-top: 1px solid #333333;
                margin: 3pt 0; /* Reducido */
            }}

            h2 {{
                font-size: 12pt; /* Reducido */
                font-weight: bold;
                margin-top: 12pt; /* Reducido */
                margin-bottom: 6pt; /* Reducido */
                color: #333333;
            }}

            .info-table {{
                width: 98%; /* Ligeramente reducido */
                margin-bottom: 10pt; /* Reducido */
                border-spacing: 0;
                font-size: 9pt; /* Reducido */
            }}

            .info-table .label {{
                font-weight: bold;
                width: 30%; /* Reducido */
                padding: 3pt 6pt 3pt 0; /* Reducido */
                vertical-align: top;
            }}

            .data-table {{
                width: 98%; /* Ligeramente reducido */
                border-collapse: collapse;
                margin-top: 8pt; /* Reducido */
                font-size: 9pt; /* Reducido */
            }}

            .data-table th {{
                background-color: #f2f2f2;
                font-weight: bold;
                text-align: left;
                padding: 2pt 4pt; /* Reducido */
                border-bottom: 1pt solid #dddddd;
            }}
            
            .data-table td {{
                padding: 2pt 4pt; /* Reducido */
                border-bottom: 1pt solid #dddddd;
            }}

            .footer {{
                text-align: center;
                font-size: 8pt; /* Reducido */
                color: #666666;
                margin-top: 8pt; /* Reducido */
            }}

            .page-number:before {{
                content: counter(page);
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="title">Informe de Venta #{venta.cod_ven}</h1>
            <hr>
        </div>

        <div class="section">
            <h2>Información General</h2>
            
            <table class="info-table">
                <tr>
                    <td class="label">Fecha:</td>
                    <td>{venta.fecha.strftime('%d/%m/%Y')}</td>
                </tr>
                <tr>
                    <td class="label">Cliente:</td>
                    <td>{venta.nom_cli}</td>
                </tr>
                <tr>
                    <td class="label">Cantidad de Animales:</td>
                    <td>{venta.cantidad}</td>
                </tr>
                <tr>
                    <td class="label">Precio Total:</td>
                    <td>${venta.precio_total:,.0f}</td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2>Detalles de Animales</h2>
            
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Código Animal</th>
                        <th>Edad</th>
                        <th>Peso(kg)</th>
                        <th>Precio Unitario</th>
                    </tr>
                </thead>
                <tbody>
    """
    
    # Añadir filas para cada animal según tu estructura de datos
    if hasattr(venta, 'detven_set') and venta.detven_set.exists():
        for detalle in venta.detven_set.all():
            html += f"""
                <tr>
                    <td>{detalle.cod_ani}</td>
                    <td>{detalle.edad_aniven} años</td>
                    <td>{detalle.peso_aniven} kg</td>
                    <td>${detalle.precio_uni:,.0f}</td>
                </tr>
            """
    else:
        html += """
                <tr>
                    <td colspan="4" style="text-align: center;">No hay animales registrados en esta venta.</td>
                </tr>
        """
    
    # Cerrar el HTML
    html += """
                </tbody>
            </table>
        </div>

        <div class="footer">
            Página <pdf:pagenumber> de <pdf:pagecount>
        </div>
    </body>
    </html>
    """
    
    # Configurar la respuesta HTTP para el PDF
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="venta_{venta_id}.pdf"'
    
    # Crear el PDF
    pisa_status = pisa.CreatePDF(
        html,
        dest=response
    )
    
    # Manejar errores
    if pisa_status.err:
        return HttpResponse('Error al generar el PDF', status=500)
    return response

@login_required
def cancelar_venta(request):
    """Vista para manejar la cancelación del formulario de venta"""
    if request.method == 'POST':
        messages.info(request, "Registro de venta cancelado")
        return redirect('ventas')
    else:
        # Si no es un POST request, redirigir a la página de compras
        return redirect('ventas')

"Vistas para crud de documentos"
@login_required
def documento(request):
    # Obtener ID del administrador desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Verificar que el usuario es un administrador
        administrador = Administrador.objects.get(pk=usuario_id)
        
        # Verificar si no hay documentos y reiniciar el AUTO_INCREMENT
        documentos_count = Documento.objects.filter(id_adm=administrador).count()
        if documentos_count == 0:
            with connection.cursor() as cursor:
                table_documento = Documento._meta.db_table
                cursor.execute(f"ALTER TABLE {table_documento} AUTO_INCREMENT = 1;")
        
        # Obtener parámetros de búsqueda y filtrado
        busqueda = request.GET.get('busqueda', '')
        tipo_filtro = request.GET.get('tipo_filtro', '')
        valor_filtro = request.GET.get('valor', '')
        
        # Variable para almacenar el tipo de búsqueda detectado
        tipo_busqueda = None
        
        # Consulta base de documentos del administrador actual
        documentos = Documento.objects.filter(id_adm=administrador)
        
        # Aplicar filtros según los parámetros recibidos
        if busqueda:
            import re
            from django.db.models import Q
            
            # Verificar si la búsqueda es una fecha en formato dd/mm/yyyy
            fecha_pattern = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{4})$')
            match = fecha_pattern.match(busqueda)
            
            if match:
                # Si es una fecha, convertir al formato yyyy-mm-dd para búsqueda en BD
                day, month, year = match.groups()
                # Asegurar formato con ceros a la izquierda
                day = day.zfill(2)
                month = month.zfill(2)
                fecha_formateada = f"{year}-{month}-{day}"
                documentos = documentos.filter(fecha_doc=fecha_formateada)
                tipo_busqueda = "fecha"
            else:
                # Si no es fecha, buscar por título
                documentos = documentos.filter(titulo__icontains=busqueda)
                tipo_busqueda = "titulo"
        
        # Aplicar filtro por categoría si está especificado
        if tipo_filtro == 'Tipo' and valor_filtro:
            documentos = documentos.filter(categoria=valor_filtro)
            
        # Marcar los documentos PDF
        for doc in documentos:
            doc.es_pdf = doc.archivo and doc.archivo.name.lower().endswith('.pdf')
        
        # Renderizar la plantilla con el contexto
        return render(request, 'paginas/documento.html', {
            "documentos": documentos,
            "titulo_pagina": 'Biblioteca de Documentos',
            "busqueda": busqueda,
            "current_page_name": "Documentos",
            "tipo_filtro": tipo_filtro,
            "valor_filtro": valor_filtro,
            "tipo_busqueda": tipo_busqueda,  # Pasar el tipo de búsqueda detectado a la plantilla
            'recordatorios': request.recordatorios,
            'hay_recordatorios': request.hay_recordatorios,
            'total_recordatorios': request.total_recordatorios
        })
        
    except Administrador.DoesNotExist:
        # Manejar el caso donde el usuario no es un administrador
        messages.error(request, 'No tienes permisos para acceder a esta sección')
        return render(request, 'error.html', {'mensaje': 'No tienes permisos para acceder a esta sección'})
    
@login_required
def agregar_documento(request):
    if request.method == 'POST':
        # Obtener los datos del formulario
        titulo = request.POST.get('titulo')
        categoria = request.POST.get('categoria')
        fecha_doc = request.POST.get('fecha_doc')
        archivo = request.FILES.get('archivo')
        
        # Validar que todos los campos requeridos estén presentes
        if not all([titulo, categoria, fecha_doc, archivo]):
            messages.error(request, 'Todos los campos son obligatorios')
            return redirect('documento')
            
        # Validar que el archivo sea PDF
        if archivo and not archivo.name.lower().endswith('.pdf'):
            messages.error(request, 'Solo se permiten archivos PDF')
            return redirect('documento')
        
        try:
            # Obtener el ID del administrador desde la sesión
            usuario_id = request.session.get('usuario_id')
            administrador = Administrador.objects.get(id_adm=usuario_id)
            
            # Crear el nuevo documento
            documento = Documento(
                titulo=titulo,
                categoria=categoria,
                fecha_doc=fecha_doc,
                archivo=archivo,
                id_adm=administrador
            )
            
            # Guardar el documento en la base de datos
            documento.save()
            
            messages.success(request, 'Documento guardado exitosamente')
            return redirect('documento')
            
        except Administrador.DoesNotExist:
            messages.error(request, 'Usuario no autorizado')
            return redirect('error')
        except Exception as e:
            messages.error(request, f'Error al guardar el documento: {str(e)}')
            return redirect('documento')
    
    # Si la solicitud no es POST, redirigir a la página de documentos
    return redirect('documento')

@login_required
def editar_documento(request, documento_id):
    # Obtener el ID del administrador actual desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    try:
        # Obtener el documento asegurándose que pertenezca al administrador actual
        documento = get_object_or_404(Documento, num_doc=documento_id, id_adm=usuario_id)
        
        if request.method == "POST":
            # Procesar el formulario de edición
            try:
                # Obtener datos del formulario
                titulo = request.POST.get("titulo")
                categoria = request.POST.get("categoria")
                fecha_doc = request.POST.get("fecha_doc")
                
                # Actualizar los campos del documento
                documento.titulo = titulo
                documento.categoria = categoria
                documento.fecha_doc = fecha_doc
                
                # Verificar si se subió un nuevo archivo
                nuevo_archivo = request.FILES.get('archivo')
                if nuevo_archivo:
                    # Si el archivo tiene extensión .pdf, actualizarlo
                    if nuevo_archivo.name.lower().endswith('.pdf'):
                        # Si existe un archivo anterior, eliminarlo (opcional)
                        if documento.archivo:
                            import os
                            if os.path.isfile(documento.archivo.path):
                                os.remove(documento.archivo.path)
                        
                        # Actualizar con el nuevo archivo
                        documento.archivo = nuevo_archivo
                    else:
                        messages.error(request, "Solo se permiten archivos PDF.")
                        return redirect('documento')
                
                # Guardar los cambios
                documento.save()
                
                messages.success(request, f"¡Documento '{titulo}' actualizado con éxito!")
                return redirect('documento')
                
            except ValueError:
                messages.error(request, "Error: Valores inválidos en el formulario. Verifica los datos ingresados.")
            except Exception as e:
                messages.error(request, f"Error al actualizar el documento: {str(e)}")
        
        # Si es GET o hubo error en POST, mostrar el modal de edición
        return render(request, "paginas/editar_documento.html", {
            "documento": documento,
            "current_page_name": "Editar Documento"
        })
        
    except Documento.DoesNotExist:
        messages.error(request, "Error: No se encontró el documento.")
        return redirect('documento')
    
@login_required
def eliminar_documento(request, documento_id):
    if request.method == "POST":
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener el documento asegurándose que pertenezca al administrador actual
            documento = get_object_or_404(Documento, num_doc=documento_id, id_adm=usuario_id)
            
            # Eliminar el documento
            documento.delete()
            
            # Verificar si ya no hay documentos y reiniciar el AUTO_INCREMENT
            documentos_count = Documento.objects.filter(id_adm=usuario_id).count()
            if documentos_count == 0:
                with connection.cursor() as cursor:
                    table_documento = Documento._meta.db_table
                    cursor.execute(f"ALTER TABLE {table_documento} AUTO_INCREMENT = 1;")
            
            messages.success(request, "Documento eliminado con éxito!")
            
        except Documento.DoesNotExist:
            messages.error(request, "Error: No se encontró el documento.")
        except Exception as e:
            messages.error(request, f"Error al eliminar: {str(e)}")
        
        return redirect('documento')
    
    # Si no es un POST, redirigir a documentos
    return redirect('documento')

@login_required
def cancelar_documento(request):
    
    if request.method == 'POST':
        messages.info(request, "Registro de documento cancelado")
        return redirect('documento')
    else:
        return redirect('documento')
    
"Vistas para crud de contactos"
@login_required
def contacto(request):
    # Obtener ID del administrador desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    # Verificar que el usuario es un administrador
    usuario = Administrador.objects.get(pk=usuario_id)

    # Iniciar con todos los contactos del administrador
    contactos = Contacto.objects.filter(id_adm=usuario)

    # Obtener parámetros de búsqueda y filtrado
    busqueda = request.GET.get('busqueda', '')
    tipo_filtro = request.GET.get('tipo_filtro', '')
    valor_filtro = request.GET.get('valor', '')  # Nota: el HTML usa 'valor', no 'valor_filtro'
    
    # Variable para almacenar el tipo de búsqueda detectado
    tipo_busqueda = None
    
    # Aplicar filtros de búsqueda si existe un término
    if busqueda:
        from django.db.models import Q
        
        # Intentar detectar si la búsqueda es por cargo o por nombre
        if any(cargo in busqueda.lower() for cargo in ['proveedor', 'veterinario', 'comprador', 'vacunador']):
            contactos = contactos.filter(cargo__icontains=busqueda)
            tipo_busqueda = "cargo"
        else:
            # Buscar en ambos campos con preferencia al nombre
            contactos = contactos.filter(
                Q(nombre__icontains=busqueda)
            )
            tipo_busqueda = "nombre"
    
    # Aplicar filtro por cargo si se ha seleccionado
    if tipo_filtro == 'Cargo' and valor_filtro:
        contactos = contactos.filter(cargo__icontains=valor_filtro)
    
    # Verificar si no hay contactos y reiniciar el AUTO_INCREMENT
    contactos_count = Contacto.objects.filter(id_adm=usuario).count()
    if contactos_count == 0:
        with connection.cursor() as cursor:
            table_documento = Contacto._meta.db_table
            cursor.execute(f"ALTER TABLE {table_documento} AUTO_INCREMENT = 1;")
    
     # Agrega esta función para asignar el cargo a la imagen correspondiente
    def obtener_imagen_cargo(cargo):
            
        cargo = cargo.lower()
        
        if 'proveedor' in cargo:
            return 'img/proveedor.png'
        elif 'veterinario' in cargo:
            return 'img/veterinario.png'
        elif 'comprador' in cargo:
            return 'img/comprador.png'
        elif 'vacunador' in cargo:
            return 'img/vacunador.png'
        # Añade más tipos de cargo según sea necesario
    
    # Enriquecer la consulta de contactos con rutas de imágenes
    for contacto in contactos:
        contacto.imagen = obtener_imagen_cargo(contacto.cargo)

    # Renderizar la plantilla con el contexto
    return render(request, 'paginas/contacto.html', {
        "contactos": contactos,
        "busqueda": busqueda,
        "current_page_name": "Contactos",
        "tipo_filtro": tipo_filtro,
        "valor_filtro": valor_filtro,
        "tipo_busqueda": tipo_busqueda,
        'recordatorios': request.recordatorios,
        'total_recordatorios': request.total_recordatorios,
        'hay_recordatorios': request.hay_recordatorios
    })

@login_required
def registrar_contacto(request):
    if request.method == "POST":
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener la instancia del administrador
            administrador = Administrador.objects.get(pk=usuario_id)

            # Verificar si no hay contactos y reiniciar el AUTO_INCREMENT
            contactos_count = Contacto.objects.filter(id_adm=usuario_id).count()
            if contactos_count == 1:
                with connection.cursor() as cursor:
                    table_contacto = Contacto._meta.db_table
                    cursor.execute(f"ALTER TABLE {table_contacto} AUTO_INCREMENT = 1;")
            
            nombre = request.POST.get("nombre")
            cargo = request.POST.get("cargo")
            correo = request.POST.get("correo")
            telefono = request.POST.get("telefono")
            
            # Crear y guardar el nuevo animal
            nuevo_contacto = Contacto(
                cargo=cargo,
                nombre=nombre,
                correo=correo,
                telefono=telefono,
                id_adm=administrador
            )
            nuevo_contacto.save()
            
            messages.success(request, f"¡Contacto registrado con éxito!")
            
        except Administrador.DoesNotExist:
            messages.error(request, "Error: No se pudo encontrar el administrador.")
        except ValueError:
            messages.error(request, "Error: Valores inválidos en el formulario. Verifica los datos ingresados.")
        except Exception as e:
            messages.error(request, f"Error al registrar el contacto: {str(e)}")
        
        return redirect('contacto')
    
    return redirect('contacto')

@login_required
def editar_contacto(request, id_cont):
    # Obtener el ID del administrador actual desde la sesión
    usuario_id = request.session.get('usuario_id')
    
    # Asumiendo que debes usar un modelo Contacto, no Animal
    contacto = get_object_or_404(Contacto, id_cont=id_cont, id_adm=usuario_id)
    
    if request.method == "POST":
        # Procesar el formulario de edición
        try:
            nombre = request.POST.get("nombre")
            cargo = request.POST.get("cargo")
            correo = request.POST.get("correo")
            telefono = request.POST.get("telefono")
            
            # Actualizar los campos del contacto
            contacto.nombre = nombre
            contacto.cargo = cargo
            contacto.correo = correo
            contacto.telefono = telefono
            
            # Guardar los cambios
            contacto.save()
            
            messages.success(request, f"¡Contacto #{id_cont} actualizado con éxito!")
            return redirect('contacto')
            
        except ValueError:
            messages.error(request, "Error: Valores inválidos en el formulario. Verifica los datos ingresados.")
        except Exception as e:
            messages.error(request, f"Error al actualizar el contacto: {str(e)}")
    
    # Si es GET o hubo error en POST, mostrar el formulario de edición
    return render(request, "paginas/contacto.html", {
        "contacto": contacto,
        "current_page_name": "Editar Contacto"
    })

@login_required
def eliminar_contacto(request, id_cont):
    if request.method == "POST":
        # Obtener el ID del administrador actual desde la sesión
        usuario_id = request.session.get('usuario_id')
        
        try:
            # Obtener el animal asegurándose que pertenezca al administrador actual
            contacto = get_object_or_404(Contacto, id_cont=id_cont, id_adm=usuario_id)
            
            # Guardar el código del animal para el mensaje
            id_contacto= id_cont
            
            # Eliminar el animal
            contacto.delete()
            
            messages.success(request, f"Contacto #{id_contacto} eliminado con éxito!")
            
        except Animal.DoesNotExist:
            messages.error(request, "Error: No se encontró el Contacto.")
        except Exception as e:
            messages.error(request, f"Error al eliminar el Contacto: {str(e)}")
        
        return redirect('contacto')
    
    # Si no es un POST, redirigir al inventario
    return redirect('contacto')

@login_required
def cancelar_contacto(request):
    
    if request.method == 'POST':
        messages.info(request, "Registro de contacto cancelado")
        return redirect('contacto')
    else:
        return redirect('contacto')
    
def formulario_soporte(request):
    if request.method == 'POST':
        form = FormularioSoporte(request.POST, request.FILES)
        if form.is_valid():
            # Obtener datos del formulario
            nombre = form.cleaned_data['nombreCompleto']
            email_remitente = form.cleaned_data['email']
            asunto = form.cleaned_data['asunto']
            descripcion = form.cleaned_data['descripcion']
            urgencia = form.cleaned_data['urgencia']
            
            # Construir el mensaje
            cuerpo_mensaje = f"""
            Se ha recibido una nueva solicitud de soporte:
            
            Nombre: {nombre}
            Email: {email_remitente}
            Asunto: {asunto}
            Urgencia: {urgencia}
            
            Descripción:
            {descripcion}
            """
            
            # Crear email
            email = EmailMessage(
                f'Solicitud de Soporte: {asunto}',
                cuerpo_mensaje,
                'tu_sitio@ejemplo.com',  # Remitente
                ['mundobovinoapp@gmail.com'],  # Destinatario 
                reply_to=[email_remitente]
            )
            
            # Adjuntar archivos
            files = request.FILES.getlist('adjuntos')
            if files:
                # Limitar a 3 archivos
                for i, adjunto in enumerate(files[:3]):
                    email.attach(adjunto.name, adjunto.read(), adjunto.content_type)
            
            # Enviar correo
            email.send()
            messages.success(request, 'Tu solicitud ha sido enviada correctamente.')
            return render(request, 'paginas/faq.html', {'form': FormularioSoporte()})
    else:
        form = FormularioSoporte()
    
    return render(request, 'paginas/faq.html', {'form': form})

"vista para cerrar sesión"
def logout(request):
    # Clear all session data
    request.session.flush()
    messages.success(request, "Has cerrado sesión correctamente")
    return redirect('iniciarsesion')