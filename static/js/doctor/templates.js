// Script pour gérer les modèles de notes et de prescriptions

document.addEventListener('DOMContentLoaded', function() {
    // Éléments pour les notes
    const notesTemplateButtons = document.querySelectorAll('#notes-tab .template-btn');
    const notesTextarea = document.getElementById('consultation-notes');
    
    // Éléments pour les prescriptions
    const prescriptionTemplateButtons = document.querySelectorAll('#prescription-tab .template-btn');
    const prescriptionTextarea = document.getElementById('prescription-content');
    
    // Modèles de notes
    const notesTemplates = {
        'general': `Date: ${new Date().toLocaleDateString('fr-FR')}
Heure: ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}

MOTIF DE CONSULTATION:
- 

ANTÉCÉDENTS PERTINENTS:
- 

EXAMEN CLINIQUE:
- Tension artérielle: 
- Fréquence cardiaque: 
- Température: 
- Poids: 
- Taille: 

OBSERVATIONS:
- 

DIAGNOSTIC:
- 

PLAN DE TRAITEMENT:
- 

SUIVI:
- `,

        'followup': `Date: ${new Date().toLocaleDateString('fr-FR')}
Heure: ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}

SUIVI DE:
- 

ÉVOLUTION DEPUIS LA DERNIÈRE CONSULTATION:
- 

EXAMEN CLINIQUE:
- Tension artérielle: 
- Fréquence cardiaque: 
- Température: 
- Poids: 
- Taille: 

RÉSULTATS D'EXAMENS:
- 

AJUSTEMENT DU TRAITEMENT:
- 

PROCHAIN RENDEZ-VOUS:
- `,

        'chronic': `Date: ${new Date().toLocaleDateString('fr-FR')}
Heure: ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}

SUIVI DE MALADIE CHRONIQUE:
- 

SYMPTÔMES ACTUELS:
- 

ADHÉRENCE AU TRAITEMENT:
- 

EFFETS SECONDAIRES RAPPORTÉS:
- 

EXAMEN CLINIQUE:
- Tension artérielle: 
- Fréquence cardiaque: 
- Poids: 

RÉSULTATS DE LABORATOIRE:
- 

AJUSTEMENT DU TRAITEMENT:
- 

ÉDUCATION THÉRAPEUTIQUE:
- 

PROCHAIN RENDEZ-VOUS:
- `
    };
    
    // Modèles de prescriptions
    const prescriptionTemplates = {
        'general': `Date: ${new Date().toLocaleDateString('fr-FR')}

Prescription:
- Médicament 1: posologie, durée
- Médicament 2: posologie, durée

Instructions particulières:
- Prendre les médicaments avec de la nourriture
- Éviter l'alcool pendant le traitement`,

        'antibiotics': `Date: ${new Date().toLocaleDateString('fr-FR')}

Prescription:
- Amoxicilline 500mg: 1 comprimé 3 fois par jour pendant 7 jours
- Probiotiques: 1 gélule par jour pendant 10 jours

Instructions particulières:
- Prendre les antibiotiques à intervalles réguliers
- Terminer tout le traitement même si les symptômes s'améliorent
- Prendre les probiotiques 2 heures après l'antibiotique`,

        'painkillers': `Date: ${new Date().toLocaleDateString('fr-FR')}

Prescription:
- Paracétamol 1000mg: 1 comprimé toutes les 6 heures si nécessaire (max 4 par jour)
- Ibuprofène 400mg: 1 comprimé toutes les 8 heures après les repas si nécessaire

Instructions particulières:
- Ne pas dépasser les doses prescrites
- Prendre l'ibuprofène après les repas
- Contacter le médecin si la douleur persiste après 5 jours`
    };
    
    // Fonction pour appliquer un modèle de notes
    function applyNotesTemplate(templateName) {
        if (notesTemplates[templateName]) {
            // Animation de transition
            notesTextarea.classList.add('fade-in');
            
            // Si le textarea n'est pas vide, demander confirmation
            if (notesTextarea.value.trim() !== '') {
                if (confirm('Êtes-vous sûr de vouloir remplacer le contenu actuel par ce modèle?')) {
                    notesTextarea.value = notesTemplates[templateName];
                }
            } else {
                notesTextarea.value = notesTemplates[templateName];
            }
            
            // Retirer la classe d'animation après l'animation
            setTimeout(() => {
                notesTextarea.classList.remove('fade-in');
            }, 300);
        }
    }
    
    // Fonction pour appliquer un modèle de prescription
    function applyPrescriptionTemplate(templateName) {
        if (prescriptionTemplates[templateName]) {
            // Animation de transition
            prescriptionTextarea.classList.add('fade-in');
            
            // Si le textarea n'est pas vide, demander confirmation
            if (prescriptionTextarea.value.trim() !== '') {
                if (confirm('Êtes-vous sûr de vouloir remplacer le contenu actuel par ce modèle?')) {
                    prescriptionTextarea.value = prescriptionTemplates[templateName];
                }
            } else {
                prescriptionTextarea.value = prescriptionTemplates[templateName];
            }
            
            // Retirer la classe d'animation après l'animation
            setTimeout(() => {
                prescriptionTextarea.classList.remove('fade-in');
            }, 300);
        }
    }
    
    // Événements pour les modèles de notes
    notesTemplateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const templateName = this.getAttribute('data-template');
            applyNotesTemplate(templateName);
        });
    });
    
    // Événements pour les modèles de prescriptions
    prescriptionTemplateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const templateName = this.getAttribute('data-template');
            applyPrescriptionTemplate(templateName);
        });
    });
    
    // Animation pour les boutons de modèle
    const allTemplateButtons = document.querySelectorAll('.template-btn');
    allTemplateButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.classList.add('btn-animation');
        });
        
        button.addEventListener('mouseleave', function() {
            this.classList.remove('btn-animation');
        });
    });
});
