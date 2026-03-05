import { useTranslation } from "react-i18next";

export const App = () => {
  const { t } = useTranslation();
  fun1();
  return <div>{t("key0")}</div>;
};

function fun1() {
  const { t } = useTranslation();
  return t("key1");
}

function fun2() {
  const { t } = useTranslation();
  return t("key2");
}
