import { FieldError, Merge } from 'react-hook-form';

export type FieldErr = FieldError | Merge<FieldError, (FieldError | undefined)[]>;
