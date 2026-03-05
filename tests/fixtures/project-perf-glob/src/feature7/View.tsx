import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_16")}
      {t("title_17")}
      {t("label_7")}
      <Detail />
    </div>
  );
};
