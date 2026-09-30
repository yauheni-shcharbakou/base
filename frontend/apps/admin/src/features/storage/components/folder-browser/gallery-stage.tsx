'use client';

import {
  getFileSize,
  getFolderItemOpenUrl,
  getStorageItemKind,
  PdfControls,
  shouldAutoloadPdf,
  STORAGE_ITEM_KIND_LABELS,
  StorageItemKind,
} from '@/features/storage/helpers';
import { BunnyPlayer, BunnyPlayerControls } from '@/features/video/components';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import React, { FC, RefObject, useEffect, useState } from 'react';
import type { PdfFailure } from './pdf-document-view';
import { StorageItemIcon } from './storage-item-icon';

// pdf.js touches browser globals as it loads, and weighs a worker besides: never on the server, and
// only once a PDF is shown.
const PdfDocumentView = dynamic(
  () => import('./pdf-document-view').then(({ PdfDocumentView }) => PdfDocumentView),
  { ssr: false },
);

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  item: Item;
  // A viewer's stage: dark, the video plays on arrival, and a file gets a placeholder to open it.
  isViewer?: boolean;
  // Where a viewer's video goes on from — the inline player's, as it handed its full screen over.
  startTime?: number;
  // The player's own full-screen button, with where the video is: inline, the viewer takes over;
  // in the viewer, it leaves.
  onFullscreen?: (seconds: number) => void;
  onOpen?: (item: Item) => void;
  onPreviewError?: () => void;
  // Where a playing video's controls go, for the gallery's keys.
  playerControls?: RefObject<BunnyPlayerControls | null>;
  // Where a shown PDF's scrolling goes, for the gallery's keys.
  pdfControls?: RefObject<PdfControls | null>;
};

// How long a selection has to stay before the original loads, or a viewer's video starts. An
// original costs a gateway call (the `open` route signs it) and the gateway allows 100 a minute; a
// player loads a whole page of its own. Flicking through a folder with the arrow keys must spend
// neither per keypress. The preview shows meanwhile.
const REST_DELAY_MS = 400;

const fill = { position: 'absolute', inset: 0 } as const;

const PDF_FAILURE_LABELS: Record<PdfFailure, string> = {
  protected: 'Password-protected — open it to read',
  error: 'Preview unavailable',
};

/**
 * The large picture of a gallery or its viewer: an image's preview at once, then its original once
 * the selection rests; a video's poster that turns into the player on a click — or by itself, in
 * the viewer; a PDF's pages once the selection rests; a big icon for the rest. Keyed by item, so nothing of one item's state leaks into the
 * next.
 */
