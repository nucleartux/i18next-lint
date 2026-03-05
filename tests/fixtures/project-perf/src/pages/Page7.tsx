import React from "react";
import { useTranslation } from "react-i18next";
import { Page8 } from "./Page8";

export const Page7 = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_28")}
      {t("title_29")}
      {t("label_13")}
      {t("time")}
      <Page8 />
    </div>
  );
};
