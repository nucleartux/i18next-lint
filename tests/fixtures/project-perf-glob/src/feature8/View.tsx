import React from "react";
import { useTranslation } from "react-i18next";
import { Detail } from "./Detail";

export const View = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_19")}
      {t("label_8")}
      {t("import")}
      <Detail />
    </div>
  );
};
