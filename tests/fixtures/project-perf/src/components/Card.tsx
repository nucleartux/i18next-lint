import React from "react";
import { useTranslation } from "react-i18next";

export const Card = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("title_37")}
      {t("description")}
    </div>
  );
};
