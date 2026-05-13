document.addEventListener('DOMContentLoaded', function() {
    const menuTranslations = {
        es: { openMenu: 'Abrir menu', closeMenu: 'Cerrar menu', mobileMenu: 'Menu movil', openSubmenu: 'Abrir submenu', navHome: 'Inicio', navHiking: 'Tours Caminata', navSnorkeling: 'Tours Snorkeling', navPackages: 'Paquetes Turisticos', navBookings: 'Reservas', navContacts: 'Contactos', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Islas Plazas', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Blog Ruta Tortuga', weddings: 'Bodas', restaurants: 'Restaurantes' },
        en: { openMenu: 'Open menu', closeMenu: 'Close menu', mobileMenu: 'Mobile menu', openSubmenu: 'Open submenu', navHome: 'Home', navHiking: 'Hiking Tours', navSnorkeling: 'Snorkeling Tours', navPackages: 'Tour Packages', navBookings: 'Bookings', navContacts: 'Contact', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Plazas Islands', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Tortuga Route Blog', weddings: 'Weddings', restaurants: 'Restaurants' },
        fr: { openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', mobileMenu: 'Menu mobile', openSubmenu: 'Ouvrir le sous-menu', navHome: 'Accueil', navHiking: 'Excursions Randonnee', navSnorkeling: 'Excursions Snorkeling', navPackages: 'Forfaits Touristiques', navBookings: 'Reservations', navContacts: 'Contacts', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Iles Plazas', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Blog Route Tortuga', weddings: 'Mariages', restaurants: 'Restaurants' },
        de: { openMenu: 'Menue oeffnen', closeMenu: 'Menue schliessen', mobileMenu: 'Mobiles Menue', openSubmenu: 'Untermenue oeffnen', navHome: 'Startseite', navHiking: 'Wandertouren', navSnorkeling: 'Schnorcheltouren', navPackages: 'Reisepakete', navBookings: 'Reservierungen', navContacts: 'Kontakt', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Plazas-Inseln', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Tortuga-Routen Blog', weddings: 'Hochzeiten', restaurants: 'Restaurants' },
        it: { openMenu: 'Apri menu', closeMenu: 'Chiudi menu', mobileMenu: 'Menu mobile', openSubmenu: 'Apri sottomenu', navHome: 'Home', navHiking: 'Tour Trekking', navSnorkeling: 'Tour Snorkeling', navPackages: 'Pacchetti Turistici', navBookings: 'Prenotazioni', navContacts: 'Contatti', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Isole Plazas', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Blog Rotta Tortuga', weddings: 'Matrimoni', restaurants: 'Ristoranti' },
        pt: { openMenu: 'Abrir menu', closeMenu: 'Fechar menu', mobileMenu: 'Menu movel', openSubmenu: 'Abrir submenu', navHome: 'Inicio', navHiking: 'Tours de Caminhada', navSnorkeling: 'Tours de Snorkeling', navPackages: 'Pacotes Turisticos', navBookings: 'Reservas', navContacts: 'Contatos', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Ilhas Plazas', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Blog Rota Tortuga', weddings: 'Casamentos', restaurants: 'Restaurantes' },
        ru: { openMenu: 'Otkryt menu', closeMenu: 'Zakryt menu', mobileMenu: 'Mobilnoe menu', openSubmenu: 'Otkryt podmenu', navHome: 'Glavnaya', navHiking: 'Peshie Tury', navSnorkeling: 'Snorkling Tury', navPackages: 'Turpakety', navBookings: 'Bronirovanie', navContacts: 'Kontakty', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Ostrova Plasas', islandPinzon: 'Pinzon', islandSantaFe: 'Santa-Fe', blogTortuga: 'Blog Marshrut Tortuga', weddings: 'Svadby', restaurants: 'Restorany' },
        zh: { openMenu: 'Open menu', closeMenu: 'Close menu', mobileMenu: 'Mobile menu', openSubmenu: 'Open submenu', navHome: 'Home', navHiking: 'Hiking Tours', navSnorkeling: 'Snorkeling Tours', navPackages: 'Tour Packages', navBookings: 'Bookings', navContacts: 'Contact', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Plazas Islands', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Tortuga Route Blog', weddings: 'Weddings', restaurants: 'Restaurants' },
        ja: { openMenu: 'Open menu', closeMenu: 'Close menu', mobileMenu: 'Mobile menu', openSubmenu: 'Open submenu', navHome: 'Home', navHiking: 'Hiking Tours', navSnorkeling: 'Snorkeling Tours', navPackages: 'Tour Packages', navBookings: 'Bookings', navContacts: 'Contact', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Plazas Islands', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Tortuga Route Blog', weddings: 'Weddings', restaurants: 'Restaurants' },
        ko: { openMenu: 'Open menu', closeMenu: 'Close menu', mobileMenu: 'Mobile menu', openSubmenu: 'Open submenu', navHome: 'Home', navHiking: 'Hiking Tours', navSnorkeling: 'Snorkeling Tours', navPackages: 'Tour Packages', navBookings: 'Bookings', navContacts: 'Contact', navBlog: 'Blog', islandBartolome: 'Bartolome', islandSeymour: 'Seymour', islandPlazas: 'Plazas Islands', islandPinzon: 'Pinzon', islandSantaFe: 'Santa Fe', blogTortuga: 'Tortuga Route Blog', weddings: 'Weddings', restaurants: 'Restaurants' }
    };

    function applyMenuLanguage(language) {
        const active = menuTranslations[language] ? language : 'es';
        const t = menuTranslations[active];

        document.querySelectorAll('[data-menu-i18n]').forEach(function(el) {
            const key = el.getAttribute('data-menu-i18n');
            if (t[key]) {
                el.textContent = t[key];
            }
        });

        document.querySelectorAll('[data-menu-i18n-attr]').forEach(function(el) {
            const mapping = el.getAttribute('data-menu-i18n-attr');
            if (!mapping) {
                return;
            }
            const parts = mapping.split(':');
            if (parts.length !== 2) {
                return;
            }
            const attr = parts[0].trim();
            const key = parts[1].trim();
            if (t[key]) {
                el.setAttribute(attr, t[key]);
            }
        });
    }

    const selector = document.getElementById('language-selector');
    const saved = localStorage.getItem('redtip_language');
    const browser = (navigator.language || 'es').slice(0, 2).toLowerCase();
    const initial = (selector && selector.value) || saved || browser || 'es';

    applyMenuLanguage(initial);

    if (selector) {
        selector.addEventListener('change', function() {
            applyMenuLanguage(selector.value);
        });
    }
});
