import { useTranslation } from "react-i18next";

export const App1 = () => {
  const { t } = useTranslation();
  return <div>{t("key1")}</div>;
};
