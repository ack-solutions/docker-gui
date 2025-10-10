"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";

type DialogTone = "default" | "danger";

interface BaseDialogOptions {
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface ConfirmDialogOptions extends BaseDialogOptions {
  requireConfirm?: boolean;
}

export interface AlertDialogOptions extends BaseDialogOptions {
  confirmLabel?: string;
}

interface ConfirmationDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions) => Promise<void>;
}

interface DialogState {
  type: "confirm" | "alert";
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

const ConfirmationDialogContext = createContext<ConfirmationDialogContextValue | null>(null);

const getConfirmLabel = (options: ConfirmDialogOptions, type: DialogState["type"]) => {
  if (options.confirmLabel) {
    return options.confirmLabel;
  }

  return type === "alert" ? "Close" : "Confirm";
};

const getCancelLabel = (options: ConfirmDialogOptions) => options.cancelLabel ?? "Cancel";

const isDestructive = (tone: DialogTone | undefined) => tone === "danger";

export const ConfirmationDialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          type: "confirm",
          options,
          resolve: (value) => {
            resolve(value);
            closeDialog();
          }
        });
      }),
    [closeDialog]
  );

  const alert = useCallback(
    (options: AlertDialogOptions) =>
      new Promise<void>((resolve) => {
        setDialog({
          type: "alert",
          options: {
            ...options,
            cancelLabel: undefined
          },
          resolve: (value) => {
            if (value) {
              resolve();
            } else {
              resolve();
            }
            closeDialog();
          }
        });
      }),
    [closeDialog]
  );

  const handleCancel = useCallback(() => {
    if (!dialog) {
      return;
    }
    dialog.resolve(false);
  }, [dialog]);

  const handleConfirm = useCallback(() => {
    if (!dialog) {
      return;
    }
    dialog.resolve(true);
  }, [dialog]);

  const value = useMemo<ConfirmationDialogContextValue>(
    () => ({ confirm, alert }),
    [alert, confirm]
  );

  const tone = dialog?.options.tone ?? "default";
  const showCancel =
    dialog?.type === "confirm" &&
    (dialog.options.cancelLabel !== undefined || dialog.options.requireConfirm !== true);

  return (
    <ConfirmationDialogContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(dialog)}
        onClose={handleCancel}
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        {dialog?.options.title && (
          <DialogTitle id="confirmation-dialog-title">
            {typeof dialog.options.title === "string" ? (
              <Typography variant="h6">{dialog.options.title}</Typography>
            ) : (
              dialog.options.title
            )}
          </DialogTitle>
        )}
        {dialog?.options.message && (
          <DialogContent dividers>
            {typeof dialog.options.message === "string" ? (
              <DialogContentText id="confirmation-dialog-description">
                {dialog.options.message}
              </DialogContentText>
            ) : (
              <Stack spacing={1}>{dialog.options.message}</Stack>
            )}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, py: 2 }}>
          {showCancel && dialog && (
            <Button onClick={handleCancel}>
              {getCancelLabel(dialog.options)}
            </Button>
          )}
          {dialog && (
            <Button
              onClick={handleConfirm}
              variant={isDestructive(tone) ? "contained" : "contained"}
              color={isDestructive(tone) ? "error" : "primary"}
              autoFocus
            >
              {getConfirmLabel(dialog.options, dialog.type)}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </ConfirmationDialogContext.Provider>
  );
};

export const useConfirmationDialog = () => {
  const context = useContext(ConfirmationDialogContext);
  if (!context) {
    throw new Error("useConfirmationDialog must be used within a ConfirmationDialogProvider.");
  }
  return context;
};

export default ConfirmationDialogContext;