export const GalleryStage: FC<Props> = ({
  item,
  isViewer = false,
  startTime,
  onFullscreen,
  onOpen,
  onPreviewError,
  playerControls,
  pdfControls,
}) => {
  const kind = getStorageItemKind(item);
  const openUrl = getFolderItemOpenUrl(item);
  const [originalSrc, setOriginalSrc] = useState<string>();
  const [isOriginalShown, setOriginalShown] = useState(false);
  const [isPreviewFailed, setPreviewFailed] = useState(false);
  // A video that carries on from the inline player starts at once: no key flicked through to it.
  const [isPlaying, setPlaying] = useState(startTime !== undefined);
  const isPlayable = kind === StorageItemKind.VIDEO && !!openUrl;
  const isPdf = kind === StorageItemKind.PDF && !!openUrl;
  const isPdfAutoloaded = isPdf && shouldAutoloadPdf(item.file?.size, isViewer);
  const [pdfSrc, setPdfSrc] = useState<string>();
  const [isPdfShown, setPdfShown] = useState(false);
  const [pdfFailure, setPdfFailure] = useState<PdfFailure>();

  useEffect(() => {
    if (kind !== StorageItemKind.IMAGE || !openUrl) {
      return;
    }

    const timer = setTimeout(() => setOriginalSrc(openUrl), REST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [kind, openUrl]);

  // A PDF loads whole, through the same `open` call as an image's original: after the same pause.
  useEffect(() => {
    if (!isPdfAutoloaded || !openUrl) {
      return;
    }

    const timer = setTimeout(() => setPdfSrc(openUrl), REST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPdfAutoloaded, openUrl]);

  // The viewer plays every video it arrives at, once the selection rests there.
  useEffect(() => {
    if (!isViewer || !isPlayable) {
      return;
    }

    const timer = setTimeout(() => setPlaying(true), REST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isViewer, isPlayable]);

  const hasPreview = !!item.previewUrl && !isPreviewFailed;
  const mutedColor = isViewer ? 'grey.400' : 'text.secondary';

  const handlePreviewError = () => {
    setPreviewFailed(true);
    onPreviewError?.();
  };

  if (isPlayable && isPlaying && item.videoId) {
    return (
      <BunnyPlayer
        videoId={item.videoId}
        title={item.name}
        autoPlay
        startTime={startTime}
        keepPageFocus
        // The viewer is the gallery's full screen, not the player's own, which shows the iframe
        // alone: the player's button toggles the viewer instead.
        onFullscreen={onFullscreen}
        controlsRef={playerControls}
        sx={fill}
      />
    );
  }

  if (kind === StorageItemKind.IMAGE && (hasPreview || originalSrc)) {
    return (
      <Box sx={fill}>
        {!hasPreview && !isOriginalShown && (
          <Stack sx={fill} alignItems="center" justifyContent="center">
            <StorageItemIcon kind={kind} sx={{ fontSize: 160 }} />
          </Stack>
        )}
        {hasPreview && (
          <Image
            src={item.previewUrl!}
            alt={item.image?.alt || item.name}
            fill
            style={{ objectFit: 'contain', opacity: isOriginalShown ? 0 : 1 }}
            onError={handlePreviewError}
          />
        )}
        {originalSrc && (
          <Image
            src={originalSrc}
            alt={item.image?.alt || item.name}
            fill
            style={{
              objectFit: 'contain',
              opacity: isOriginalShown ? 1 : 0,
              transition: 'opacity 150ms',
            }}
            onLoad={() => setOriginalShown(true)}
          />
        )}
      </Box>
    );
  }

  if (isPlayable) {
    // The whole poster plays, not only its button: one click, not two.
    return (
      <Box
        role="button"
        aria-label={`Play ${item.name}`}
        onClick={() => setPlaying(true)}
        sx={{
          ...fill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {hasPreview ? (
          <Image
            src={item.previewUrl!}
            alt={item.name}
            fill
            style={{ objectFit: 'contain' }}
            onError={handlePreviewError}
          />
        ) : (
          <StorageItemIcon kind={kind} sx={{ fontSize: 160, opacity: 0.4 }} />
        )}
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            color: 'common.white',
            bgcolor: 'rgba(0, 0, 0, 0.55)',
            transition: 'background-color 120ms',
            '[role="button"]:hover > &': { bgcolor: 'rgba(0, 0, 0, 0.75)' },
          }}
        >
          {isViewer ? (
            <CircularProgress color="inherit" size={36} />
          ) : (
            <PlayArrowRounded sx={{ fontSize: 48 }} />
          )}
        </Box>
      </Box>
    );
  }

  const isPdfLoading = isPdf && !pdfFailure && (!!pdfSrc || isPdfAutoloaded);

  const placeholder = (
    <Stack sx={fill} alignItems="center" justifyContent="center" gap={1} px={2}>
      <StorageItemIcon kind={kind} sx={{ fontSize: 160 }} />
      {isViewer && (
        <Typography
          variant="h6"
          color="common.white"
          textAlign="center"
          sx={{ wordBreak: 'break-word' }}
        >
          {item.name}
        </Typography>
      )}
      <Typography variant="body2" color={mutedColor} textAlign="center">
        {STORAGE_ITEM_KIND_LABELS[kind]}
        {item.file?.extension ? ` · ${item.file.extension.toUpperCase()}` : ''}
        {isViewer && item.file ? ` · ${getFileSize(item.file.size)}` : ''}
      </Typography>
      {pdfFailure && (
        <Typography variant="body2" color={mutedColor} textAlign="center">
          {PDF_FAILURE_LABELS[pdfFailure]}
        </Typography>
      )}
      {isPdfLoading && (
        <CircularProgress color="inherit" size={24} sx={{ mt: 1, color: mutedColor }} />
      )}
      {isPdf && !isPdfLoading && !pdfFailure && openUrl && (
        <Button variant="outlined" onClick={() => setPdfSrc(openUrl)} sx={{ mt: 1 }}>
          Show preview
        </Button>
      )}
      {isViewer && onOpen && (
        <Button
          variant="contained"
          startIcon={item.isFolder ? <FolderOpenOutlined /> : <OpenInNewOutlined />}
          onClick={() => onOpen(item)}
          sx={{ mt: 1 }}
        >
          Open
        </Button>
      )}
    </Stack>
  );

  // A PDF with a first-page preview shows it while the document itself is on its way — or, too
  // heavy to load by itself, until "Show preview".
  const pdfPoster = isPdf && hasPreview && !pdfFailure && (
    <Box sx={fill}>
      <Image
        src={item.previewUrl!}
        alt={item.name}
        fill
        style={{ objectFit: 'contain' }}
        onError={handlePreviewError}
      />
      <Stack sx={{ position: 'absolute', left: 0, right: 0, bottom: 24 }} alignItems="center">
        {isPdfLoading ? (
          <CircularProgress size={28} />
        ) : (
          openUrl && (
            <Button variant="contained" onClick={() => setPdfSrc(openUrl)}>
              Show preview
            </Button>
          )
        )}
      </Stack>
    </Box>
  );
  const cover = pdfPoster || placeholder;

  if (isPdf && pdfSrc && !pdfFailure) {
    return (
      <Box sx={fill}>
        {!isPdfShown && cover}
        <PdfDocumentView
          url={pdfSrc}
          isViewer={isViewer}
          controlsRef={pdfControls}
          onLoad={() => setPdfShown(true)}
          onFailure={setPdfFailure}
        />
      </Box>
    );
  }

  return cover;
};
