import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_4")}
      {t("title_5")}
      {t("label_2")}
      <Detail />
    </div>
  );
};
