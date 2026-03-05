import { useTranslation } from "react-i18next";

export const Comp1 = () => {
  const { t } = useTranslation();
  return <div>{t("comp1")}</div>;
};

export const Comp2 = () => {
  const { t } = useTranslation();
  return <div>{t("comp2")}</div>;
};
