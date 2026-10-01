'use client';

import { useValidatedForm } from '@/common/hooks';
import { isNameConflict } from '@/features/storage/helpers';
import { SchemaTypeOf } from '@packages/common';
import { useEffect, useRef } from 'react';
import { FieldValues } from 'react-hook-form';
import { ZodRawShape } from 'zod';

/**
 * `useValidatedForm` for creating or editing a storage object. The backend is the one place the
 * name rule lives: a taken name comes back as a 409, and it is shown on the name field in place of
 * Refine's notification, with the backend's own message. A move is never refused for its name — it
 * lands under a suffixed one, which the edit page reports. No lookup runs before the save, so there
 * is no second copy of the rule to drift and no check that races the write.
 */
export const useStorageObjectForm = <
  ValidationSchema extends ZodRawShape,
  Input extends FieldValues = SchemaTypeOf<ValidationSchema>,
>(
  schema: ValidationSchema,
) => {
  // The form's `setError` exists only once the form does, and the mutation handlers are handed to
  // it at creation; the ref bridges the two.
  const showOnName = useRef<(message: string) => void>(undefined);

  const form = useValidatedForm<ValidationSchema, Input>(schema, {
    refineCoreProps: {
      errorNotification: (error) => (isNameConflict(error) ? false : undefined),
      onMutationError: (error) => {
        if (isNameConflict(error)) {
          showOnName.current?.(error.message);
        }
      },
    },
  });

  const { setError } = form;

  useEffect(() => {
    showOnName.current = (message) =>
      setError('name' as Parameters<typeof setError>[0], { type: 'server', message });
  }, [setError]);

  return form;
};
