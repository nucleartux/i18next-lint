import React from "react";
import { useTranslation } from "react-i18next";
import { Page7 } from "./Page7";

export const Page6 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_26")}
      {t("title_27")}
      {t("label_11")}
      {t("label_12")}
      <Page7 />
    </div>
  );
};
