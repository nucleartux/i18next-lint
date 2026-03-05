import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_9")}
      {t("title_10")}
      {t("label_4")}
      <Detail />
    </div>
  );
};
