/**
 * i18n/translations.ts
 *
 * Çeviri sözlüğü. Yeni dil eklemek için:
 * 1. Language tipine yeni kodu ekle (örn. 'de')
 * 2. translations objesine yeni dil bloğunu ekle
 * 3. LANGUAGE_META'ya görünen ad + bayrak ekle
 *
 * Henüz çevrilmemiş anahtarlar otomatik olarak İngilizce'ye düşer (fallback).
 */

export type Language = 'tr' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['tr', 'en'];

export const LANGUAGE_META: Record<Language, { label: string; flag: string }> = {
  tr: { label: 'Türkçe',  flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
};

export type TranslationKey =
  // Genel
  | 'common.cancel' | 'common.save' | 'common.delete' | 'common.back' | 'common.ok'
  | 'common.loading' | 'common.error' | 'common.retry' | 'common.connecting'

  // StartScreen
  | 'start.eyebrow' | 'start.titleMain' | 'start.titleDesc'
  | 'start.primaryLabel' | 'start.primaryButton' | 'start.primaryDesc'
  | 'start.secondaryLabel' | 'start.secondaryButton' | 'start.secondaryDesc'
  | 'start.secondaryDisabledDesc' | 'start.secondaryDisabledHighlight'
  | 'start.infoTitle' | 'start.infoStep1' | 'start.infoStep2' | 'start.infoStep3'
  | 'start.footerBrand'

  // OnboardingScreen — slayt 1: welcome
  | 'onboarding.welcome.eyebrow' | 'onboarding.welcome.title' | 'onboarding.welcome.desc'
  // slayt 2: hardware
  | 'onboarding.hardware.eyebrow' | 'onboarding.hardware.title' | 'onboarding.hardware.desc'
  | 'onboarding.hardware.step1' | 'onboarding.hardware.step2pre' | 'onboarding.hardware.step2highlight'
  | 'onboarding.hardware.step3' | 'onboarding.hardware.note'
  // slayt 3: setup
  | 'onboarding.setup.eyebrow' | 'onboarding.setup.title' | 'onboarding.setup.desc'
  | 'onboarding.setup.step1pre' | 'onboarding.setup.step1highlight' | 'onboarding.setup.step1desc'
  | 'onboarding.setup.step2pre' | 'onboarding.setup.step2highlight' | 'onboarding.setup.step2desc'
  | 'onboarding.setup.note'
  // slayt 4: ready
  | 'onboarding.ready.eyebrow' | 'onboarding.ready.title' | 'onboarding.ready.desc'
  | 'onboarding.ready.feature1' | 'onboarding.ready.feature2'
  | 'onboarding.ready.feature3' | 'onboarding.ready.feature4'
  // navigasyon
  | 'onboarding.skip' | 'onboarding.next' | 'onboarding.start'

  // SetupScreen
  | 'setup.title' | 'setup.connecting' | 'setup.connected' | 'setup.notConnected'
  | 'setup.wifiLabel' | 'setup.wifiPlaceholder' | 'setup.passwordLabel' | 'setup.passwordPlaceholder'
  | 'setup.pinLabel' | 'setup.pinOptional' | 'setup.pinPlaceholder'
  | 'setup.scanNetworks' | 'setup.connectButton' | 'setup.connectingButton'
  | 'setup.subtitle'
  | 'setup.connCardSearching' | 'setup.connCardSearchingSub'
  | 'setup.connCardConnected' | 'setup.connCardConnectedSub'
  | 'setup.connCardDisconnected' | 'setup.connCardDisconnectedSub'
  | 'setup.connStep1' | 'setup.connStep2' | 'setup.connStep3'
  | 'setup.wifiSectionLabel' | 'setup.wifiRescan' | 'setup.wifiScanning'
  | 'setup.wifiScanningNetworks' | 'setup.wifiNotConnectedInfo'
  | 'setup.wifiDropdownFound' | 'setup.wifiSelected'
  | 'setup.wifiManualToggleOn' | 'setup.wifiManualToggleOff'
  | 'setup.wifiManualLabel' | 'setup.wifiManualPlaceholder'
  | 'setup.passwordSectionLabel' | 'setup.passwordSecurePlaceholder'
  | 'setup.pinSectionTitle' | 'setup.pinSectionDesc'
  | 'setup.pinFieldLabel' | 'setup.pinFieldPlaceholder'
  | 'setup.pinConfirmLabel' | 'setup.pinConfirmPlaceholder'
  | 'setup.pinNoteSet' | 'setup.pinNoteEmpty'
  | 'setup.connectingStatus' | 'setup.completeButton'
  | 'setup.footerLabel'
  | 'setup.signalExcellent' | 'setup.signalGood' | 'setup.signalFair'
  | 'setup.signalWeak' | 'setup.signalVeryWeak'
  | 'setup.pinErrorTooShort' | 'setup.pinErrorTooLong'
  | 'setup.pinErrorNotDigits' | 'setup.pinErrorMismatch'
  | 'setup.statusEmptySsid' | 'setup.statusConnecting'
  | 'setup.statusSaved' | 'setup.statusError'
  | 'setup.wifiScanEmpty' | 'setup.wifiScanFailed'

  // ScanScreen
  | 'scan.title' | 'scan.scanning' | 'scan.found' | 'scan.notFound'
  | 'scan.scanButton' | 'scan.connectingTitle' | 'scan.connectingDesc' | 'scan.skipWait'
  | 'scan.addDevice' | 'scan.deviceName' | 'scan.pinRequired'
  | 'scan.typeWs2812b' | 'scan.typeSingleLed' | 'scan.typeRelay' | 'scan.typeUnknown'
  | 'scan.alreadyRegisteredTitle' | 'scan.alreadyRegisteredDesc'
  | 'scan.connectButton' | 'scan.titleDesc'
  | 'scan.wifiWarning1' | 'scan.wifiWarning2'
  | 'scan.scanningLabel' | 'scan.foundLabel' | 'scan.deviceFoundCount'
  | 'scan.pinBadge' | 'scan.newDeviceHint'
  | 'scan.emptyTitle' | 'scan.emptyDesc'
  | 'scan.selectedDeviceLabel' | 'scan.deviceNameFieldLabel' | 'scan.deviceNamePlaceholder'
  | 'scan.pinFieldLabel' | 'scan.pinPlaceholderRequired' | 'scan.pinPlaceholderOptional'
  | 'scan.pinNoteRequired' | 'scan.pinNoteOptional'
  | 'scan.saveButton' | 'scan.savingButton' | 'scan.backToList'
  | 'scan.actionDivider' | 'scan.rescanLabel' | 'scan.scanLabel'
  | 'scan.scanningButton' | 'scan.rescanButton' | 'scan.scanNowButton'
  | 'scan.pinErrorShort' | 'scan.secondsUnit'

  // DeviceListScreen
  | 'deviceList.title' | 'deviceList.count' | 'deviceList.hint'
  | 'deviceList.addButton' | 'deviceList.newSetup' | 'deviceList.scanNetwork'
  | 'deviceList.reset' | 'deviceList.resetConfirm' | 'deviceList.update'
  | 'deviceList.rename' | 'deviceList.deleteConfirm'
  | 'deviceList.removeTitle' | 'deviceList.removeDesc' | 'deviceList.removeButton'
  | 'deviceList.factoryResetTitle' | 'deviceList.factoryResetDesc'
  | 'deviceList.factoryResetButton' | 'deviceList.resetDoneTitle' | 'deviceList.resetDoneDesc'
  | 'deviceList.serverError' | 'deviceList.unreachableTitle' | 'deviceList.unreachableDesc'
  | 'deviceList.removeOnlyButton'
  | 'deviceList.otaUnreachable'
  | 'deviceList.otaUpdateTitle' | 'deviceList.otaUpdateDesc' | 'deviceList.otaUpdateDuration'
  | 'deviceList.otaUpdateButton' | 'deviceList.otaStartedTitle' | 'deviceList.otaStartedDesc'
  | 'deviceList.otaStartFailed'
  | 'deviceList.editButton'
  | 'deviceList.otaCheckButton' | 'deviceList.otaUpToDate'
  | 'deviceList.otaChecking' | 'deviceList.otaUpdating'
  | 'deviceList.otaConnectionError' | 'deviceList.otaNewVersionLabel'
  | 'deviceList.otaUpdateNowButton' | 'deviceList.otaUpToDateLabel'
  | 'deviceList.headerBrand' | 'deviceList.addPrompt'
  | 'deviceList.emptyTitle' | 'deviceList.emptyDesc'
  | 'deviceList.physicalResetTitle' | 'deviceList.physicalResetDesc'
  | 'deviceList.relayType' | 'deviceList.currentVersionLabel'
  | 'deviceList.saveButton' | 'deviceList.resettingLabel' | 'deviceList.removeShortButton'
  | 'deviceList.resetShortButton' | 'deviceList.addDeviceTitle'
  | 'deviceList.footerBrand'

  // ControlScreen
  | 'control.activeDevice' | 'control.offline' | 'control.connection'
  | 'control.brightness' | 'control.color' | 'control.scenes' | 'control.automation'
  | 'control.sleepMode' | 'control.sleepActive' | 'control.sleepMinutes'
  | 'control.sleepStart' | 'control.sleepStarting' | 'control.sleepCancel'
  | 'control.dailyRule' | 'control.countdownRule' | 'control.timeLabel'
  | 'control.speedVerySlow' | 'control.speedSlow' | 'control.speedFast' | 'control.speedVeryFast'
  | 'control.errorOffline' | 'control.errorConnection' | 'control.errorPresetFailed'
  | 'control.cancel' | 'control.deleteRuleTitle' | 'control.deleteRuleConfirm'
  | 'control.errorSleepFailed'
  | 'control.willApplyOnTurnOn'
  | 'control.staticLabel'
  | 'control.loading' | 'control.noRulesYet'
  | 'control.ruleDaily' | 'control.ruleOnce' | 'control.ruleOn' | 'control.ruleOff'
  | 'control.deleteButton'
  | 'control.fadeActiveTitle' | 'control.fadeCancelButton'
  | 'control.fadeTimeRemaining' | 'control.fadeCalculating'
  | 'control.sleepModeButton'
  | 'control.sleepModeDesc'
  | 'control.minutesLabel'
  | 'control.dailyTimerTitle' | 'control.countdownTitle'
  | 'control.turnOnLabel'
  | 'control.savingButton' | 'control.saveButton'
  | 'control.stripLabel'
  | 'control.pinErrorWrong' | 'control.pinErrorConnection'
  | 'control.singleChannel' | 'control.multiChannel'
  | 'control.singleLed' | 'control.relay'
  | 'control.modelOn' | 'control.modelOff'
  | 'control.dragRotateMulti' | 'control.dragRotateSingle' | 'control.speedLabel'
  | 'control.deletePresetTitle' | 'control.effectsLabel' | 'control.applyButton'
  | 'control.activeStatusLabel'
  // Efekt isimleri ve açıklamaları
  | 'effect.rainbow.label' | 'effect.rainbow.desc'
  | 'effect.breathe.label' | 'effect.breathe.desc'
  | 'effect.wave.label' | 'effect.wave.desc'
  | 'effect.fire.label' | 'effect.fire.desc'
  | 'effect.meteor.label' | 'effect.meteor.desc'
  | 'effect.twinkle.label' | 'effect.twinkle.desc'
  | 'effect.strobe.label' | 'effect.strobe.desc'
  | 'effect.comet.label' | 'effect.comet.desc'
  | 'effect.theater.label' | 'effect.theater.desc'
  | 'effect.pulse.label' | 'effect.pulse.desc'
  | 'effect.colorCycle.label' | 'effect.colorCycle.desc'
  | 'effect.gradient.label' | 'effect.gradient.desc'
  | 'effect.wipe.label' | 'effect.wipe.desc'
  | 'effect.bouncing.label' | 'effect.bouncing.desc'
  | 'effect.scanner.label' | 'effect.scanner.desc'
  | 'effect.chase.label' | 'effect.chase.desc'
  | 'effect.ripple.label' | 'effect.ripple.desc'
  | 'effect.sparkle.label' | 'effect.sparkle.desc'
  | 'effect.noise.label' | 'effect.noise.desc'
  | 'effect.larsonScanner.label' | 'effect.larsonScanner.desc'
  | 'effect.confetti.label' | 'effect.confetti.desc'
  | 'effect.juggle.label' | 'effect.juggle.desc'
  | 'effect.bpm.label' | 'effect.bpm.desc'
  // Statik renk presetleri
  | 'preset.white' | 'preset.warm' | 'preset.night'
  | 'preset.focus' | 'preset.red' | 'preset.green'
  | 'presets.brightnessSuffix' | 'presets.headerTitle' | 'presets.headerHint'
  | 'presets.saveCurrentTitle' | 'presets.toSaveLabel'
  | 'presets.iconLabel' | 'presets.namePlaceholder'
  | 'presets.staticScenesLabel' | 'presets.longPressHint'
  | 'presets.dynamicEffectsLabel'

  // Settings / Dil
  | 'settings.language' | 'settings.selectLanguage';

export const translations: Record<Language, Partial<Record<TranslationKey, string>>> = {
  tr: {
    'common.cancel':    'İptal',
    'common.save':      'Kaydet',
    'common.delete':    'Sil',
    'common.back':      'Geri',
    'common.ok':        'Tamam',
    'common.loading':   'Yükleniyor...',
    'common.error':     'Bir hata oluştu',
    'common.retry':     'Tekrar Dene',
    'common.connecting':'Bağlanıyor...',

    'start.eyebrow':                    '// HOŞ GELDİN',
    'start.titleMain':                  'Smart\nLight',
    'start.titleDesc':                  'ESP32 tabanlı LED cihazlarını WiFi üzerinden kontrol et.',
    'start.primaryLabel':                'İLK KURULUM',
    'start.primaryButton':               '[ Kurulum Başlat ]',
    'start.primaryDesc':                 "ESP32'yi ilk kez WiFi'a bağlıyorsan buradan başla",
    'start.secondaryLabel':              'AĞ TARAMA',
    'start.secondaryButton':             '[ Cihaz Ara ]',
    'start.secondaryDesc':               "ESP32 daha önce WiFi'a bağlandıysa ağı tara ve cihazı bul",
    'start.secondaryDisabledDesc':       "Önce ESP32'yi WiFi'a bağlamak için",
    'start.secondaryDisabledHighlight':  '"Kurulum Başlat" adımını tamamla',
    'start.infoTitle':                   'Nasıl çalışır?',
    'start.infoStep1':                   "ESP32'yi güce bağla → ESP32-Setup ağı görünür",
    'start.infoStep2':                   "\"Kurulum Başlat\" ile ESP32'yi ev WiFi'ına bağla",
    'start.infoStep3':                   "Kendi WiFi ağına geç → \"Cihaz Ara\" ile cihazı bul",
    'start.footerBrand':                 'Smart Craft · IoT',

    'onboarding.welcome.eyebrow': '// HOŞ GELDİN',
    'onboarding.welcome.title':   'Akıllı Işık\nKontrolü',
    'onboarding.welcome.desc':
      'Torva Smart Light ile ESP32 tabanlı LED şeritlerini ve ' +
      'ampullerini telefonundan yönet. Renk, parlaklık, zamanlayıcı ' +
      've efektler tek uygulamada.',

    'onboarding.hardware.eyebrow':        '// DONANIM',
    'onboarding.hardware.title':          "ESP32'ni\nHazırla",
    'onboarding.hardware.desc':           "Başlamadan önce ESP32 cihazının hazır olduğundan emin ol.",
    'onboarding.hardware.step1':          "ESP32'yi güç kaynağına bağla",
    'onboarding.hardware.step2pre':       'Eğer daha önce WiFi kurulmadıysa ',
    'onboarding.hardware.step2highlight': 'ESP32-Setup',
    'onboarding.hardware.step3':          'adlı WiFi ağı görünür — bu normal, kurulum adımında bu ağa bağlanacaksın',
    'onboarding.hardware.note':           "Daha önce kurulum yaptıysan ESP32 doğrudan ev WiFi'ına bağlanır.",

    'onboarding.setup.eyebrow':        '// KURULUM',
    'onboarding.setup.title':          'İki Yol\nVar',
    'onboarding.setup.desc':           'Cihazına göre doğru yolu seç:',
    'onboarding.setup.step1pre':       'İlk kez kuruyorsan: ',
    'onboarding.setup.step1highlight': 'Kurulum Başlat',
    'onboarding.setup.step1desc':      "ESP32'yi ev WiFi'ına tanıtmak için gerekli. Bir kez yapılır.",
    'onboarding.setup.step2pre':       'Daha önce kurulduysa: ',
    'onboarding.setup.step2highlight': 'Cihaz Ara',
    'onboarding.setup.step2desc':      'Uygulama ağı otomatik tarar ve cihazı bulur.',
    'onboarding.setup.note':           'Emin değilsen "Cihaz Ara" ile başla — cihaz bulunamazsa kuruluma geç.',

    'onboarding.ready.eyebrow':  '// HAZIR',
    'onboarding.ready.title':    'Her Şey\nHazır!',
    'onboarding.ready.desc':     'Artık ışıklarını kontrol etmeye başlayabilirsin.',
    'onboarding.ready.feature1': 'Renk ve parlaklık kontrolü',
    'onboarding.ready.feature2': 'Zamanlayıcı ve otomasyon kuralları',
    'onboarding.ready.feature3': 'Efekt ve sahne presetleri',
    'onboarding.ready.feature4': 'Birden fazla cihaz yönetimi',

    'onboarding.skip':  'ATLA',
    'onboarding.next':  'İleri',
    'onboarding.start': 'Başlayalım',

    'setup.title':              '// KURULUM',
    'setup.connecting':         'Bağlanıyor...',
    'setup.connected':          'ESP32 bağlı',
    'setup.notConnected':       'ESP32-Setup ağına bağlanın',
    'setup.wifiLabel':          'WiFi Ağı',
    'setup.wifiPlaceholder':    'Ağ adı seçin',
    'setup.passwordLabel':      'WiFi Şifresi',
    'setup.passwordPlaceholder':'Şifre girin',
    'setup.pinLabel':           'PIN Kodu',
    'setup.pinOptional':        'opsiyonel',
    'setup.pinPlaceholder':     'En az 4 haneli',
    'setup.scanNetworks':       'Ağları Tara',
    'setup.connectButton':      '[ Kurulumu Tamamla ]',
    'setup.connectingButton':   '[ Bağlanıyor... ]',
    'setup.subtitle':                  'ESP32 Wi-Fi Yapılandırması',
    'setup.connCardSearching':         'ESP32 aranıyor...',
    'setup.connCardSearchingSub':      '192.168.4.1 kontrol ediliyor',
    'setup.connCardConnected':         "ESP32-Setup'a bağlısın ✓",
    'setup.connCardConnectedSub':      'WiFi ağlarını tarayabilir ve kurulumu tamamlayabilirsin',
    'setup.connCardDisconnected':      'ESP32-Setup ağına bağlı değilsin',
    'setup.connCardDisconnectedSub':   'Telefon WiFi ayarlarından ESP32-Setup ağını seç',
    'setup.connStep1':                 'Telefon WiFi ayarlarını aç',
    'setup.connStep2':                 'ağını seç ve bağlan',
    'setup.connStep3':                 'Bu uygulamaya geri dön — bağlantı otomatik algılanacak',
    'setup.wifiSectionLabel':          'WiFi AĞINI SEÇ',
    'setup.wifiRescan':                '↺ Yenile',
    'setup.wifiScanning':              'Taranıyor...',
    'setup.wifiScanningNetworks':      'ESP32 ağları tarıyor...',
    'setup.wifiNotConnectedInfo':      'ESP32-Setup ağına bağlandıktan sonra ağ listesi otomatik yüklenir.',
    'setup.wifiDropdownFound':         'ağ bulundu — seçmek için bas',
    'setup.wifiSelected':              'SEÇİLEN:',
    'setup.wifiManualToggleOn':        '▲ Listeden seç',
    'setup.wifiManualToggleOff':       '✎ Ağ adını elle gir',
    'setup.wifiManualLabel':           'WiFi ADI (SSID)',
    'setup.wifiManualPlaceholder':     'ağ adını gir',
    'setup.passwordSectionLabel':      'ŞİFRE',
    'setup.passwordSecurePlaceholder': '••••••••',
    'setup.pinSectionTitle':           "// GÜVENLİK PIN'İ (OPSİYONEL)",
    'setup.pinSectionDesc':            "4-6 haneli bir PIN belirleyebilirsin. PIN belirlerseniz aynı ağdaki başkalarının cihazına erişmesi engellenir. Boş bırakırsan PIN koruması olmaz.",
    'setup.pinFieldLabel':             'PIN (4-6 HANE) — OPSİYONEL',
    'setup.pinFieldPlaceholder':       'boş bırakabilirsin',
    'setup.pinConfirmLabel':           'PIN TEKRAR',
    'setup.pinConfirmPlaceholder':     "PIN'i tekrar gir",
    'setup.pinNoteSet':                "📌 PIN'ini not et — cihaz sıfırlanırsa yeniden belirlenir.",
    'setup.pinNoteEmpty':              'ℹ️  PIN belirlemeden devam edebilirsin. Dilediğin zaman cihazı sıfırlayıp yeniden kurabilirsin.',
    'setup.connectingStatus':          'BAĞLANIYOR...',
    'setup.completeButton':            'KURULUMU TAMAMLA',
    'setup.footerLabel':               'ESP32 Access Point',
    'setup.signalExcellent': 'Mükemmel',
    'setup.signalGood':      'İyi',
    'setup.signalFair':      'Orta',
    'setup.signalWeak':      'Zayıf',
    'setup.signalVeryWeak':  'Çok Zayıf',
    'setup.pinErrorTooShort':  'PIN en az 4 haneli olmalı',
    'setup.pinErrorTooLong':   'PIN en fazla 6 haneli olmalı',
    'setup.pinErrorNotDigits': 'PIN sadece rakamlardan oluşmalı',
    'setup.pinErrorMismatch':  "PIN'ler eşleşmiyor",
    'setup.statusEmptySsid':   'WiFi ağ adı boş olamaz.',
    'setup.statusConnecting':  "ESP32'ye bağlanıyor...",
    'setup.statusSaved':       'Kaydedildi! ESP32 yeniden başlıyor...',
    'setup.statusError':       "❌ ESP32'ye bağlanılamadı. ESP32-Setup ağına bağlı olduğundan emin ol.",
    'setup.wifiScanEmpty':     'Çevrede ağ bulunamadı. Tekrar dene.',
    'setup.wifiScanFailed':    "Ağ listesi alınamadı.\nESP32-Setup ağına bağlı olduğundan emin ol.",

    'scan.title':           '// AĞDA ARA',
    'scan.scanning':        'Taranıyor...',
    'scan.found':            'cihaz bulundu',
    'scan.notFound':        'Cihaz bulunamadı',
    'scan.scanButton':      '[ Taramayı Başlat ]',
    'scan.connectingTitle': 'ESP32 BAĞLANIYOR',
    'scan.connectingDesc':  'Cihaz yeni ağa bağlanıyor, lütfen bekleyin...',
    'scan.skipWait':        '[ Hemen Ara ]',
    'scan.addDevice':       'Cihazı Ekle',
    'scan.deviceName':      'Cihaz Adı',
    'scan.pinRequired':     'PIN gerekli',
    'scan.typeWs2812b':              'RGB Şerit',
    'scan.typeSingleLed':            'Tek LED / Ampul',
    'scan.typeRelay':                'Röle / Ampul',
    'scan.typeUnknown':              'Bilinmiyor',
    'scan.alreadyRegisteredTitle':   'Cihaz Zaten Kayıtlı',
    'scan.alreadyRegisteredDesc':    'zaten listenizde.\nBu cihaza bağlanmak ister misiniz?',
    'scan.connectButton':            'Bağlan',
    'scan.titleDesc':                'Yerel ağdaki tüm ESP32 cihazları listelenir',
    'scan.wifiWarning1':             "📶 Tarama yapabilmek için ESP32'nin bağlı olduğu ev WiFi ağında olmalısın.",
    'scan.wifiWarning2':             'ESP32-Setup ağında değil, kendi internet ağında olduğundan emin ol.',
    'scan.scanningLabel':            'AĞ TARANIYOR',
    'scan.foundLabel':               'BULUNANLAR',
    'scan.deviceFoundCount':         'CİHAZ BULUNDU',
    'scan.pinBadge':                 '🔒 PIN',
    'scan.newDeviceHint':            'Yeni cihaz — eklemek için bas',
    'scan.emptyTitle':               'Cihaz bulunamadı',
    'scan.emptyDesc':                "ESP32'nin aynı WiFi ağında olduğundan emin ol",
    'scan.selectedDeviceLabel':      'SEÇİLEN CİHAZ',
    'scan.deviceNameFieldLabel':     'CİHAZ ADI',
    'scan.deviceNamePlaceholder':    'örn. Salon Lambası',
    'scan.pinFieldLabel':            "CİHAZ PIN'İ (OPSİYONEL)",
    'scan.pinPlaceholderRequired':   'Kurulumda belirlediğin PIN',
    'scan.pinPlaceholderOptional':   'PIN belirlenmediyse boş bırak',
    'scan.pinNoteRequired':          "🔒 Bu cihaz PIN korumalı. Kurulum sırasında belirlediğin PIN'i gir.",
    'scan.pinNoteOptional':          'ℹ️  PIN belirlenmediyse boş bırakabilirsin.',
    'scan.saveButton':               '[ KAYDET ve BAĞLAN ]',
    'scan.savingButton':             '[ KAYDEDİLİYOR... ]',
    'scan.backToList':               '← Listeye Dön',
    'scan.actionDivider':            'AKSİYON',
    'scan.rescanLabel':              'YENİDEN TARA',
    'scan.scanLabel':                'TARAMA',
    'scan.scanningButton':           '[ Taranıyor... ]',
    'scan.rescanButton':             '[ Tekrar Tara ]',
    'scan.scanNowButton':            '[ Ağda Ara ]',
    'scan.pinErrorShort':            'PIN en az 4 haneli olmalı',
    'scan.secondsUnit':              'sn',

    'deviceList.title':       '// KAYITLI CİHAZLAR',
    'deviceList.count':       'cihaz',
    'deviceList.hint':        'SIFIRLA → ESP32 fabrika ayarlarına döner · GÜNCELLE → Firmware OTA',
    'deviceList.addButton':   '+ EKLE',
    'deviceList.newSetup':    'Yeni Kurulum',
    'deviceList.scanNetwork': 'Ağda Ara',
    'deviceList.reset':       'Sıfırla',
    'deviceList.resetConfirm':'sıfırlansın mı? Bu işlem geri alınamaz.',
    'deviceList.update':      'Güncelle',
    'deviceList.rename':      'Yeniden Adlandır',
    'deviceList.deleteConfirm':'silinsin mi?',
    'deviceList.removeTitle':        'Cihazı Listeden Kaldır',
    'deviceList.removeDesc':         'uygulamadan kaldırılsın mı?\n\nESP32 etkilenmez.',
    'deviceList.removeButton':       'Kaldır',
    'deviceList.factoryResetTitle':  '⚠️ Fabrika Sıfırlama',
    'deviceList.factoryResetDesc':   'cihazı sıfırlanacak.\n\n• WiFi bilgileri silinecek\n• Automation kuralları silinecek\n• Yeniden kurulum gerekecek\n\nBu işlem geri alınamaz.',
    'deviceList.factoryResetButton': 'Sıfırla',
    'deviceList.resetDoneTitle':     'Sıfırlama Tamamlandı',
    'deviceList.resetDoneDesc':      'sıfırlandı. ESP32 "ESP32-Setup" modunda.\n\nYeniden kurmak için Kurulum Başlat\'ı kullan.',
    'deviceList.serverError':        'Server hatası',
    'deviceList.unreachableTitle':   "ESP32'ye Ulaşılamadı",
    'deviceList.unreachableDesc':    'cihazına bağlanılamadı.\n\nSadece uygulamadan kaldırmak ister misin?',
    'deviceList.removeOnlyButton':   'Sadece Listeden Kaldır',
    'deviceList.otaUnreachable':     'Cihaza ulaşılamadı',
    'deviceList.otaUpdateTitle':     'Firmware Güncelle',
    'deviceList.otaUpdateDesc':      'cihazı güncellenecek.\n\n',
    'deviceList.otaUpdateDuration':  'Güncelleme ~30-60 saniye sürer. Bu sürede cihaz yanıt vermez.',
    'deviceList.otaUpdateButton':    'Güncelle',
    'deviceList.otaStartedTitle':    'Güncelleme Başladı',
    'deviceList.otaStartedDesc':     'ESP32 güncelleniyor. ~60 saniye sonra otomatik yeniden başlar.\n\nCihaz yeniden başladıktan sonra "Firmware Kontrol Et" ile yeni sürümü doğrulayabilirsin.',
    'deviceList.otaStartFailed':     'Güncelleme başlatılamadı',
    'deviceList.editButton':         'DÜZENLE',
    'deviceList.otaCheckButton':     '↑ Firmware Kontrol Et',
    'deviceList.otaUpToDate':        '✓ Güncel · Tekrar Kontrol Et',
    'deviceList.otaChecking':        '⏳ Sürüm kontrol ediliyor...',
    'deviceList.otaUpdating':        '⚡ Güncelleme devam ediyor...',
    'deviceList.otaConnectionError': 'Bağlantı hatası',
    'deviceList.otaNewVersionLabel': 'YENİ SÜRÜM',
    'deviceList.otaUpdateNowButton': 'GÜNCELLE',
    'deviceList.otaUpToDateLabel':   'en güncel sürüm',
    'deviceList.headerBrand':        'CİHAZLAR',
    'deviceList.addPrompt':          'Nasıl eklemek istersiniz?',
    'deviceList.emptyTitle':         'Henüz kayıtlı cihaz yok.',
    'deviceList.emptyDesc':          'Sağ üstteki + butonuna bas ve ağı tara.',
    'deviceList.physicalResetTitle': '📌 Fiziksel Reset',
    'deviceList.physicalResetDesc':  "Uygulamaya erişemiyorsan GPIO 0'daki butonu 3 saniye basılı tut → LED sarı → kırmızı → sıfırlanır",
    'deviceList.relayType':          'RÖLE',
    'deviceList.currentVersionLabel':'Mevcut',
    'deviceList.saveButton':         'KAYDET',
    'deviceList.resettingLabel':     'SIFIRLANIYOR...',
    'deviceList.removeShortButton':  'KALDIR',
    'deviceList.resetShortButton':   'SIFIRLA',
    'deviceList.addDeviceTitle':     'Cihaz Ekle',
    'deviceList.footerBrand':        'Smart Craft · IoT',

    'control.activeDevice': 'AKTİF CİHAZ',
    'control.offline':      'OFFLINE',
    'control.connection':   'BAĞLANTI //',
    'control.brightness':   'PARLAKLIK',
    'control.color':        'RENK',
    'control.scenes':       'SAHNELER',
    'control.automation':   'OTOMASYON',
    'control.sleepMode':    'Uyku Modu',
    'control.sleepActive':  'UYKU MODU AKTİF',
    'control.sleepMinutes': 'DAKİKA',
    'control.sleepStart':   '[ BAŞLAT ]',
    'control.sleepStarting':'BAŞLATILIYOR...',
    'control.sleepCancel':  'İPTAL',
    'control.dailyRule':    '+ Günlük',
    'control.countdownRule':'+ Geri Sayım',
    'control.timeLabel':    'SAAT',
    'control.speedVerySlow': 'Çok Yavaş',
    'control.speedSlow':     'Yavaş',
    'control.speedFast':     'Hızlı',
    'control.speedVeryFast': 'Çok Hızlı',
    'control.errorOffline':       'Cihaz çevrimdışı',
    'control.errorConnection':    'Bağlantı hatası',
    'control.errorPresetFailed':  'Preset uygulanamadı',
    'control.cancel':             'İptal',
    'control.deleteRuleTitle':    'Kuralı Sil',
    'control.deleteRuleConfirm':  'silinsin mi?',
    'control.errorSleepFailed':   'Uyku modu başlatılamadı',
    'control.willApplyOnTurnOn':  'açılınca uygulanacak',
    'control.staticLabel':        'STATİK',
    'control.loading':            'Yükleniyor...',
    'control.noRulesYet':         'Henüz kural yok.',
    'control.ruleDaily':          'GÜNLİK',
    'control.ruleOnce':           'TEK',
    'control.ruleOn':             'AÇ',
    'control.ruleOff':            'KAPAT',
    'control.deleteButton':       'SİL',
    'control.fadeActiveTitle':    '🌙 UYKU MODU AKTİF',
    'control.fadeCancelButton':   'İPTAL',
    'control.fadeTimeRemaining':  'dk',
    'control.fadeCalculating':    'Hesaplanıyor...',
    'control.sleepModeButton':    '🌙 Uyku Modu',
    'control.sleepModeDesc':      'Işık seçilen süre içinde yavaşça karararak kapanır.',
    'control.minutesLabel':       'DAKİKA',
    'control.dailyTimerTitle':    '// GÜNLİK ZAMANLAYICI',
    'control.countdownTitle':     '// GERİ SAYIM',
    'control.turnOnLabel':        'AÇ',
    'control.savingButton':       'KAYDEDİLİYOR...',
    'control.saveButton':         '[ KAYDET ]',
    'control.stripLabel':         'Şerit',
    'control.pinErrorWrong':      'PIN hatalı.',
    'control.pinErrorConnection': 'Bağlantı hatası.',
    'control.singleChannel':      'KANAL',
    'control.multiChannel':       'KANAL',
    'control.singleLed':          'TEK LED',
    'control.relay':              'RÖLE',
    'control.modelOn':            'AÇIK',
    'control.modelOff':           'KAPALI',
    'control.dragRotateMulti':    'sürükle · döndür',
    'control.dragRotateSingle':   'bas · aç/kapat  ·  sürükle · döndür',
    'control.speedLabel':         'HIZ',
    'control.deletePresetTitle':  'Preseti Sil',
    'control.effectsLabel':       'EFEKTLER',
    'control.applyButton':        '[ UYGULA ]',
    'control.activeStatusLabel':  'aktif',
    'effect.rainbow.label':       'Gökkuşağı',
    'effect.rainbow.desc':        'Tüm renkler döngüsel geçiş',
    'effect.breathe.label':       'Nefes',
    'effect.breathe.desc':        'Seçili renk yavaşça söner yanar',
    'effect.wave.label':          'Dalga',
    'effect.wave.desc':           'Renk dalgası şeritten geçer',
    'effect.fire.label':          'Ateş',
    'effect.fire.desc':           'Titreşen alev efekti',
    'effect.meteor.label':        'Meteor',
    'effect.meteor.desc':         'Işık topu izi bırakarak geçer',
    'effect.twinkle.label':       'Yıldız',
    'effect.twinkle.desc':        'Rastgele yıldız parlaması',
    'effect.strobe.label':        'Strobe',
    'effect.strobe.desc':         'Hızlı stroboskop flash',
    'effect.comet.label':         'Kuyruklu Y.',
    'effect.comet.desc':          'Kuyruklu yıldız gidip gelir',
    'effect.theater.label':       'Marquee',
    'effect.theater.desc':        'Tiyatro ışıkları — her 3. LED',
    'effect.pulse.label':         'Nabız',
    'effect.pulse.desc':          'Tüm şerit birlikte nabız atar',
    'effect.colorCycle.label':    'Renk Döngüsü',
    'effect.colorCycle.desc':     'Tek renk yavaşça başka renge geçer',
    'effect.gradient.label':      'Gradient',
    'effect.gradient.desc':       'Ucundan ucuna renk geçişi',
    'effect.wipe.label':          'Silme',
    'effect.wipe.desc':           'Renk bir uçtan diğerine süpürür',
    'effect.bouncing.label':      'Sekme',
    'effect.bouncing.desc':       'Işık noktası ileri geri sekip durur',
    'effect.scanner.label':       'Tarama',
    'effect.scanner.desc':        'Knight Rider tarzı sağa sola tarama',
    'effect.chase.label':         'Kovalama',
    'effect.chase.desc':          'Işık noktaları peş peşe koşar',
    'effect.ripple.label':        'Dalgalanma',
    'effect.ripple.desc':         'Ortadan kenarlara dalgalar yayılır',
    'effect.sparkle.label':       'Işıltı',
    'effect.sparkle.desc':        'Rastgele tek piksel anında parlar',
    'effect.noise.label':         'Bulut',
    'effect.noise.desc':          'Organik dalgalanan renk geçişi',
    'effect.larsonScanner.label': 'Larson',
    'effect.larsonScanner.desc':  'Yumuşak ışık topu gidip gelir',
    'effect.confetti.label':      'Konfeti',
    'effect.confetti.desc':       'Rastgele renk patlamaları',
    'effect.juggle.label':        'Jonglör',
    'effect.juggle.desc':         'Farklı hızlarda bağımsız toplar',
    'effect.bpm.label':           'BPM',
    'effect.bpm.desc':            'Ritme senkron nabız atışı',
    'preset.white': 'Beyaz',
    'preset.warm':  'Sıcak',
    'preset.night': 'Gece',
    'preset.focus': 'Odak',
    'preset.red':   'Kırmızı',
    'preset.green': 'Yeşil',
    'presets.brightnessSuffix':  'parlaklık',
    'presets.headerTitle':       'SAHNELER',
    'presets.headerHint':        'Bas → anında uygula · Efekt kartında › → renk & hız ayarla',
    'presets.saveCurrentTitle':  '// MEVCUT RENGİ KAYDET',
    'presets.toSaveLabel':       'KAYDEDİLECEK',
    'presets.iconLabel':         'İKON',
    'presets.namePlaceholder':   'örn. Film Modu',
    'presets.staticScenesLabel': 'STATİK SAHNELER',
    'presets.longPressHint':     'Kişisel sahneyi silmek için uzun bas',
    'presets.dynamicEffectsLabel': 'DİNAMİK EFEKTLER',

    'settings.language':       'Dil',
    'settings.selectLanguage': 'Dil Seçin',
  },
  en: {
    'common.cancel':    'Cancel',
    'common.save':      'Save',
    'common.delete':    'Delete',
    'common.back':      'Back',
    'common.ok':        'OK',
    'common.loading':   'Loading...',
    'common.error':     'Something went wrong',
    'common.retry':     'Retry',
    'common.connecting':'Connecting...',

    'start.eyebrow':                    '// WELCOME',
    'start.titleMain':                  'Smart\nLight',
    'start.titleDesc':                  'Control your ESP32-based LED devices over WiFi.',
    'start.primaryLabel':                'FIRST SETUP',
    'start.primaryButton':               '[ Start Setup ]',
    'start.primaryDesc':                 'If this is your first time connecting your ESP32 to WiFi, start here',
    'start.secondaryLabel':              'NETWORK SCAN',
    'start.secondaryButton':             '[ Find Device ]',
    'start.secondaryDesc':               'If your ESP32 was already connected to WiFi, scan the network to find it',
    'start.secondaryDisabledDesc':       'First connect your ESP32 to WiFi by completing',
    'start.secondaryDisabledHighlight':  'the "Start Setup" step',
    'start.infoTitle':                   'How it works?',
    'start.infoStep1':                   'Power your ESP32 → the ESP32-Setup network appears',
    'start.infoStep2':                   'Use "Start Setup" to connect your ESP32 to your home WiFi',
    'start.infoStep3':                   'Switch to your own WiFi → use "Find Device" to locate it',
    'start.footerBrand':                 'Smart Craft · IoT',

    'onboarding.welcome.eyebrow': '// WELCOME',
    'onboarding.welcome.title':   'Smart Light\nControl',
    'onboarding.welcome.desc':
      'Control your ESP32-based LED strips and bulbs from your phone ' +
      'with Torva Smart Light. Color, brightness, scheduling, ' +
      'and effects all in one app.',

    'onboarding.hardware.eyebrow':        '// HARDWARE',
    'onboarding.hardware.title':          'Prepare Your\nESP32',
    'onboarding.hardware.desc':           'Make sure your ESP32 device is ready before you start.',
    'onboarding.hardware.step1':          'Power up your ESP32',
    'onboarding.hardware.step2pre':       "If WiFi hasn't been set up yet, a network named ",
    'onboarding.hardware.step2highlight': 'ESP32-Setup',
    'onboarding.hardware.step3':          "appears — that's normal, you'll connect to it during setup",
    'onboarding.hardware.note':           'If you set it up before, your ESP32 connects directly to your home WiFi.',

    'onboarding.setup.eyebrow':        '// SETUP',
    'onboarding.setup.title':          'Two Ways\nTo Go',
    'onboarding.setup.desc':           'Choose the right path for your device:',
    'onboarding.setup.step1pre':       "Setting up for the first time? ",
    'onboarding.setup.step1highlight': 'Start Setup',
    'onboarding.setup.step1desc':      "Required to connect your ESP32 to your home WiFi. Done once.",
    'onboarding.setup.step2pre':       'Already set up before? ',
    'onboarding.setup.step2highlight': 'Find Device',
    'onboarding.setup.step2desc':      'The app scans your network automatically and finds your device.',
    'onboarding.setup.note':           'Not sure? Start with "Find Device" — if it\'s not found, move to setup.',

    'onboarding.ready.eyebrow':  '// READY',
    'onboarding.ready.title':    "You're All\nSet!",
    'onboarding.ready.desc':     'You can now start controlling your lights.',
    'onboarding.ready.feature1': 'Color and brightness control',
    'onboarding.ready.feature2': 'Scheduling and automation rules',
    'onboarding.ready.feature3': 'Effect and scene presets',
    'onboarding.ready.feature4': 'Manage multiple devices',

    'onboarding.skip':  'SKIP',
    'onboarding.next':  'Next',
    'onboarding.start': "Let's Go",

    'setup.title':              '// SETUP',
    'setup.connecting':         'Connecting...',
    'setup.connected':          'ESP32 connected',
    'setup.notConnected':       'Connect to the ESP32-Setup network',
    'setup.wifiLabel':          'WiFi Network',
    'setup.wifiPlaceholder':    'Select a network',
    'setup.passwordLabel':      'WiFi Password',
    'setup.passwordPlaceholder':'Enter password',
    'setup.pinLabel':           'PIN Code',
    'setup.pinOptional':        'optional',
    'setup.pinPlaceholder':     'At least 4 digits',
    'setup.scanNetworks':       'Scan Networks',
    'setup.connectButton':      '[ Complete Setup ]',
    'setup.connectingButton':   '[ Connecting... ]',
    'setup.subtitle':                  'ESP32 Wi-Fi Configuration',
    'setup.connCardSearching':         'Searching for ESP32...',
    'setup.connCardSearchingSub':      'Checking 192.168.4.1',
    'setup.connCardConnected':         'Connected to ESP32-Setup ✓',
    'setup.connCardConnectedSub':      'You can scan WiFi networks and complete the setup',
    'setup.connCardDisconnected':      'Not connected to ESP32-Setup network',
    'setup.connCardDisconnectedSub':   'Select the ESP32-Setup network in your phone WiFi settings',
    'setup.connStep1':                 'Open your phone WiFi settings',
    'setup.connStep2':                 'select and connect to the network',
    'setup.connStep3':                 'Return to this app — the connection will be detected automatically',
    'setup.wifiSectionLabel':          'SELECT WIFI NETWORK',
    'setup.wifiRescan':                '↺ Refresh',
    'setup.wifiScanning':              'Scanning...',
    'setup.wifiScanningNetworks':      'Scanning ESP32 networks...',
    'setup.wifiNotConnectedInfo':      'The network list will load automatically once connected to ESP32-Setup.',
    'setup.wifiDropdownFound':         'network(s) found — tap to select',
    'setup.wifiSelected':              'SELECTED:',
    'setup.wifiManualToggleOn':        '▲ Choose from list',
    'setup.wifiManualToggleOff':       '✎ Enter network name manually',
    'setup.wifiManualLabel':           'WIFI NAME (SSID)',
    'setup.wifiManualPlaceholder':     'enter network name',
    'setup.passwordSectionLabel':      'PASSWORD',
    'setup.passwordSecurePlaceholder': '••••••••',
    'setup.pinSectionTitle':           '// SECURITY PIN (OPTIONAL)',
    'setup.pinSectionDesc':            'You can set a 4-6 digit PIN. Setting a PIN prevents others on the same network from accessing your device. Leave blank for no PIN protection.',
    'setup.pinFieldLabel':             'PIN (4-6 DIGITS) — OPTIONAL',
    'setup.pinFieldPlaceholder':       'can be left blank',
    'setup.pinConfirmLabel':           'CONFIRM PIN',
    'setup.pinConfirmPlaceholder':     'enter PIN again',
    'setup.pinNoteSet':                '📌 Remember your PIN — it will be reset if you factory reset the device.',
    'setup.pinNoteEmpty':              "ℹ️  You can continue without setting a PIN. You can always reset and reconfigure the device later.",
    'setup.connectingStatus':          'CONNECTING...',
    'setup.completeButton':            'COMPLETE SETUP',
    'setup.footerLabel':               'ESP32 Access Point',
    'setup.signalExcellent': 'Excellent',
    'setup.signalGood':      'Good',
    'setup.signalFair':      'Fair',
    'setup.signalWeak':      'Weak',
    'setup.signalVeryWeak':  'Very Weak',
    'setup.pinErrorTooShort':  'PIN must be at least 4 digits',
    'setup.pinErrorTooLong':   'PIN must be at most 6 digits',
    'setup.pinErrorNotDigits': 'PIN must contain only digits',
    'setup.pinErrorMismatch':  'PINs do not match',
    'setup.statusEmptySsid':   'WiFi network name cannot be empty.',
    'setup.statusConnecting':  'Connecting to ESP32...',
    'setup.statusSaved':       'Saved! ESP32 is restarting...',
    'setup.statusError':       '❌ Could not connect to ESP32. Make sure you\'re connected to the ESP32-Setup network.',
    'setup.wifiScanEmpty':     'No networks found nearby. Try again.',
    'setup.wifiScanFailed':    'Could not retrieve network list.\nMake sure you\'re connected to the ESP32-Setup network.',

    'scan.title':           '// NETWORK SCAN',
    'scan.scanning':        'Scanning...',
    'scan.found':            'device(s) found',
    'scan.notFound':        'No device found',
    'scan.scanButton':      '[ Start Scan ]',
    'scan.connectingTitle': 'ESP32 CONNECTING',
    'scan.connectingDesc':  'The device is connecting to the new network, please wait...',
    'scan.skipWait':        '[ Scan Now ]',
    'scan.addDevice':       'Add Device',
    'scan.deviceName':      'Device Name',
    'scan.pinRequired':     'PIN required',
    'scan.typeWs2812b':              'RGB Strip',
    'scan.typeSingleLed':            'Single LED / Bulb',
    'scan.typeRelay':                'Relay / Bulb',
    'scan.typeUnknown':              'Unknown',
    'scan.alreadyRegisteredTitle':   'Device Already Registered',
    'scan.alreadyRegisteredDesc':    'is already in your list.\nWould you like to connect to it?',
    'scan.connectButton':            'Connect',
    'scan.titleDesc':                'All ESP32 devices on the local network are listed',
    'scan.wifiWarning1':             "📶 To scan, your phone must be on the same home WiFi network as the ESP32.",
    'scan.wifiWarning2':             'Make sure you are on your own network, not the ESP32-Setup network.',
    'scan.scanningLabel':            'SCANNING NETWORK',
    'scan.foundLabel':               'FOUND',
    'scan.deviceFoundCount':         'DEVICE(S) FOUND',
    'scan.pinBadge':                 '🔒 PIN',
    'scan.newDeviceHint':            'New device — tap to add',
    'scan.emptyTitle':               'No device found',
    'scan.emptyDesc':                'Make sure your ESP32 is on the same WiFi network',
    'scan.selectedDeviceLabel':      'SELECTED DEVICE',
    'scan.deviceNameFieldLabel':     'DEVICE NAME',
    'scan.deviceNamePlaceholder':    'e.g. Living Room Lamp',
    'scan.pinFieldLabel':            'DEVICE PIN (OPTIONAL)',
    'scan.pinPlaceholderRequired':   'The PIN you set during setup',
    'scan.pinPlaceholderOptional':   'Leave blank if no PIN was set',
    'scan.pinNoteRequired':          '🔒 This device is PIN-protected. Enter the PIN you set during setup.',
    'scan.pinNoteOptional':          "ℹ️  You can leave this blank if no PIN was set.",
    'scan.saveButton':               '[ SAVE & CONNECT ]',
    'scan.savingButton':             '[ SAVING... ]',
    'scan.backToList':               '← Back to List',
    'scan.actionDivider':            'ACTION',
    'scan.rescanLabel':              'RESCAN',
    'scan.scanLabel':                'SCAN',
    'scan.scanningButton':           '[ Scanning... ]',
    'scan.rescanButton':             '[ Scan Again ]',
    'scan.scanNowButton':            '[ Scan Network ]',
    'scan.pinErrorShort':            'PIN must be at least 4 digits',
    'scan.secondsUnit':              's',

    'deviceList.title':       '// REGISTERED DEVICES',
    'deviceList.count':       'device(s)',
    'deviceList.hint':        'RESET → restores ESP32 factory settings · UPDATE → firmware OTA',
    'deviceList.addButton':   '+ ADD',
    'deviceList.newSetup':    'New Setup',
    'deviceList.scanNetwork': 'Scan Network',
    'deviceList.reset':       'Reset',
    'deviceList.resetConfirm':'Reset this device? This cannot be undone.',
    'deviceList.update':      'Update',
    'deviceList.rename':      'Rename',
    'deviceList.deleteConfirm':'Delete this device?',
    'deviceList.removeTitle':        'Remove Device From List',
    'deviceList.removeDesc':         'will be removed from the app.\n\nThe ESP32 itself will not be affected.',
    'deviceList.removeButton':       'Remove',
    'deviceList.factoryResetTitle':  '⚠️ Factory Reset',
    'deviceList.factoryResetDesc':   'will be reset.\n\n• WiFi credentials will be erased\n• Automation rules will be erased\n• Setup will need to be redone\n\nThis cannot be undone.',
    'deviceList.factoryResetButton': 'Reset',
    'deviceList.resetDoneTitle':     'Reset Complete',
    'deviceList.resetDoneDesc':      'has been reset. ESP32 is now in "ESP32-Setup" mode.\n\nUse Start Setup to set it up again.',
    'deviceList.serverError':        'Server error',
    'deviceList.unreachableTitle':   'Could Not Reach ESP32',
    'deviceList.unreachableDesc':    'could not be reached.\n\nWould you like to just remove it from the app?',
    'deviceList.removeOnlyButton':   'Remove From List Only',
    'deviceList.otaUnreachable':     'Could not reach device',
    'deviceList.otaUpdateTitle':     'Update Firmware',
    'deviceList.otaUpdateDesc':      'will be updated.\n\n',
    'deviceList.otaUpdateDuration':  'The update takes about 30-60 seconds. The device will not respond during this time.',
    'deviceList.otaUpdateButton':    'Update',
    'deviceList.otaStartedTitle':    'Update Started',
    'deviceList.otaStartedDesc':     'The ESP32 is updating. It will restart automatically in about 60 seconds.\n\nOnce it restarts, you can verify the new version with "Check Firmware".',
    'deviceList.otaStartFailed':     'Could not start update',
    'deviceList.editButton':         'EDIT',
    'deviceList.otaCheckButton':     '↑ Check Firmware',
    'deviceList.otaUpToDate':        '✓ Up to date · Check Again',
    'deviceList.otaChecking':        '⏳ Checking version...',
    'deviceList.otaUpdating':        '⚡ Update in progress...',
    'deviceList.otaConnectionError': 'Connection error',
    'deviceList.otaNewVersionLabel': 'NEW VERSION',
    'deviceList.otaUpdateNowButton': 'UPDATE',
    'deviceList.otaUpToDateLabel':   'is the latest version',
    'deviceList.headerBrand':        'DEVICES',
    'deviceList.addPrompt':          'How would you like to add a device?',
    'deviceList.emptyTitle':         'No devices yet.',
    'deviceList.emptyDesc':          'Tap the + button at the top right and scan the network.',
    'deviceList.physicalResetTitle': '📌 Physical Reset',
    'deviceList.physicalResetDesc':  "If you can't access the app, hold the button on GPIO 0 for 3 seconds → LED turns yellow → red → device resets",
    'deviceList.relayType':          'RELAY',
    'deviceList.currentVersionLabel':'Current',
    'deviceList.saveButton':         'SAVE',
    'deviceList.resettingLabel':     'RESETTING...',
    'deviceList.removeShortButton':  'REMOVE',
    'deviceList.resetShortButton':   'RESET',
    'deviceList.addDeviceTitle':     'Add Device',
    'deviceList.footerBrand':        'Smart Craft · IoT',

    'control.activeDevice': 'ACTIVE DEVICE',
    'control.offline':      'OFFLINE',
    'control.connection':   'CONNECTION //',
    'control.brightness':   'BRIGHTNESS',
    'control.color':        'COLOR',
    'control.scenes':       'SCENES',
    'control.automation':   'AUTOMATION',
    'control.sleepMode':    'Sleep Mode',
    'control.sleepActive':  'SLEEP MODE ACTIVE',
    'control.sleepMinutes': 'MINUTES',
    'control.sleepStart':   '[ START ]',
    'control.sleepStarting':'STARTING...',
    'control.sleepCancel':  'CANCEL',
    'control.dailyRule':    '+ Daily',
    'control.countdownRule':'+ Countdown',
    'control.timeLabel':    'HOUR',
    'control.speedVerySlow': 'Very Slow',
    'control.speedSlow':     'Slow',
    'control.speedFast':     'Fast',
    'control.speedVeryFast': 'Very Fast',
    'control.errorOffline':       'Device offline',
    'control.errorConnection':    'Connection error',
    'control.errorPresetFailed':  'Could not apply preset',
    'control.cancel':             'Cancel',
    'control.deleteRuleTitle':    'Delete Rule',
    'control.deleteRuleConfirm':  '? This will be deleted.',
    'control.errorSleepFailed':   'Could not start sleep mode',
    'control.willApplyOnTurnOn':  'will apply when turned on',
    'control.staticLabel':        'STATIC',
    'control.loading':            'Loading...',
    'control.noRulesYet':         'No rules yet.',
    'control.ruleDaily':          'DAILY',
    'control.ruleOnce':           'ONCE',
    'control.ruleOn':             'ON',
    'control.ruleOff':            'OFF',
    'control.deleteButton':       'DELETE',
    'control.fadeActiveTitle':    '🌙 SLEEP MODE ACTIVE',
    'control.fadeCancelButton':   'CANCEL',
    'control.fadeTimeRemaining':  'min',
    'control.fadeCalculating':    'Calculating...',
    'control.sleepModeButton':    '🌙 Sleep Mode',
    'control.sleepModeDesc':      'The light will gradually dim and turn off over the selected duration.',
    'control.minutesLabel':       'MINUTES',
    'control.dailyTimerTitle':    '// DAILY TIMER',
    'control.countdownTitle':     '// COUNTDOWN',
    'control.turnOnLabel':        'ON',
    'control.savingButton':       'SAVING...',
    'control.saveButton':         '[ SAVE ]',
    'control.stripLabel':         'Strip',
    'control.pinErrorWrong':      'Incorrect PIN.',
    'control.pinErrorConnection': 'Connection error.',
    'control.singleChannel':      'CHANNEL',
    'control.multiChannel':       'CHANNELS',
    'control.singleLed':          'SINGLE LED',
    'control.relay':              'RELAY',
    'control.modelOn':            'ON',
    'control.modelOff':           'OFF',
    'control.dragRotateMulti':    'drag · rotate',
    'control.dragRotateSingle':   'tap · on/off  ·  drag · rotate',
    'control.speedLabel':         'SPEED',
    'control.deletePresetTitle':  'Delete Preset',
    'control.effectsLabel':       'EFFECTS',
    'control.applyButton':        '[ APPLY ]',
    'control.activeStatusLabel':  'active',
    'effect.rainbow.label':       'Rainbow',
    'effect.rainbow.desc':        'Cycles through all colors',
    'effect.breathe.label':       'Breathe',
    'effect.breathe.desc':        'Selected color slowly fades in and out',
    'effect.wave.label':          'Wave',
    'effect.wave.desc':           'A wave of color passes through the strip',
    'effect.fire.label':          'Fire',
    'effect.fire.desc':           'Flickering flame effect',
    'effect.meteor.label':        'Meteor',
    'effect.meteor.desc':         'A light ball passes by leaving a trail',
    'effect.twinkle.label':       'Twinkle',
    'effect.twinkle.desc':        'Random twinkling stars',
    'effect.strobe.label':        'Strobe',
    'effect.strobe.desc':         'Fast strobe flash',
    'effect.comet.label':         'Comet',
    'effect.comet.desc':          'A comet travels back and forth',
    'effect.theater.label':       'Marquee',
    'effect.theater.desc':        'Theater lights — every 3rd LED',
    'effect.pulse.label':         'Pulse',
    'effect.pulse.desc':          'The whole strip pulses together',
    'effect.colorCycle.label':    'Color Cycle',
    'effect.colorCycle.desc':     'A single color slowly shifts to another',
    'effect.gradient.label':      'Gradient',
    'effect.gradient.desc':       'Color transition from end to end',
    'effect.wipe.label':          'Wipe',
    'effect.wipe.desc':           'Color sweeps from one end to the other',
    'effect.bouncing.label':      'Bounce',
    'effect.bouncing.desc':       'A light point bounces back and forth',
    'effect.scanner.label':       'Scanner',
    'effect.scanner.desc':        'Knight Rider style side-to-side scan',
    'effect.chase.label':         'Chase',
    'effect.chase.desc':          'Light points chase each other',
    'effect.ripple.label':        'Ripple',
    'effect.ripple.desc':         'Waves spread out from the center',
    'effect.sparkle.label':       'Sparkle',
    'effect.sparkle.desc':        'Random single pixels flash instantly',
    'effect.noise.label':         'Cloud',
    'effect.noise.desc':          'Organic flowing color transitions',
    'effect.larsonScanner.label': 'Larson',
    'effect.larsonScanner.desc':  'A soft light orb moves back and forth',
    'effect.confetti.label':      'Confetti',
    'effect.confetti.desc':       'Random color bursts',
    'effect.juggle.label':        'Juggle',
    'effect.juggle.desc':         'Independent balls at different speeds',
    'effect.bpm.label':           'BPM',
    'effect.bpm.desc':            'Pulses in sync with a beat',
    'preset.white': 'White',
    'preset.warm':  'Warm',
    'preset.night': 'Night',
    'preset.focus': 'Focus',
    'preset.red':   'Red',
    'preset.green': 'Green',
    'presets.brightnessSuffix':  'brightness',
    'presets.headerTitle':       'SCENES',
    'presets.headerHint':        'Tap → apply instantly · On an effect card › → adjust color & speed',
    'presets.saveCurrentTitle':  '// SAVE CURRENT COLOR',
    'presets.toSaveLabel':       'TO SAVE',
    'presets.iconLabel':         'ICON',
    'presets.namePlaceholder':   'e.g. Movie Mode',
    'presets.staticScenesLabel': 'STATIC SCENES',
    'presets.longPressHint':     'Long press to delete a personal scene',
    'presets.dynamicEffectsLabel': 'DYNAMIC EFFECTS',

    'settings.language':       'Language',
    'settings.selectLanguage': 'Select Language',
  },
};