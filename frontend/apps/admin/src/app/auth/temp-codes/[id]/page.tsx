'use client';

import {
  AppShow,
  BooleanEntityField,
  DateEntityField,
  RecordView,
  RefButtonContainer,
  StringEntityField,
} from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { AuthDatabaseEntity, Database } from '@packages/common';
import { GrpcTempCode } from '@packages/grpc';
import React from 'react';

export default function TempCodeShow() {
  const { isLoading, record } = useResourceShow<GrpcTempCode>();

  return (
    <AppShow isLoading={isLoading}>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls="refs-content" id="refs">
          <Typography component="span">References</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RefButtonContainer
            refs={[
              {
                database: Database.AUTH,
                resource: AuthDatabaseEntity.USER,
                id: record?.userId,
                label: 'User',
              },
            ]}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls="info-content" id="info">
          <Typography component="span">Temp code info</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RecordView record={record}>
            <BooleanEntityField label="Is Active" value={record?.isActive} />
            <StringEntityField label="Code" value={record?.code} />
            <DateEntityField label="Expired at" value={record?.expiredAt} />
          </RecordView>
        </AccordionDetails>
      </Accordion>
    </AppShow>
  );
}
