import { useTranslation } from "react-i18next";

export const App2 = () => {
  const { t } = useTranslation();
  return <div>{t("key2")}</div>;
};
