import React from "react";
import { useTranslation } from "react-i18next";
import { Page5 } from "./Page5";

export const Page4 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_23")}
      {t("title_24")}
      {t("label_9")}
      {t("export")}
      <Page5 />
    </div>
  );
};
