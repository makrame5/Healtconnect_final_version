/**
 * Script simplifié pour les notifications
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation du système de notifications simplifié...');
    
    // Éléments DOM
    const notificationBtn = document.getElementById('notification-btn');
    const notificationMenu = document.getElementById('notification-menu');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    
    // Vérifier si les éléments existent
    if (!notificationBtn) {
        console.error('Élément notification-btn non trouvé');
        return;
    }
    
    if (!notificationMenu) {
        console.error('Élément notification-menu non trouvé');
        return;
    }
    
    console.log('Éléments de notification trouvés, configuration des événements...');
    
    // Gestionnaire de clic pour le bouton de notification
    notificationBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        console.log('Clic sur le bouton de notification');
        
        // Toggle de la classe active sur le bouton
        notificationBtn.classList.toggle('active');
        
        // Toggle de la classe show sur le menu
        notificationMenu.classList.toggle('show');
        
        console.log('État du menu:', notificationMenu.classList.contains('show') ? 'visible' : 'caché');
    });
    
    // Empêcher la fermeture du menu lors d'un clic à l'intérieur
    notificationMenu.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    // Fermer le menu lors d'un clic à l'extérieur
    document.addEventListener('click', function() {
        if (notificationMenu.classList.contains('show')) {
            notificationMenu.classList.remove('show');
            notificationBtn.classList.remove('active');
            console.log('Menu fermé par clic extérieur');
        }
    });
    
    // Gestionnaire pour le bouton "Tout marquer comme lu"
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function() {
            console.log('Clic sur "Tout marquer comme lu"');
            // Ici, vous pouvez ajouter la logique pour marquer toutes les notifications comme lues
        });
    }
    
    console.log('Système de notifications simplifié initialisé avec succès');
});
