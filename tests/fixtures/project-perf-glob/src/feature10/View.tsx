import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_24")}
      {t("label_10")}
      {t("yes")}
      <Detail />
    </div>
  );
};
