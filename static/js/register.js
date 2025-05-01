// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Form navigation (next/previous steps)
    setupFormNavigation();

    // Password visibility toggle
    setupPasswordToggle();

    // Password strength meter
    setupPasswordStrength();

    // File upload display
    setupFileUpload();

    // Form validation and submission
    setupFormValidation();
});

// Setup form navigation between steps
function setupFormNavigation() {
    // Next step buttons
    const nextButtons = document.querySelectorAll('.next-step');
    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = parseInt(this.closest('.form-step').dataset.step);
            const nextStep = parseInt(this.dataset.next);

            // Validate current step before proceeding
            if (validateStep(currentStep)) {
                // Hide current step
                document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.remove('active');
                // Show next step
                document.querySelector(`.form-step[data-step="${nextStep}"]`).classList.add('active');

                // Update progress indicators
                document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.add('completed');
                document.querySelector(`.progress-step[data-step="${nextStep}"]`).classList.add('active');

                // Scroll to top of form
                document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Previous step buttons
    const prevButtons = document.querySelectorAll('.prev-step');
    prevButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = parseInt(this.closest('.form-step').dataset.step);
            const prevStep = parseInt(this.dataset.prev);

            // Hide current step
            document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.remove('active');
            // Show previous step
            document.querySelector(`.form-step[data-step="${prevStep}"]`).classList.add('active');

            // Update progress indicators
            document.querySelector(`.progress-step[data-step="${currentStep}"]`).classList.remove('active');
            document.querySelector(`.progress-step[data-step="${prevStep}"]`).classList.add('active');

            // Scroll to top of form
            document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// Toggle password visibility
function setupPasswordToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const passwordInput = this.previousElementSibling;
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Toggle icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });
}

// Password strength meter
function setupPasswordStrength() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;

    const strengthBar = document.querySelector('.strength-bar');
    const strengthLabel = document.querySelector('.strength-label');

    // Password requirement indicators
    const lengthReq = document.getElementById('length');
    const uppercaseReq = document.getElementById('uppercase');
    const lowercaseReq = document.getElementById('lowercase');
    const numberReq = document.getElementById('number');
    const specialReq = document.getElementById('special');

    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;

        // Check length
        if (password.length >= 8) {
            strength += 1;
            lengthReq.classList.add('valid');
        } else {
            lengthReq.classList.remove('valid');
        }

        // Check uppercase
        if (/[A-Z]/.test(password)) {
            strength += 1;
            uppercaseReq.classList.add('valid');
        } else {
            uppercaseReq.classList.remove('valid');
        }

        // Check lowercase
        if (/[a-z]/.test(password)) {
            strength += 1;
            lowercaseReq.classList.add('valid');
        } else {
            lowercaseReq.classList.remove('valid');
        }

        // Check numbers
        if (/[0-9]/.test(password)) {
            strength += 1;
            numberReq.classList.add('valid');
        } else {
            numberReq.classList.remove('valid');
        }

        // Check special characters
        if (/[^A-Za-z0-9]/.test(password)) {
            strength += 1;
            specialReq.classList.add('valid');
        } else {
            specialReq.classList.remove('valid');
        }

        // Update strength bar
        strengthBar.className = 'strength-bar';
        if (password.length === 0) {
            strengthLabel.textContent = 'Force du mot de passe';
        } else if (strength < 2) {
            strengthBar.classList.add('weak');
            strengthLabel.textContent = 'Faible';
        } else if (strength < 4) {
            strengthBar.classList.add('medium');
            strengthLabel.textContent = 'Moyen';
        } else if (strength < 5) {
            strengthBar.classList.add('strong');
            strengthLabel.textContent = 'Fort';
        } else {
            strengthBar.classList.add('very-strong');
            strengthLabel.textContent = 'Très fort';
        }
    });
}

// File upload display
function setupFileUpload() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const fileName = this.files[0] ? this.files[0].name : 'Aucun fichier choisi';
            const fileNameDisplay = this.closest('.file-upload').querySelector('.file-name');
            fileNameDisplay.textContent = fileName;
        });
    });
}

// Form validation
function validateStep(step) {
    let isValid = true;
    const form = document.querySelector('.form-step[data-step="' + step + '"]');

    // Check all required fields in the current step
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        const errorElement = document.getElementById(field.id + 'Error');

        // Clear previous error
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }

        // Check if field is empty
        if (!field.value.trim()) {
            isValid = false;
            if (errorElement) {
                errorElement.textContent = 'Ce champ est obligatoire';
                errorElement.classList.add('show');
            }
        }

        // Email validation
        if (field.type === 'email' && field.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                if (errorElement) {
                    errorElement.textContent = 'Veuillez entrer une adresse email valide';
                    errorElement.classList.add('show');
                }
            }
        }

        // Password validation
        if (field.id === 'password' && field.value.trim()) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
            if (!passwordRegex.test(field.value)) {
                isValid = false;
                if (errorElement) {
                    errorElement.textContent = 'Le mot de passe ne respecte pas les critères de sécurité';
                    errorElement.classList.add('show');
                }
            }
        }

        // Confirm password validation
        if (field.id === 'confirmPassword' && field.value.trim()) {
            const password = document.getElementById('password').value;
            if (field.value !== password) {
                isValid = false;
                if (errorElement) {
                    errorElement.textContent = 'Les mots de passe ne correspondent pas';
                    errorElement.classList.add('show');
                }
            }
        }

        // Phone validation
        if (field.id === 'phone' && field.value.trim()) {
            const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
            if (!phoneRegex.test(field.value)) {
                isValid = false;
                if (errorElement) {
                    errorElement.textContent = 'Veuillez entrer un numéro de téléphone valide';
                    errorElement.classList.add('show');
                }
            }
        }

        // Checkbox group validation (at least one checked)
        if (field.type === 'checkbox' && field.name.includes('Type')) {
            const checkboxGroup = document.querySelectorAll(`input[name="${field.name}"]`);
            const isChecked = Array.from(checkboxGroup).some(cb => cb.checked);

            if (!isChecked) {
                isValid = false;
                const groupError = document.getElementById(field.name + 'Error');
                if (groupError) {
                    groupError.textContent = 'Veuillez sélectionner au moins une option';
                    groupError.classList.add('show');
                }
            }
        }
    });

    return isValid;
}

