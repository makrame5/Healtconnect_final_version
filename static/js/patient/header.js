/**
 * Initialisation des fonctionnalités du header
 */
document.addEventListener('DOMContentLoaded', function() {
    // Note: setupNotifications est maintenant géré par notifications.js
    setupProfileMenu();
    setupThemeToggle();
    setupMobileMenu();
});

/**
 * Configure le menu profil
 */
function setupProfileMenu() {
    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (!profileToggle || !profileDropdown) return;

    profileToggle.addEventListener('click', function(event) {
        event.stopPropagation();

        // Fermer le dropdown notifications s'il est ouvert
        const notificationDropdown = document.getElementById('notification-dropdown');
        const notificationToggle = document.getElementById('notification-toggle');

        if (notificationDropdown && notificationDropdown.classList.contains('show')) {
            notificationDropdown.classList.remove('show');
            notificationToggle.classList.remove('active');
        }

        // Toggle du dropdown profil
        profileDropdown.classList.toggle('show');
        profileToggle.classList.toggle('active');
    });

    // Empêcher la fermeture quand on clique dans le dropdown
    profileDropdown.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    // Fermer le dropdown quand on clique ailleurs
    document.addEventListener('click', function() {
        if (profileDropdown.classList.contains('show')) {
            profileDropdown.classList.remove('show');
            profileToggle.classList.remove('active');
        }
    });
}

/**
 * Configure le basculement du thème sombre/clair
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');

    if (!themeToggle) return;

    // Vérifier si le mode sombre est déjà activé dans le localStorage
    const isDarkMode = localStorage.getItem('darkMode') === 'true';

    // Appliquer le mode sombre si nécessaire
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.classList.add('active');
    }

    themeToggle.addEventListener('click', function() {
        // Toggle du mode sombre
        document.body.classList.toggle('dark-mode');
        themeToggle.classList.toggle('active');

        // Sauvegarder la préférence dans le localStorage
        const isDarkModeNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkModeNow);
    });
}

/**
 * Configure le menu mobile
 */
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    if (!mobileMenuToggle || !sidebar) return;

    mobileMenuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('show-mobile');
    });
}
