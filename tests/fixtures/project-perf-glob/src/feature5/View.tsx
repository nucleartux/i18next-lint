import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_12")}
      {t("label_5")}
      {t("close")}
      <Detail />
    </div>
  );
};
