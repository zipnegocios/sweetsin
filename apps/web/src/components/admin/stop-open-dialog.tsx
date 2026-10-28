"use client";

import { useRef, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { openTrailerStopAction } from "@/app/actions/admin-trailer-stops";
import { StopStockEditor } from "@/components/admin/stop-stock-editor";
import { useStopOperation } from "@/components/admin/use-stop-operation";

type EditorProps = ComponentProps<typeof StopStockEditor>;

/**
 * Abrir una parada programada. Con `requireConfirmation` muestra antes la tabla de stock
 * (el mismo editor del detalle) y "Confirmar y abrir"; sin él, abrir es un clic.
 * Stock vacío o parcial solo avisa: nunca bloquea.
 */
export function StopOpenDialog({
  stopId,
  requireConfirmation,
  rows,
  availableProducts,
}: {
  stopId: string;
  requireConfirmation: boolean;
  rows: EditorProps["rows"];
  availableProducts: EditorProps["availableProducts"];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { isPending, error, setError, run } = useStopOperation();

  const warning =
    rows.length === 0 ? "stopOpenEmptyWarning" : rows.some((r) => r.currentStock === 0) ? "stopOpenPartialWarning" : null;

  function open() {
    void run(
      () => openTrailerStopAction(stopId),
      () => {
        dialogRef.current?.close();
        router.refresh();
      },
    );
  }

  function handleClick() {
    if (!requireConfirmation) return open();
    setError(null);
    dialogRef.current?.showModal();
  }

  const errorText = error && (
    <p role="alert" className="text-[13px] text-sin-red">
      {t(error.key, error.values)}
    </p>
  );
  const warningText = warning && (
    <p role="status" className="text-[13px] text-[#8A611C]">
      {t(warning)}
    </p>
  );

  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={isPending} onClick={handleClick} className="admin-btn disabled:opacity-50">
        {t("stopOpenButton")}
      </button>
      {!requireConfirmation && (
        <>
          {warningText}
          {errorText}
        </>
      )}

      {requireConfirmation && (
        <dialog
          ref={dialogRef}
          aria-labelledby={`open-title-${stopId}`}
          className="m-auto w-full max-w-3xl rounded-xl p-6 backdrop:bg-navy/40"
        >
          <h2 id={`open-title-${stopId}`} className="font-serif font-bold text-navy text-xl mb-4">
            {t("stopOpenTitle")}
          </h2>
          <StopStockEditor stopId={stopId} rows={rows} availableProducts={availableProducts} readOnly={false} />
          <div className="mt-4 space-y-2">
            {warningText}
            {errorText}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" disabled={isPending} onClick={() => dialogRef.current?.close()} className="admin-link text-[13px]">
              {t("stopDialogCancel")}
            </button>
            <button type="button" disabled={isPending} onClick={open} className="admin-btn disabled:opacity-50">
              {t("stopOpenConfirm")}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
