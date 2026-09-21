import type { MessageKey } from './en';

/**
 * Nepali UI catalog (informal तिमी register where second person appears).
 * Secondary surfaces only for this slice.
 */
export const ne: Record<MessageKey, string> = {
  'common.cancel': 'रद्द',
  'common.clear': 'मेटाउनुहोस्',
  'common.delete': 'मेटाउनुहोस्',
  'common.edit': 'सम्पादन',
  'common.retry': 'फेरि प्रयास',
  'common.offline': 'तिमी अफलाइन छौ',
  'common.offlineDetail':
    'यस यन्त्रमा अनुवाद अझै चल्छ। सिंक र पुरस्कारका लागि नेटवर्क चाहिन्छ।',
  'common.loading': 'लोड हुँदै…',
  'common.error': 'केही गडबड भयो',
  'common.empty': 'अहिले केही छैन',

  'history.title': 'इतिहास',
  'history.close': 'इतिहास बन्द गर्नुहोस्',
  'history.clear': 'मेटाउनुहोस्',
  'history.clearA11y': 'इतिहास मेटाउनुहोस्',
  'history.clearConfirmTitle': 'इतिहास मेटाउने?',
  'history.clearConfirmBody': 'यस यन्त्रबाट सबै अनुवाद हटाउने?',
  'history.emptyTitle': 'अहिलेसम्म अनुवाद छैन',
  'history.emptyDetail': 'तिमीले गरेका अनुवाद यहाँ देखिन्छन्।',
  'history.deleteA11y': 'इतिहासबाट मेटाउनुहोस्',
  'history.submitted': 'पठाइयो',
  'history.toTraining': 'तालिममा',
  'history.submittedA11y': 'तालिम डाटामा पहिल्यै छ',
  'history.toTrainingA11y': 'तालिमका लागि सुधार सुझाउनुहोस्',

  'settings.title': 'सेटिङ',
  'settings.contributions': 'योगदान र पुरस्कार',
  'settings.contributionsDetail':
    'यस यन्त्रमा मस्यौदा, सिंक अवस्था, र पुनः अपलोड हेर्नुहोस्।',
  'settings.contributionsA11y': 'योगदान र पुरस्कार खोल्नुहोस्',
  'settings.adsPrivacy': 'विज्ञापन र गोपनीयता',
  'settings.privacyOptions': 'गोपनीयता विकल्पहरू',
  'settings.privacyOptionsA11y': 'विज्ञापन गोपनीयता विकल्पहरू',
  'settings.reportAd': 'अनुपयुक्त विज्ञापन रिपोर्ट गर्नुहोस्',
  'settings.reportAdA11y': 'अनुपयुक्त विज्ञापन रिपोर्ट गर्नुहोस्',
  'settings.reportAdFallbackTitle': 'विज्ञापन रिपोर्ट',
  'settings.reportAdFallbackBody':
    'विषयमा “Inappropriate ad report” लेखेर support@neptranslate.app मा इमेल पठाउनुहोस्।',
  'settings.quality': 'अनुवाद गुणस्तर',
  'settings.qualityBody':
    'अनुवाद अपूर्ण हुन सक्छ। नतिजामा Mark incorrect थिचेर राम्रो अनुवाद सुझाउन सकिन्छ।',
  'settings.privacy': 'गोपनीयता',
  'settings.privacyBody':
    'क्यामेरा अनुवाद यस यन्त्रमै चल्छ। तस्बिर अस्थायी हुन् र फोटो लाइब्रेरीमा बचत हुँदैनन्।',
  'settings.about': 'बारेमा',
  'settings.aboutReady':
    'NepTranslate ले यस यन्त्रमै IndicTrans2 चलाएर अंग्रेजी ↔ नेपाली अनुवाद गर्छ। मोडेल स्थापनासँगै आउँछ — अनुवादका लागि नेटवर्क चाहिँदैन। बोली Apple ले चिन्छ र नेटवर्क चाहिन सक्छ।',
  'settings.aboutPending':
    'NepTranslate मा अंग्रेजी ↔ नेपाली मोडेल स्थापनासँगै आउँछन्। लोड नसकिए पनि सुरक्षित यात्री वाक्य काम गर्छन्। बोली Apple ले चिन्छ र नेटवर्क चाहिन सक्छ।',
  'settings.modelReady': 'मोडेल तयार',
  'settings.modelPending': 'मोडेल पर्खँदै',
  'settings.consentCurrent': 'सहमति अद्यावधिक',
  'settings.speech': 'यस यन्त्रमा बोली',
  'settings.speechEn': 'अंग्रेजी आवाज इनपुट · उपलब्ध',
  'settings.speechNeAvailable': 'नेपाली आवाज इनपुट · उपलब्ध',
  'settings.speechNeUnavailable': 'नेपाली आवाज इनपुट · यस यन्त्रले समर्थन गर्दैन',
  'settings.ttsNeAvailable': 'नेपाली बोली सुनाइ · उपलब्ध',
  'settings.ttsNeUnavailable': 'नेपाली बोली सुनाइ · नेपाली आवाज छैन',
  'settings.speechNote':
    'iPhone मा नेपाली बोली सेवा आउँदैन। टाइप र पढ्ने अनुवाद अफलाइन पूर्ण काम गर्छ।',
  'settings.checking': 'जाँच हुँदै…',
  'settings.consentNotSavedTitle': 'सहमति सुरक्षित भएन',
  'settings.consentNotSavedBody':
    'योगदान सहमति रेकर्ड भएन। यस यन्त्रको अनुवाद उस्तै छ।',
  'settings.offlineBanner':
    'खाता र सिंकका लागि नेटवर्क चाहिन्छ। अनुवाद र सिकाइ अफलाइन उपलब्ध छन्।',

  'learn.earnRewardsA11y': 'पुरस्कार कमाउनुहोस्',
  'learn.noVoiceTitle': 'नेपाली आवाज छैन',
  'learn.noVoiceDetail':
    'तिमी अक्षर अफलाइन सिक्न सक्छौ। सुनाइका लागि यस iPhone मा नेपाली आवाज चाहिन्छ।',
  'learn.offlineOk': 'अक्षर पाठ पूर्ण अफलाइन चल्छ — लगइन चाहिँदैन।',

  'contributions.title': 'योगदान र पुरस्कार',
  'contributions.emptyTitle': 'अहिलेसम्म योगदान छैन',
  'contributions.emptyDetail':
    'अनुवाद गलत चिन्ह लगाउनुहोस् वा तालिममा पठाएर मस्यौदा बचत गर्नुहोस्।',
  'contributions.onDevice': 'यस यन्त्रमा',
  'contributions.count.draft': 'मस्यौदा',
  'contributions.count.waitingToSync': 'सिंक पर्खँदै',
  'contributions.count.pendingValidation': 'प्रमाणीकरण पर्खँदै',
  'contributions.count.validated': 'प्रमाणित',
  'contributions.count.rejected': 'अस्वीकृत',
  'contributions.count.needsAttention': 'ध्यान चाहिन्छ',
  'contributions.status.draft': 'मस्यौदा',
  'contributions.status.queued': 'सिंक पर्खँदै',
  'contributions.status.syncing': 'सिंक हुँदै',
  'contributions.status.retry': 'फेरि प्रयास चाहिन्छ',
  'contributions.status.synced': 'प्रमाणीकरण पर्खँदै',
  'contributions.status.rejected': 'अस्वीकृत',
  'contributions.deleteTitle': 'योगदान मेटाउने?',
  'contributions.deleteBody':
    'यस यन्त्रबाट यो मस्यौदा हटाउने? केही अपलोड हुँदैन।',
  'contributions.editA11y': 'योगदान सम्पादन',
  'contributions.retryA11y': 'योगदान फेरि प्रयास',
  'contributions.deleteA11y': 'योगदान मेटाउनुहोस्',
  'contributions.offlineBanner':
    'तिमी अफलाइन छौ। मस्यौदा यन्त्रमै रहन्छ; अनलाइन हुँदा सिंक फेरि सुरु हुन्छ।',
};
