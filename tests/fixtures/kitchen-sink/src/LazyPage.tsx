import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { formatNumber } from "./utils";

export const LazyPage = () => {
  const { t } = useTranslation();
  return (
    <div>
      <Trans i18nKey="welcomeUser" />
      <Trans i18nKey="newMessages" count={messages.length}>
        You have {{ count: messages.length }} messages.
      </Trans>
      {formatNumber(t, 1000)}
    </div>
  );
};

