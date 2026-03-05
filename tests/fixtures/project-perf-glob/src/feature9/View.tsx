import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_21")}
      {t("title_22")}
      {t("label_9")}
      <Detail />
    </div>
  );
};
