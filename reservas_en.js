document.addEventListener('DOMContentLoaded', function() {
    // Flatpickr configuration for English
    flatpickr("#fecha-tour", {
        dateFormat: "d/m/Y",
        minDate: "today",
        locale: "en",
        disable: [
            function(date) {
                // Disable Sundays
                return (date.getDay() === 0);
            }
        ]
    });

    // Reservation summary logic (English)
    const tourSelect = document.getElementById('tour-seleccion');
    const fechaInput = document.getElementById('fecha-tour');
    const cantidadInput = document.getElementById('cantidad-personas');
    const detallesReserva = document.getElementById('detalles-reserva');
    const totalPagar = document.getElementById('total-pagar');

    function updateSummary() {
        const tour = tourSelect.options[tourSelect.selectedIndex];
        const fecha = fechaInput.value;
        const cantidad = cantidadInput.value;

        if (tour.value && fecha) {
            detallesReserva.innerHTML = `
                <p><strong>Tour:</strong> ${tour.text}</p>
                <p><strong>Date:</strong> ${fecha}</p>
                <p><strong>People:</strong> ${cantidad}</p>
            `;
            const precio = parseFloat(tour.text.split(' - $')[1].split(' ')[0]);
            totalPagar.textContent = `$${precio * parseInt(cantidad || 0)} USD`;
        }
    }

    tourSelect.addEventListener('change', updateSummary);
    fechaInput.addEventListener('change', updateSummary);
    cantidadInput.addEventListener('input', updateSummary);

    document.getElementById('formulario-reserva').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Reservation sent successfully. We will contact you soon.');
        this.reset();
        detallesReserva.innerHTML = '<p>Select a tour and date to see the details</p>';
        totalPagar.textContent = '$0 USD';
    });
});
