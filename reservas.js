document.addEventListener('DOMContentLoaded', function() {
    // Configuración de Flatpickr
    flatpickr("#fecha-tour", {
        dateFormat: "d/m/Y",
        minDate: "today",
        locale: "es",
        disable: [
            function(date) {
                // Deshabilitar domingos
                return (date.getDay() === 0);
            }
        ]
    });

    // Resto del código para manejar la reserva...
    const tourSelect = document.getElementById('tour-seleccion');
    const fechaInput = document.getElementById('fecha-tour');
    const cantidadInput = document.getElementById('cantidad-personas');
    const detallesReserva = document.getElementById('detalles-reserva');
    const totalPagar = document.getElementById('total-pagar');

    // Actualizar resumen cuando cambian los valores
    function actualizarResumen() {
        const tour = tourSelect.options[tourSelect.selectedIndex];
        const fecha = fechaInput.value;
        const cantidad = cantidadInput.value;

        if (tour.value && fecha) {
            detallesReserva.innerHTML = `
                <p><strong>Tour:</strong> ${tour.text}</p>
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>Personas:</strong> ${cantidad}</p>
            `;
            
            // Calcular total (eliminar $ y USD para el cálculo)
            const precio = parseFloat(tour.text.split(' - $')[1].split(' ')[0]);
            totalPagar.textContent = `$${precio * parseInt(cantidad || 0)} USD`;
        }
    }

    // Escuchar cambios
    tourSelect.addEventListener('change', actualizarResumen);
    fechaInput.addEventListener('change', actualizarResumen);
    cantidadInput.addEventListener('input', actualizarResumen);

    // Manejar el envío del formulario
    document.getElementById('formulario-reserva').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Reserva enviada con éxito. Nos pondremos en contacto contigo pronto.');
        this.reset();
        detallesReserva.innerHTML = '<p>Seleccione un tour y fecha para ver los detalles</p>';
        totalPagar.textContent = '$0 USD';
    });

    // Agregar botón para abrir la página en chino
    const btnChino = document.createElement('button');
    btnChino.textContent = '中文';
    btnChino.type = 'button';
    btnChino.style.cssText = 'float:right;margin:10px 0 0 10px;';
    btnChino.onclick = function() {
        window.location.href = 'pagina de cobros1_zh.html';
    };
    // Insertar el botón en el header si existe y hay un nav
    const headerContainer = document.querySelector('.header-container');
    const nav = headerContainer ? headerContainer.querySelector('nav') : null;
    if (headerContainer && nav) {
        nav.parentNode.insertBefore(btnChino, nav);
    } else if (headerContainer) {
        headerContainer.appendChild(btnChino);
    }
});

// En este archivo reservas.js, las variables que se usan para mostrar el resumen y calcular el total son:
const tourSelect = document.getElementById('tour-seleccion');
const fechaInput = document.getElementById('fecha-tour');
const cantidadInput = document.getElementById('cantidad-personas');

// Cuando se actualiza el resumen, se usan:
const tour = tourSelect.options[tourSelect.selectedIndex];
const fecha = fechaInput.value;
const cantidad = cantidadInput.value;

// El total se calcula y se muestra en el elemento con id 'total-pagar'

// Al enviar el formulario, NO se envía ningún dato a EmailJS desde este archivo.
// Solo se muestra un alert y se resetea el formulario.