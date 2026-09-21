/** English UI catalog — secondary surfaces (History, Settings, Learn, Contributions). */
export const en = {
  'common.cancel': 'Cancel',
  'common.clear': 'Clear',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.retry': 'Retry',
  'common.offline': 'You are offline',
  'common.offlineDetail':
    'Core translation still works on this device. Sync and rewards need a network.',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong',
  'common.empty': 'Nothing here yet',

  'history.title': 'History',
  'history.close': 'Close history',
  'history.clear': 'Clear',
  'history.clearA11y': 'Clear history',
  'history.clearConfirmTitle': 'Clear history',
  'history.clearConfirmBody': 'Remove all translations from this device?',
  'history.emptyTitle': 'No translations yet',
  'history.emptyDetail': 'Translations you make will show up here.',
  'history.deleteA11y': 'Delete from history',
  'history.submitted': 'Submitted',
  'history.toTraining': 'To training',
  'history.submittedA11y': 'Already in training data',
  'history.toTrainingA11y': 'Suggest correction for training',

  'settings.title': 'Settings',
  'settings.contributions': 'Contributions & rewards',
  'settings.contributionsDetail':
    'View drafts, sync status, and retry uploads on this device.',
  'settings.contributionsA11y': 'Open contributions and rewards',
  'settings.adsPrivacy': 'Ads & privacy',
  'settings.privacyOptions': 'Privacy options',
  'settings.privacyOptionsA11y': 'Ad privacy options',
  'settings.reportAd': 'Report an inappropriate ad',
  'settings.reportAdA11y': 'Report an inappropriate ad',
  'settings.reportAdFallbackTitle': 'Report an ad',
  'settings.reportAdFallbackBody':
    'Email support@neptranslate.app with “Inappropriate ad report” in the subject.',
  'settings.quality': 'Translation quality',
  'settings.qualityBody':
    'Translation may be imperfect. On a result, tap Mark incorrect to suggest a better translation.',
  'settings.privacy': 'Privacy',
  'settings.privacyBody':
    'Camera translation runs on this device. Captures are temporary and are not saved to your photo library.',
  'settings.about': 'About',
  'settings.aboutReady':
    'NepTranslate runs IndicTrans2 on this device for free-form translation in both directions (English ↔ Nepali). Models ship in the install — no network needed for translation. Speech uses Apple recognition and may need a network.',
  'settings.aboutPending':
    'NepTranslate includes on-device English ↔ Nepali models in the install. If they have not finished loading, saved traveler phrases still work. Speech uses Apple recognition and may need a network.',
  'settings.modelReady': 'model ready',
  'settings.modelPending': 'model pending',
  'settings.consentCurrent': 'Consent current',
  'settings.speech': 'Speech on this device',
  'settings.speechEn': 'English voice input · available',
  'settings.speechNeAvailable': 'Nepali voice input · available',
  'settings.speechNeUnavailable': 'Nepali voice input · not supported by this device',
  'settings.ttsNeAvailable': 'Nepali spoken aloud · available',
  'settings.ttsNeUnavailable': 'Nepali spoken aloud · no Nepali voice installed',
  'settings.speechNote':
    "iPhones don't ship Nepali speech services. Typing and reading translations work fully offline.",
  'settings.checking': 'Checking…',
  'settings.consentNotSavedTitle': 'Consent not saved',
  'settings.consentNotSavedBody':
    'Contribution consent was not recorded. Translation on this device is unchanged.',
  'settings.offlineBanner':
    'Optional account and sync features need a network. Translation and Learn stay available offline.',

  'learn.earnRewardsA11y': 'Earn rewards',
  'learn.noVoiceTitle': 'Nepali voice not installed',
  'learn.noVoiceDetail':
    'You can still learn the alphabet offline. Spoken audio needs a Nepali voice on this iPhone.',
  'learn.offlineOk': 'Alphabet lessons work fully offline — no login required.',

  'contributions.title': 'Contributions & rewards',
  'contributions.emptyTitle': 'No contributions yet',
  'contributions.emptyDetail':
    'Mark a translation incorrect or use To training to save a draft.',
  'contributions.onDevice': 'On this device',
  'contributions.count.draft': 'Draft',
  'contributions.count.waitingToSync': 'Waiting to sync',
  'contributions.count.pendingValidation': 'Pending validation',
  'contributions.count.validated': 'Validated',
  'contributions.count.rejected': 'Rejected',
  'contributions.count.needsAttention': 'Needs attention',
  'contributions.status.draft': 'Draft',
  'contributions.status.queued': 'Waiting to sync',
  'contributions.status.syncing': 'Syncing',
  'contributions.status.retry': 'Needs retry',
  'contributions.status.synced': 'Pending validation',
  'contributions.status.rejected': 'Rejected',
  'contributions.deleteTitle': 'Delete contribution',
  'contributions.deleteBody':
    'Remove this draft from this device? Nothing is uploaded.',
  'contributions.editA11y': 'Edit contribution',
  'contributions.retryA11y': 'Retry contribution',
  'contributions.deleteA11y': 'Delete contribution',
  'contributions.offlineBanner':
    'You are offline. Drafts stay on this device; sync resumes when you are back online.',
} as const;

export type MessageKey = keyof typeof en;
