import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_7")}
      {t("label_3")}
      {t("error")}
      <Detail />
    </div>
  );
};
