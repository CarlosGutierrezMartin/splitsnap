/**
 * Forma del diccionario.
 *
 * Es la fuente de verdad de los textos: al ser una interfaz, TypeScript
 * obliga a que cada idioma implemente todas las claves. Asi no se repite lo
 * que pasaba antes, con media app traducida y media en ingles.
 */
export interface Translations {
  common: {
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    back: string;
    done: string;
    retry: string;
    add: string;
    next: string;
  };
  home: {
    tagline: string;
    scanReceipt: string;
    recent: string;
    empty: string;
    emptyHint: string;
    deleteTitle: string;
    deleteBody: string;
    items: (count: number) => string;
    offlineReady: string;
    prepareOffline: string;
    prepareOfflineHint: string;
    preparingOffline: (percent: number) => string;
    interruptedScan: (phase: string) => string;
    interruptedScanPhoto: (megapixels: number) => string;
  };
  capture: {
    title: string;
    subtitle: string;
    takePhoto: string;
    chooseFile: string;
    dropHere: string;
    tips: string;
    tipFlat: string;
    tipLight: string;
    tipFull: string;
    privacy: string;
  };
  frame: {
    title: string;
    subtitle: string;
    confirm: string;
    working: string;
    rotateLeft: string;
    rotateRight: string;
    reset: string;
    corner: string;
    detected: string;
    useSuggestion: string;
  };
  scanning: {
    preparing: string;
    downloadingModel: string;
    downloadingHint: string;
    reading: string;
    failedTitle: string;
    failedBody: string;
  };
  review: {
    title: string;
    subtitle: string;
    noItems: string;
    noItemsHint: string;
    addLine: string;
    newItem: string;
    name: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    sum: string;
    printedTotal: string;
    mismatchHint: string;
    verdictBalanced: string;
    verdictUnverified: string;
    verdictUnverifiedHint: string;
    verdictNothingRead: string;
    verdictMissing: (amount: string) => string;
    verdictExtra: (amount: string) => string;
    verdictUncertainLines: (count: number) => string;
    straightened: (degrees: number) => string;
    lowConfidence: string;
    continueToSplit: string;
    receiptName: string;
    receiptNamePlaceholder: string;
  };
  split: {
    title: string;
    total: string;
    assigned: string;
    unassigned: string;
    people: string;
    addPerson: string;
    personName: string;
    noPeople: string;
    noPeopleHint: string;
    assignItems: string;
    splitRest: string;
    splitRestHint: string;
    allAssigned: string;
    share: string;
    removePerson: string;
    removePersonBody: string;
    perPerson: (count: number) => string;
  };
  assign: {
    selectingFor: string;
    yourShare: string;
    unitsLeft: (count: number) => string;
    allTaken: string;
    takeWhole: string;
    splitUnit: string;
    splitInto: (parts: number) => string;
    customParts: string;
    yourParts: (mine: number, total: number) => string;
    unit: (index: number) => string;
    takenBy: string;
    free: string;
    saveSelection: string;
  };
  share: {
    copied: string;
    unavailable: string;
    downloadImage: string;
  };
  install: {
    title: string;
    body: string;
    action: string;
    iosTitle: string;
    iosBody: string;
    dismiss: string;
  };
  tabs: {
    label: string;
    home: string;
    scan: string;
    settings: string;
  };
  onboarding: {
    scanTitle: string;
    scanBody: string;
    reviewTitle: string;
    reviewBody: string;
    splitTitle: string;
    splitBody: string;
    privacy: string;
    start: string;
    skip: string;
  };
  diagnostics: {
    title: string;
    boxes: string;
    rows: string;
    elapsed: string;
    decisions: string;
    showBoxes: string;
    hideBoxes: string;
  };
  settings: {
    theme: string;
    language: string;
    dark: string;
    light: string;
    diagnostics: string;
    diagnosticsHint: string;
    diagnosticsEmpty: string;
    clearData: string;
    clearDataHint: (count: number) => string;
    clearDataConfirm: string;
    privacy: string;
    terms: string;
    offlineNote: string;
  };
}
