/**
 * Find Doctor - Scripts
 */

document.addEventListener('DOMContentLoaded', function() {
    // Gestion du toggle de la sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    if (sidebarToggle && sidebar && mainContent) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            mainContent.classList.toggle('main-content-expanded');
        });
    }
    
    // Gestion du menu mobile
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-open');
        });
        
        // Fermer le menu quand on clique en dehors
        document.addEventListener('click', function(event) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggle = mobileMenuToggle.contains(event.target);
            
            if (!isClickInsideSidebar && !isClickOnToggle && sidebar.classList.contains('sidebar-open')) {
                sidebar.classList.remove('sidebar-open');
            }
        });
    }
    
    // Gestion des notifications
    setupNotifications();
    
    // Gestion du profil utilisateur
    setupUserProfile();
});

/**
 * Configure les notifications
 */
function setupNotifications() {
    const notificationIcon = document.querySelector('.topbar-notification');
    
    if (!notificationIcon) return;
    
    notificationIcon.addEventListener('click', function() {
        // Ici, on pourrait afficher un dropdown avec les notifications
        console.log('Notifications clicked');
    });
}

/**
 * Configure le menu du profil utilisateur
 */
function setupUserProfile() {
    const profileElement = document.querySelector('.topbar-profile');
    
    if (!profileElement) return;
    
    profileElement.addEventListener('click', function() {
        // Redirection vers la page de profil
        window.location.href = '/patient/profile';
    });
}
