import React from "react";
import { Trans } from "react-i18next";

export const LazyPage = () => (
  <div>
    <Trans i18nKey="welcomeUser" />
    <Trans i18nKey="newMessages" count={messages.length}>
      You have {{ count: messages.length }} messages.
    </Trans>
  </div>
);

