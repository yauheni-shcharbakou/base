'use client';

import { getStorageItemKind, PdfControls, StorageItemKind } from '@/features/storage/helpers';
import { useFoldUploadPanel } from '@/features/storage/hooks';
import { BunnyPlayerControls } from '@/features/video/components';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { Box, CircularProgress, Dialog, IconButton, Stack, Tooltip } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, MouseEvent, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { GalleryBar } from './gallery-bar';
import { GalleryInfo } from './gallery-info';
import { GalleryStage } from './gallery-stage';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  open: boolean;
  // None while the neighbouring page loads.
  item?: Item;
  // Where the item's video goes on from, when the inline player opened the viewer.
  startTime?: number;
  position?: string;
  canPrev: boolean;
  canNext: boolean;
  isInfoShown: boolean;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onToggleInfo: () => void;
  onOpen: (item: Item) => void;
  onUploadAgain?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onRename?: (item: Item) => void;
  onPublicChange?: (item: Item, isPublic: boolean) => void;
  // The folder shown is public: nothing in it goes private.
  isPublicLocked?: boolean;
  onPreviewError?: () => void;
  getFolderHref?: (id: string) => string;
  playerControls?: RefObject<BunnyPlayerControls | null>;
  pdfControls?: RefObject<PdfControls | null>;
};

// How long the pointer rests before the controls fade out, as in any media viewer.
const IDLE_AFTER_MS = 2500;

const StepButton: FC<{
  side: 'left' | 'right';
  disabled: boolean;
  isHidden: boolean;
  onClick: () => void;
}> = ({ side, disabled, isHidden, onClick }) => (
  // No title on a disabled button: it fires no events, and the tooltip warns about one.
  <Tooltip title={disabled ? '' : side === 'left' ? 'Previous (←)' : 'Next (→)'}>
    <IconButton
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      disabled={disabled}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
      // A click must not leave the focus here, where Space would press the button again instead of
      // leaving the viewer.
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      sx={{
        position: 'absolute',
        top: '50%',
        [side]: 16,
        zIndex: 3,
        transform: 'translateY(-50%)',
        width: 56,
        height: 56,
        color: 'common.white',
        bgcolor: 'rgba(0, 0, 0, 0.45)',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
        '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.3)', bgcolor: 'rgba(0, 0, 0, 0.2)' },
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
        transition: 'opacity 200ms',
      }}
    >
      {side === 'left' ? (
        <ChevronLeftRounded sx={{ fontSize: 40 }} />
      ) : (
        <ChevronRightRounded sx={{ fontSize: 40 }} />
      )}
    </IconButton>
  </Tooltip>
);

/**
 * The folder browser's full-screen viewer, over any view: one item at a time over black, stepping
 * through the folder until it is left. An image fills the screen, a video plays on arrival, a PDF
 * shows its pages, anything else shows a placeholder to open it by. The keys are
 * `useFolderViewer`'s; the controls fade while the pointer rests, and the upload box folds to its
 * header while the viewer is open.
 */
export const GalleryViewer: FC<Props> = ({
  open,
  item,
  startTime,
  position,
  canPrev,
  canNext,
  isInfoShown,
  onPrev,
  onNext,
  onExit,
  onToggleInfo,
  onOpen,
  onUploadAgain,
  onDelete,
  onRename,
  onPublicChange,
  isPublicLocked,
  onPreviewError,
  getFolderHref,
  playerControls,
  pdfControls,
}) => {
  const [isIdle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The upload box lies over the viewer: open, it would cover the corner of the stage, and on a
  // narrow window the stage's own buttons.
  useFoldUploadPanel(open);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_AFTER_MS);
  }, []);

  useEffect(() => {
    if (open) {
      wake();
    }

    return () => clearTimeout(idleTimer.current);
  }, [open, wake]);

  // Only a picture hides the controls: a video's player swallows the pointer, so no move over it
  // would bring them back.
  const isHidden = isIdle && !!item && getStorageItemKind(item) === StorageItemKind.IMAGE;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onExit}
      slotProps={{ paper: { sx: { bgcolor: 'common.black', color: 'common.white' } } }}
    >
      <Box
        onMouseMove={wake}
        sx={{ position: 'relative', flex: 1, cursor: isHidden ? 'none' : undefined }}
      >
        {item ? (
          <GalleryStage
            key={item.id}
            item={item}
            isViewer
            startTime={startTime}
            // The player's own full-screen button toggles, as it does inline: here it leaves.
            onFullscreen={onExit}
            onOpen={onOpen}
            onUploadAgain={onUploadAgain}
            onDelete={onDelete}
            onPreviewError={onPreviewError}
            playerControls={playerControls}
            pdfControls={pdfControls}
          />
        ) : (
          <Stack
            sx={{ position: 'absolute', inset: 0 }}
            alignItems="center"
            justifyContent="center"
          >
            <CircularProgress color="inherit" />
          </Stack>
        )}

        {item && (
          <GalleryBar
            item={item}
            position={position}
            isViewer
            isInfoShown={isInfoShown}
            isHidden={isHidden}
            onToggleInfo={onToggleInfo}
            onToggleViewer={onExit}
            onOpen={onOpen}
            onDelete={onDelete}
            onRename={onRename}
            onPublicChange={onPublicChange}
            isPublicLocked={isPublicLocked}
            getFolderHref={getFolderHref}
          />
        )}
        <StepButton side="left" disabled={!canPrev} isHidden={isHidden} onClick={onPrev} />
        <StepButton side="right" disabled={!canNext} isHidden={isHidden} onClick={onNext} />
        {item && isInfoShown && <GalleryInfo item={item} />}
      </Box>
    </Dialog>
  );
};
