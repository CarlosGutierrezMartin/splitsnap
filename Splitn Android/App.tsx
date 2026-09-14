import { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CaptureView } from './components/CaptureView';
import { ScanningView } from './components/ScanningView';
import { ReviewView } from './components/ReviewView';
import { SplitView } from './components/SplitView';
import { AssignView } from './components/AssignView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';
import { InstallPrompt } from './components/InstallPrompt';
import { Toast } from './components/Toast';
import { useReceipt } from './hooks/useReceipt';
import { useLanguage } from './contexts/LanguageContext';
import { loadOcrEngine, onOcrStatus, scanReceipt } from './ocr/engine';
import { parseReceipt } from './ocr/parseReceipt';
import { shareSummary } from './lib/share';
import {
  consumeInterruptedScan, describePhase, markScanFinished, markScanPhase, markScanStarted,
} from './lib/crashReport';
import { AppState, type ParsedItem, type Receipt } from './types';
import type { OcrStatus } from './ocr/types';

function App() {
  const { t, language } = useLanguage();
  const {
    receipt, history, loadingHistory, refreshHistory,
    createReceipt, openReceipt, closeReceipt, rename, replaceItems,
    addParticipant, removeParticipant, updateItemStates, discard, renameReceipt,
  } = useReceipt();

  const [screen, setScreen] = useState<AppState>(AppState.HOME);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>({ phase: 'idle', source: 'unknown' });
  const [scanError, setScanError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [pendingRename, setPendingRename] = useState<Receipt | null>(null);
  // Si el escaneo anterior murio a mitad (normalmente porque el navegador
  // cerro la pestaña por memoria), se avisa en vez de aparecer en el inicio
  // como si no hubiera pasado nada.
  const [crashed] = useState(consumeInterruptedScan);

  useEffect(() => onOcrStatus(setOcrStatus), []);

  /**
   * El modelo pesa ~21 MB y solo se descarga la primera vez. Arrancarlo al
   * entrar en la pantalla de captura le da ventaja mientras la persona
   * encuadra la foto, en vez de hacerle esperar despues.
   */
  useEffect(() => {
    if (screen === AppState.CAPTURE) void loadOcrEngine().catch(() => undefined);
  }, [screen]);

  const handleScan = useCallback(
    async (file: File) => {
      setScreen(AppState.SCANNING);
      setScanError(null);

      markScanStarted();
      try {
        const output = await scanReceipt(file);

        markScanPhase('parse');
        const { items, detectedTotal } = parseReceipt(output.lines);

        markScanPhase('render');
        createReceipt(items, { detectedTotal });
        setScreen(AppState.REVIEW);
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err));
      } finally {
        markScanFinished();
      }
    },
    [createReceipt],
  );

  /** Salida de emergencia cuando el OCR falla: empezar a mano desde cero. */
  const startManualReceipt = useCallback(() => {
    createReceipt([], { detectedTotal: null });
    setScreen(AppState.REVIEW);
  }, [createReceipt]);

  const handleShare = useCallback(async () => {
    if (!receipt) return;
    const outcome = await shareSummary(receipt);
    if (outcome === 'copied') setToast(t.share.copied);
    else if (outcome === 'unavailable') setToast(t.share.unavailable);
  }, [receipt, t]);

  const goHome = useCallback(() => {
    closeReceipt();
    setAssigning(null);
    setScreen(AppState.HOME);
  }, [closeReceipt]);

  const handleItemsChange = useCallback(
    (items: ParsedItem[]) => replaceItems(items),
    [replaceItems],
  );

  const back = (() => {
    switch (screen) {
      case AppState.CAPTURE:
        return () => setScreen(AppState.HOME);
      case AppState.REVIEW:
      case AppState.SPLIT:
        return goHome;
      case AppState.ASSIGN:
        return () => { setAssigning(null); setScreen(AppState.SPLIT); };
      default:
        return undefined;
    }
  })();

  return (
    <div className="min-h-screen">
      <Navbar
        title={screen === AppState.HOME ? undefined : receipt?.name}
        onBack={back}
      />

      <main>
        {screen === AppState.HOME && crashed && (
          <div className="mx-4 mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <p>{t.home.interruptedScan(describePhase(crashed.phase, language))}</p>
            {crashed.pixels !== undefined && (
              <p className="mt-1 text-xs opacity-80">
                {t.home.interruptedScanPhoto(Math.round(crashed.pixels / 1_000_000))}
              </p>
            )}
          </div>
        )}

        {screen === AppState.HOME && (
          <HomeView
            history={history}
            loading={loadingHistory}
            onScan={() => setScreen(AppState.CAPTURE)}
            onOpen={(target) => { openReceipt(target); setScreen(AppState.SPLIT); }}
            onDelete={(id) => setPendingDelete(history.find((r) => r.id === id) ?? null)}
            onRename={setPendingRename}
          />
        )}

        {screen === AppState.CAPTURE && <CaptureView onSelect={handleScan} />}

        {screen === AppState.SCANNING && (
          <ScanningView
            status={ocrStatus}
            error={scanError}
            onRetry={() => { setScanError(null); setScreen(AppState.CAPTURE); }}
            onEnterManually={startManualReceipt}
          />
        )}

        {screen === AppState.REVIEW && receipt && (
          <ReviewView
            items={receipt.items}
            detectedTotal={receipt.detectedTotal}
            receiptName={receipt.name}
            skewDegrees={receipt.skewDegrees ?? 0}
            onChange={handleItemsChange}
            onRename={rename}
            onContinue={() => setScreen(AppState.SPLIT)}
          />
        )}

        {screen === AppState.SPLIT && receipt && (
          <SplitView
            receipt={receipt}
            onAddParticipant={addParticipant}
            onRemoveParticipant={removeParticipant}
            onAssign={(participantId) => { setAssigning(participantId); setScreen(AppState.ASSIGN); }}
            onUpdateItemStates={updateItemStates}
            onShare={handleShare}
            onRename={() => setPendingRename(receipt)}
          />
        )}

        {screen === AppState.ASSIGN && receipt && assigning && (
          <AssignView
            receipt={receipt}
            participantId={assigning}
            onSave={(itemStates) => {
              updateItemStates(itemStates);
              setAssigning(null);
              setScreen(AppState.SPLIT);
            }}
            onCancel={() => { setAssigning(null); setScreen(AppState.SPLIT); }}
          />
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.home.deleteTitle}
        description={t.home.deleteBody}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (pendingDelete) await discard(pendingDelete.id);
          setPendingDelete(null);
          await refreshHistory();
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <RenameDialog
        open={pendingRename !== null}
        title={t.review.receiptName}
        initialValue={pendingRename?.name ?? ''}
        placeholder={t.review.receiptNamePlaceholder}
        onSave={(name) => { if (pendingRename) void renameReceipt(pendingRename.id, name); }}
        onCancel={() => setPendingRename(null)}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Solo en la pantalla de inicio: ofrecer instalar en mitad de un
          reparto taparia los botones de abajo. */}
      {screen === AppState.HOME && <InstallPrompt />}
    </div>
  );
}

export default App;