// Form submission
function setupFormValidation() {
    const patientForm = document.getElementById('patientRegistrationForm');
    const doctorForm = document.getElementById('doctorRegistrationForm');

    // Patient form submission
    if (patientForm) {
        patientForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Validate final step
            if (validateStep(3)) {
                // Collect form data
                const formData = new FormData(this);

                // Convert FormData to JSON
                const formJson = {};
                formData.forEach((value, key) => {
                    // Handle checkboxes (multiple values)
                    if (formJson[key]) {
                        if (!Array.isArray(formJson[key])) {
                            formJson[key] = [formJson[key]];
                        }
                        formJson[key].push(value);
                    } else {
                        formJson[key] = value;
                    }
                });

                // Send data to server
                registerPatient(formJson);
            }
        });
    }

    // Doctor form submission
    if (doctorForm) {
        doctorForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Validate final step
            if (validateStep(3)) {
                // Collect form data
                const formData = new FormData(this);

                // Handle file uploads
                const documentFile = document.getElementById('document').files[0];
                const profilePicture = document.getElementById('profilePicture').files[0];

                if (documentFile) {
                    formData.append('document', documentFile);
                }

                if (profilePicture) {
                    formData.append('profilePicture', profilePicture);
                }

                // Send data to server
                registerDoctor(formData);
            }
        });
    }
}

// API call to register patient
function registerPatient(patientData) {
    // Show loading state
    showLoadingState();

    // API call
    fetch('http://localhost:5000/api/auth/register/patient', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(patientData)
    })
    .then(response => response.json())
    .then(data => {
        // Hide loading state
        hideLoadingState();

        if (data.success) {
            // Show success message
            showSuccessMessage('Votre compte a été créé avec succès ! Vous allez être redirigé vers la page de connexion.');

            // Redirect to login page after 3 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            // Show error message
            showErrorMessage(data.message || 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.');
        }
    })
    .catch(error => {
        // Hide loading state
        hideLoadingState();

        // Show error message
        showErrorMessage('Une erreur est survenue lors de la connexion au serveur. Veuillez réessayer plus tard.');
        console.error('Registration error:', error);
    });
}

// API call to register doctor
function registerDoctor(doctorData) {
    // Show loading state
    showLoadingState();

    // API call
    fetch('http://localhost:5000/api/auth/register/doctor', {
        method: 'POST',
        body: doctorData // FormData for file uploads
    })
    .then(response => response.json())
    .then(data => {
        // Hide loading state
        hideLoadingState();

        if (data.success) {
            // Show success message
            showSuccessMessage('Votre compte a été créé avec succès ! Votre profil sera vérifié par notre équipe avant activation. Vous allez être redirigé vers la page de connexion.');

            // Redirect to login page after 5 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 5000);
        } else {
            // Show error message
            showErrorMessage(data.message || 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.');
        }
    })
    .catch(error => {
        // Hide loading state
        hideLoadingState();

        // Show error message
        showErrorMessage('Une erreur est survenue lors de la connexion au serveur. Veuillez réessayer plus tard.');
        console.error('Registration error:', error);
    });
}

// Helper functions for UI feedback
function showLoadingState() {
    // Create loading overlay if it doesn't exist
    if (!document.querySelector('.loading-overlay')) {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Traitement en cours...</p>
        `;
        document.body.appendChild(loadingOverlay);
    }

    // Show loading overlay
    document.querySelector('.loading-overlay').style.display = 'flex';
}

function hideLoadingState() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showSuccessMessage(message) {
    // Create message container if it doesn't exist
    if (!document.querySelector('.message-container')) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        document.body.appendChild(messageContainer);
    }

    // Create and show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'message success-message';
    successMessage.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <p>${message}</p>
    `;

    document.querySelector('.message-container').appendChild(successMessage);

    // Remove message after 5 seconds
    setTimeout(() => {
        successMessage.remove();
    }, 5000);
}

function showErrorMessage(message) {
    // Create message container if it doesn't exist
    if (!document.querySelector('.message-container')) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        document.body.appendChild(messageContainer);
    }

    // Create and show error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'message error-message';
    errorMessage.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
    `;

    document.querySelector('.message-container').appendChild(errorMessage);

    // Remove message after 5 seconds
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}
