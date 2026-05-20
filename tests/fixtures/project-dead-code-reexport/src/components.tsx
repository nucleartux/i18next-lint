import { useTranslation } from "react-i18next";

export const ReexportedComponent = () => {
  const { t } = useTranslation();
  return <div>{t("reexported_key")}</div>;
};

export const DeadComponent = () => {
  const { t } = useTranslation();
  return <div>{t("dead_key")}</div>;
};
