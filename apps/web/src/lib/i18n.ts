import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const en = {
  translation: {
    settings: {
      title: 'Settings',
      account: 'Account',
      edit: 'Edit',
      preferences: 'Preferences',
      notifications: 'Notifications',
      notificationsDesc: 'Event alerts and messages',
      darkMode: 'Dark Mode',
      darkModeDesc: 'Interface theme',
      language: 'Language',
      languageName: 'English',
      security: 'Security',
      password: 'Password',
      passwordDesc: 'Change your password',
      privacy: 'Privacy',
      privacyDesc: 'Personal data',
      phone: 'Phone Number',
      notProvided: 'Not provided',
      about: 'About',
      support: 'Support',
      version: 'Version',
      terms: 'Terms of Use',
      privacyPolicy: 'Privacy Policy',
      logout: 'Log Out',
    },
    languageModal: {
      title: 'Language',
      select: 'Select your language',
      french: 'Français',
      english: 'English',
      save: 'Save',
    },
    changePasswordModal: {
      title: 'Change Password',
      oldPassword: 'Old Password',
      newPassword: 'New Password',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
      success: 'Password successfully updated!',
      error: 'Incorrect old password',
      required: 'Required',
    },
    privacyModal: {
      title: 'Privacy',
      isPublic: 'Public Profile',
      isPublicDesc: 'Allow others to find your profile in search.',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
    },
    editPhoneModal: {
      title: 'Phone Number',
      number: 'Your Phone Number',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
      success: 'Phone number updated',
    }
  }
};

// French translations
const fr = {
  translation: {
    settings: {
      title: 'Paramètres',
      account: 'Compte',
      edit: 'Modifier',
      preferences: 'Préférences',
      notifications: 'Notifications',
      notificationsDesc: 'Alertes événements et messages',
      darkMode: 'Mode sombre',
      darkModeDesc: 'Thème de l\'interface',
      language: 'Langue',
      languageName: 'Français',
      security: 'Sécurité',
      password: 'Mot de passe',
      passwordDesc: 'Modifier votre mot de passe',
      privacy: 'Confidentialité',
      privacyDesc: 'Données personnelles',
      phone: 'Numéro de téléphone',
      notProvided: 'Non renseigné',
      about: 'À propos',
      support: 'Support',
      version: 'Version',
      terms: 'Conditions d\'utilisation',
      privacyPolicy: 'Politique de confidentialité',
      logout: 'Se déconnecter',
    },
    languageModal: {
      title: 'Langue',
      select: 'Sélectionnez votre langue',
      french: 'Français',
      english: 'English',
      save: 'Enregistrer',
    },
    changePasswordModal: {
      title: 'Changer de mot de passe',
      oldPassword: 'Ancien mot de passe',
      newPassword: 'Nouveau mot de passe',
      cancel: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      success: 'Mot de passe mis à jour avec succès !',
      error: 'Ancien mot de passe incorrect',
      required: 'Requis',
    },
    privacyModal: {
      title: 'Confidentialité',
      isPublic: 'Profil public',
      isPublicDesc: 'Permettre aux autres de trouver votre profil dans la recherche.',
      cancel: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
    },
    editPhoneModal: {
      title: 'Numéro de téléphone',
      number: 'Votre numéro',
      cancel: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      success: 'Numéro mis à jour',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en,
      fr
    },
    lng: 'fr', // default language
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
