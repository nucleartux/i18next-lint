import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_1")}
      {t("title_2")}
      {t("label_1")}
      <Detail />
    </div>
  );
};
