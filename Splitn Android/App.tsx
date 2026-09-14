import { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CaptureView } from './components/CaptureView';
import { ScanningView } from './components/ScanningView';
import { ReviewView } from './components/ReviewView';
import { SplitView } from './components/SplitView';
import { AssignView } from './components/AssignView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InstallPrompt } from './components/InstallPrompt';
import { Toast } from './components/Toast';
import { useReceipt } from './hooks/useReceipt';
import { useLanguage } from './contexts/LanguageContext';
import { loadOcrEngine, onOcrStatus, scanReceipt } from './ocr/engine';
import { parseReceipt } from './ocr/parseReceipt';
import { shareSummary } from './lib/share';
import { AppState, type ParsedItem, type Receipt } from './types';
import type { OcrStatus } from './ocr/types';

function App() {
  const { t } = useLanguage();
  const {
    receipt, history, loadingHistory, refreshHistory,
    createReceipt, openReceipt, closeReceipt, rename, replaceItems,
    addParticipant, removeParticipant, updateItemStates, discard,
  } = useReceipt();

  const [screen, setScreen] = useState<AppState>(AppState.HOME);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>({ phase: 'idle', source: 'unknown' });
  const [scanError, setScanError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);

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

      try {
        const output = await scanReceipt(file);
        const { items, detectedTotal } = parseReceipt(output.lines);

        createReceipt(items, { detectedTotal });
        setScreen(AppState.REVIEW);
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err));
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
        {screen === AppState.HOME && (
          <HomeView
            history={history}
            loading={loadingHistory}
            onScan={() => setScreen(AppState.CAPTURE)}
            onOpen={(target) => { openReceipt(target); setScreen(AppState.SPLIT); }}
            onDelete={(id) => setPendingDelete(history.find((r) => r.id === id) ?? null)}
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

      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Solo en la pantalla de inicio: ofrecer instalar en mitad de un
          reparto taparia los botones de abajo. */}
      {screen === AppState.HOME && <InstallPrompt />}
    </div>
  );
}

export default App;
