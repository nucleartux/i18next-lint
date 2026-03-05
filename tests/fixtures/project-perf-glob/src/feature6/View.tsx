import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_14")}
      {t("label_6")}
      {t("edit")}
      <Detail />
    </div>
  );
};
