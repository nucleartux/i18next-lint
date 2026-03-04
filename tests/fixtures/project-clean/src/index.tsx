import React from "react";
import { useTranslation } from "react-i18next";

export const App = () => {
  const { t } = useTranslation();
  const simple = t("simple");
  return <div>{simple}</div>;
};

