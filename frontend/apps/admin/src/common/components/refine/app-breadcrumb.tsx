import React, { FC } from 'react';
import { matchResourceFromRoute, useBreadcrumb, useLink, useResourceParams } from '@refinedev/core';
import { BreadcrumbProps } from '@refinedev/mui';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import type { LinkProps } from '@mui/material/Link';

export const AppBreadcrumb: FC<BreadcrumbProps> = ({
  breadcrumbProps,
  showHome = true,
  hideIcons = false,
  meta,
  minItems = 2,
}) => {
  const { breadcrumbs } = useBreadcrumb({ meta });
  const Link = useLink();
  const { resources } = useResourceParams();
  const rootRouteResource = matchResourceFromRoute('/', resources);

  if (breadcrumbs.length < minItems) {
    return null;
  }

  const LinkRouter = (props: LinkProps & { to?: string }) => {
    const { to, children, ...restProps } = props;

    return (
      <Link to={to || ''}>
        <span {...restProps}>{children}</span>
      </Link>
    );
  };

  return (
    <Breadcrumbs
      aria-label="breadcrumb"
      sx={{
        padding: 2,
        ...(breadcrumbProps?.sx ?? {}),
      }}
      {...breadcrumbProps}
    >
      {showHome && rootRouteResource.found && (
        <LinkRouter
          underline="hover"
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
          color="inherit"
          to="/"
        >
          {rootRouteResource?.resource?.meta?.icon ?? (
            <HomeOutlined
              sx={{
                fontSize: '18px',
              }}
            />
          )}
        </LinkRouter>
      )}
      {breadcrumbs.map(({ label, icon, href }) => {
        return (
          <Grid
            key={label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              '& .MuiSvgIcon-root': {
                fontSize: '16px',
              },
              gap: 0.5,
            }}
          >
            {!hideIcons && icon}
            {href ? (
              <LinkRouter
                underline="hover"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '14px',
                  marginLeft: 0.5,
                }}
                color="inherit"
                to={href}
                variant="subtitle1"
              >
                {label}
              </LinkRouter>
            ) : (
              <Typography fontSize="14px">{label}</Typography>
            )}
          </Grid>
        );
      })}
    </Breadcrumbs>
  );
};
